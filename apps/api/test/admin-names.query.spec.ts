import { AdminNamesQuery } from '@tbn/shared';
import { Op } from 'sequelize';
import { describe, expect, it } from 'vitest';

import {
    adminClustersWhere,
    escapeLike,
    meaningSubjectWhere,
} from '../src/admin/names/admin-names.query.js';

const base: AdminNamesQuery = { page: 1, limit: 25 };

const clauses = (query: AdminNamesQuery) =>
    (adminClustersWhere(query) as Record<symbol, unknown[]>)[Op.and];

const sql = (clause: unknown) => String((clause as { val: string }).val);

describe('escapeLike', () => {
    it('keeps a wildcard the reviewer typed from widening their search', () => {
        expect(escapeLike('100%')).toBe('100\\%');
        expect(escapeLike('a_b')).toBe('a\\_b');
        expect(escapeLike('back\\slash')).toBe('back\\\\slash');
    });

    it('leaves an ordinary term alone', () => {
        expect(escapeLike('அறிவு')).toBe('அறிவு');
    });
});

describe('adminClustersWhere', () => {
    it('reads every status, unlike the public site', () => {
        expect(clauses(base)).toEqual([]);
    });

    // Status lives on the member rows, so the cluster matches when any row does.
    it('finds the clusters still holding a row of that status', () => {
        const [clause] = clauses({ ...base, status: 'candidate' });

        expect(sql(clause)).toContain('EXISTS');
        expect(sql(clause)).toContain(`"names"."status" = 'candidate'`);
    });

    it('narrows to the gender a cluster is keyed on', () => {
        expect(clauses({ ...base, gender: 'girl' })).toEqual([
            { gender: 'girl' },
        ]);
    });

    it('matches a name anywhere, not just at the start', () => {
        const [clause] = clauses({ ...base, search: 'ram' }) as Array<
            Record<string, Record<symbol, string>>
        >;

        expect(clause.name[Op.iLike]).toBe('%ram%');
    });

    it('escapes the search term rather than binding it raw', () => {
        const [clause] = clauses({ ...base, search: '50%' }) as Array<
            Record<string, Record<symbol, string>>
        >;

        expect(clause.name[Op.iLike]).toBe('%50\\%%');
    });

    it('combines the filters instead of replacing them', () => {
        expect(clauses({ ...base, gender: 'girl' })).toHaveLength(1);
        expect(
            clauses({ ...base, status: 'published', gender: 'girl' }),
        ).toHaveLength(2);
    });

    it('asks for the clusters the import filed more than once', () => {
        const [clause] = clauses({ ...base, duplicatesOnly: true });

        expect(sql(clause)).toContain('> 1');
        expect(sql(clause)).toContain('"names"."cluster_id"');
    });

    it('adds nothing when the duplicates filter is off', () => {
        expect(clauses({ ...base, duplicatesOnly: false })).toEqual([]);
    });
});

describe('meaningSubjectWhere', () => {
    it('gathers the other readings of the whole cluster, not just the row', () => {
        expect(
            meaningSubjectWhere({
                nameId: 12,
                twinNameId: null,
                clusterId: 3,
                slot: 1,
            }),
        ).toEqual({ clusterId: 3 });
    });

    it('falls back to the row when its cluster is gone', () => {
        expect(
            meaningSubjectWhere({
                nameId: 12,
                twinNameId: null,
                clusterId: null,
                slot: 1,
            }),
        ).toEqual({ nameId: 12 });
    });

    it('keeps the two sides of a twin pair apart', () => {
        expect(
            meaningSubjectWhere({
                nameId: null,
                twinNameId: 4,
                clusterId: null,
                slot: 2,
            }),
        ).toEqual({ twinNameId: 4, slot: 2 });
    });
});

describe('the second pass over what an agent did', () => {
    it('finds clusters an agent changed', () => {
        const [clause] = clauses({ ...base, agentReview: 'decided' });

        expect(sql(clause)).toContain('"verifications"');
        expect(sql(clause)).toContain(`v."agent_id" IS NOT NULL`);
        expect(sql(clause)).toContain(
            `v."reason" NOT IN ('abstained', 'unchanged', 'considered')`,
        );
        expect(sql(clause)).not.toMatch(/^\s*NOT /);
    });

    // "Not sure" and "sure, nothing to do" are opposite things, and answering
    // one filter with both is what made terra read as unsure six times when its
    // lowest answer of the run was 58.
    it('keeps "already right" out of "was unsure"', () => {
        const [unsure] = clauses({ ...base, agentReview: 'unsure' });
        const [right] = clauses({ ...base, agentReview: 'unchanged' });

        expect(sql(unsure)).toContain(`v."reason" = 'abstained'`);
        expect(sql(unsure)).not.toContain('unchanged');
        expect(sql(right)).toContain(`v."reason" = 'unchanged'`);
    });

    // One proposal is an opinion; two is something a person can weigh, which is
    // the whole point on a name nobody has written a meaning for.
    it('finds clusters two or more agents suggested a meaning for', () => {
        const [clause] = clauses({ ...base, agentReview: 'suggested' });

        expect(sql(clause)).toContain('count(DISTINCT v."agent_id")');
        expect(sql(clause)).toContain('v."proposed" IS NOT NULL');
        expect(sql(clause)).toContain('>= 2');
    });

    // A comparison run's verdict is an opinion the catalogue never acted on,
    // so it answers its own filter and not "an agent decided".
    it('keeps an opinion out of what an agent decided', () => {
        const [clause] = clauses({ ...base, agentReview: 'considered' });

        expect(sql(clause)).toContain(`v."reason" = 'considered'`);
        expect(sql(clause)).not.toMatch(/^\s*NOT /);
    });

    it('finds clusters an agent would not decide on', () => {
        const [clause] = clauses({ ...base, agentReview: 'unsure' });

        expect(sql(clause)).toContain(`v."reason" = 'abstained'`);
    });

    it('finds the backlog no agent has reached', () => {
        const [clause] = clauses({ ...base, agentReview: 'none' });

        expect(sql(clause).trimStart().startsWith('NOT ')).toBe(true);
    });

    // Both arcs: a verdict may be about a row or about one of its readings.
    it('looks for a verdict on the cluster’s rows and its readings', () => {
        const [clause] = clauses({ ...base, agentReview: 'decided' });

        expect(sql(clause)).toContain(
            'COALESCE(vn."cluster_id", vm."cluster_id")',
        );
    });

    // The ceiling arrived with the request, so it is bound rather than pasted.
    it('binds the confidence ceiling instead of writing it into the SQL', () => {
        const [clause] = clauses({ ...base, maxConfidence: 60 });

        expect(sql(clause)).toContain(':maxConfidence');
        expect(sql(clause)).not.toContain('60');
    });

    // Half of what a run like 43 touched is what it could not ask about, and
    // "show me this run" that hides those answers the question wrongly.
    it('reads a run as its ledger and its failures together', () => {
        const [clause] = clauses({ ...base, run: 43 });

        expect(sql(clause)).toContain('"verifications"');
        expect(sql(clause)).toContain('"review_run_failures"');
        expect(sql(clause)).toContain(' OR ');
    });

    it('binds the run rather than writing it into the SQL', () => {
        const [clause] = clauses({ ...base, run: 43 });

        expect(sql(clause)).toContain(':run');
        expect(sql(clause)).not.toContain('43');
    });

    // The one outcome with nothing in the ledger to read it from.
    it('finds the failures in their own table and nowhere else', () => {
        const [clause] = clauses({ ...base, run: 43, runOutcome: 'failed' });

        expect(sql(clause)).toContain('"review_run_failures"');
        expect(sql(clause)).not.toContain('"verifications"');
    });

    it('tells a reading it wrote from one it merely moved', () => {
        const [written] = clauses({ ...base, run: 43, runOutcome: 'written' });
        const [published] = clauses({
            ...base,
            run: 43,
            runOutcome: 'published',
        });

        expect(sql(written)).toContain('vm."text" = v."proposed"');
        expect(sql(published)).toContain(`v."to_status" = 'published'`);
        expect(sql(published)).not.toContain('v."proposed"');
    });

    // The same transition on the two arcs: a reading thrown away and a
    // catalogue row thrown away are different things the run counts apart.
    it('separates a rejected reading from a dropped row', () => {
        const [rejected] = clauses({
            ...base,
            run: 43,
            runOutcome: 'rejected',
        });
        const [dropped] = clauses({ ...base, run: 43, runOutcome: 'dropped' });

        expect(sql(rejected)).toContain('v."meaning_id" IS NOT NULL');
        expect(sql(dropped)).toContain('v."name_id" IS NOT NULL');
    });

    // It filters nothing on its own, and would read as though it did.
    it('ignores an outcome with no run to ask it about', () => {
        expect(clauses({ ...base, runOutcome: 'failed' })).toEqual([]);
    });

    // 0017 kept the status a row would have reached, so a run that changed
    // nothing answers the same questions as one that did. Asking by reason
    // would collapse all four of its acting outcomes into `considered`.
    it('asks what a run did by the transition, not by the reason', () => {
        for (const outcome of ['published', 'rejected', 'dropped'] as const) {
            const [clause] = clauses({ ...base, run: 41, runOutcome: outcome });

            expect(sql(clause)).toContain('to_status');
            expect(sql(clause)).not.toContain(`v."reason" = 'decision'`);
        }
    });

    // The incumbent being kept is recorded too, and it is not a promotion.
    it('does not count a reading that was already published', () => {
        const [clause] = clauses({
            ...base,
            run: 42,
            runOutcome: 'published',
        });

        expect(sql(clause)).toContain(`v."from_status" <> 'published'`);
    });

    // An abstention carries what it would have written too, and did not act.
    it('keeps an abstention out of what the run wrote', () => {
        const [clause] = clauses({ ...base, run: 42, runOutcome: 'written' });

        expect(sql(clause)).not.toContain('abstained');
        expect(sql(clause)).toContain(`v."reason" = 'considered'`);
    });

    it('composes with the filters that were already there', () => {
        expect(
            clauses({
                ...base,
                status: 'candidate',
                gender: 'boy',
                agentReview: 'unsure',
                maxConfidence: 75,
                run: 43,
                runOutcome: 'abstained',
            }),
        ).toHaveLength(5);
    });
});
