import { AdminNamesQuery } from '@tbn/shared';
import { Op } from 'sequelize';
import { describe, expect, it } from 'vitest';

import {
    adminNamesWhere,
    escapeLike,
} from '../src/admin/names/admin-names.query.js';

const base: AdminNamesQuery = { page: 1, limit: 25 };

const clauses = (query: AdminNamesQuery) =>
    (adminNamesWhere(query) as Record<symbol, unknown[]>)[Op.and];

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

describe('adminNamesWhere', () => {
    it('reads every status, unlike the public site', () => {
        expect(clauses(base)).toEqual([]);
    });

    it('narrows to one status when asked', () => {
        expect(clauses({ ...base, status: 'candidate' })).toEqual([
            { status: 'candidate' },
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
        expect(
            clauses({ ...base, status: 'published', gender: 'girl' }),
        ).toEqual([{ status: 'published' }, { gender: 'girl' }]);
    });

    it('asks for the names the catalogue holds more than once', () => {
        const [clause] = clauses({ ...base, duplicatesOnly: true });

        expect(String((clause as { val: string }).val)).toContain(
            'HAVING count(*) > 1',
        );
    });

    it('adds nothing when the duplicates filter is off', () => {
        expect(clauses({ ...base, duplicatesOnly: false })).toEqual([]);
    });
});
