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
    it('gathers the other readings of a single name', () => {
        expect(
            meaningSubjectWhere({ nameId: 12, twinNameId: null, slot: 1 }),
        ).toEqual({ nameId: 12 });
    });

    it('keeps the two sides of a twin pair apart', () => {
        expect(
            meaningSubjectWhere({ nameId: null, twinNameId: 4, slot: 2 }),
        ).toEqual({ twinNameId: 4, slot: 2 });
    });
});
