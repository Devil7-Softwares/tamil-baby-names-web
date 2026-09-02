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

    it('composes with the filters that were already there', () => {
        expect(
            clauses({
                ...base,
                status: 'candidate',
                gender: 'boy',
                agentReview: 'unsure',
                maxConfidence: 75,
            }),
        ).toHaveLength(4);
    });
});
