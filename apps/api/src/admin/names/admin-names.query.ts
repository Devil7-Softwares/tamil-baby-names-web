import { AdminNamesQuery, NAME_STATUSES, NameStatus } from '@tbn/shared';
import { literal, Op, Utils, WhereOptions } from 'sequelize';

/**
 * `%` and `_` are LIKE wildcards, so a reviewer searching for a literal one
 * would otherwise widen their own search. Sequelize binds the value, so this
 * is about intent rather than injection.
 */
export const escapeLike = (term: string): string =>
    term.replace(/[\\%_]/g, (character) => `\\${character}`);

/** Clusters the import filed more than once, whatever their rows' status. */
const DUPLICATED = literal(
    `(SELECT count(*) FROM "names" WHERE "names"."cluster_id" = "Clusters"."id") > 1`,
);

/**
 * Status lives on the member rows, not the cluster, so a cluster matches when
 * any row in it does: narrowing to `candidate` asks which clusters still hold
 * something undecided, not which have nothing decided.
 *
 * Built once per status from the enum itself, so the subquery text can never
 * be assembled out of anything that arrived with the request.
 */
const HAS_MEMBER: Record<NameStatus, Utils.Literal> = Object.fromEntries(
    NAME_STATUSES.map((status) => [
        status,
        literal(
            `EXISTS (SELECT 1 FROM "names"
                     WHERE "names"."cluster_id" = "Clusters"."id"
                       AND "names"."status" = '${status}')`,
        ),
    ]),
) as Record<NameStatus, Utils.Literal>;

export const adminClustersWhere = (query: AdminNamesQuery): WhereOptions => {
    const clauses: WhereOptions[] = [];

    if (query.status) {
        clauses.push(HAS_MEMBER[query.status]);
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

/**
 * The readings that compete with this one. A meaning belongs to either a name
 * or one side of a twin pair, and only that side: slot 2 of a pair is a
 * different subject from slot 1.
 */
export const meaningSubjectWhere = ({
    nameId,
    twinNameId,
    slot,
}: {
    nameId: number | null;
    twinNameId: number | null;
    slot: number;
}): WhereOptions => (nameId === null ? { twinNameId, slot } : { nameId });
