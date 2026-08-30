import { AdminNamesQuery } from '@tbn/shared';
import { literal, Op, WhereOptions } from 'sequelize';

/**
 * `%` and `_` are LIKE wildcards, so a reviewer searching for a literal one
 * would otherwise widen their own search. Sequelize binds the value, so this
 * is about intent rather than injection.
 */
export const escapeLike = (term: string): string =>
    term.replace(/[\\%_]/g, (character) => `\\${character}`);

/** Names the catalogue holds more than once, whatever their status. */
const DUPLICATED = literal(
    `"Names"."name" IN (SELECT "name" FROM "names" GROUP BY "name" HAVING count(*) > 1)`,
);

export const adminNamesWhere = (query: AdminNamesQuery): WhereOptions => {
    const clauses: WhereOptions[] = [];

    if (query.status) {
        clauses.push({ status: query.status });
    }

    if (query.gender) {
        clauses.push({ gender: query.gender });
    }

    if (query.search) {
        clauses.push({
            name: { [Op.iLike]: `%${escapeLike(query.search)}%` },
        });
    }

    if (query.duplicatesOnly) {
        clauses.push(DUPLICATED);
    }

    return { [Op.and]: clauses };
};
