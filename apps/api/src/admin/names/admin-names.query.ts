import {
    AdminNamesQuery,
    AgentReviewFilter,
    NAME_STATUSES,
    NameStatus,
} from '@tbn/shared';
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

/**
 * A verdict is an agent's ledger entry about any row or reading of the cluster,
 * so "has an agent looked at this" is one EXISTS over both arcs.
 */
const verdictExists = (extra = ''): string =>
    `EXISTS (
        SELECT 1 FROM "verifications" v
        LEFT JOIN "names" vn ON vn."id" = v."name_id"
        LEFT JOIN "meanings" vm ON vm."id" = v."meaning_id"
        WHERE v."agent_id" IS NOT NULL
          AND COALESCE(vn."cluster_id", vm."cluster_id") = "Clusters"."id"
          ${extra}
    )`;

/**
 * Built from the enum rather than assembled per request, so the subquery text
 * can never contain anything that arrived with one.
 */
const AGENT_REVIEW: Record<AgentReviewFilter, Utils.Literal> = {
    // Changed something and nobody has checked it.
    decided: literal(
        verdictExists(
            `AND v."reason" NOT IN ('abstained', 'unchanged', 'considered')`,
        ),
    ),
    // Looked and would not decide. Where a person is worth the most.
    unsure: literal(verdictExists(`AND v."reason" = 'abstained'`)),
    // Sure, and the catalogue was already right. The cheapest outcome there is.
    unchanged: literal(verdictExists(`AND v."reason" = 'unchanged'`)),
    // Decided on a run that was told to write nothing: an opinion, not an act.
    considered: literal(verdictExists(`AND v."reason" = 'considered'`)),
    // Two or more agents said what they would write. One is an opinion; two is
    // something a person can weigh, because the interesting question is whether
    // they landed on the same meaning.
    suggested: literal(`(
        SELECT count(DISTINCT v."agent_id") FROM "verifications" v
        LEFT JOIN "names" vn ON vn."id" = v."name_id"
        LEFT JOIN "meanings" vm ON vm."id" = v."meaning_id"
        WHERE v."agent_id" IS NOT NULL
          AND v."proposed" IS NOT NULL
          AND COALESCE(vn."cluster_id", vm."cluster_id") = "Clusters"."id"
    ) >= 2`),
    // The backlog no agent has reached.
    none: literal(`NOT ${verdictExists()}`),
};

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

    if (query.agentReview) {
        clauses.push(AGENT_REVIEW[query.agentReview]);
    }

    if (query.maxConfidence !== undefined) {
        // The number is bound, not pasted: it has come from the request.
        clauses.push(
            literal(
                verdictExists(
                    `AND v."confidence" IS NOT NULL AND v."confidence" <= :maxConfidence`,
                ),
            ),
        );
    }

    return { [Op.and]: clauses };
};

/**
 * The readings that compete with this one. For a single name that is its
 * cluster, not its row: the same spelling filed twice is one decision, and
 * publishing a reading has to displace whatever the cluster's other rows
 * publish. A twin pair belongs to one side and only that side: slot 2 of a
 * pair is a different subject from slot 1.
 *
 * `clusterId` falls back to `nameId` for a row whose cluster was removed, so
 * the row still competes with itself rather than with everything unclustered.
 */
export const meaningSubjectWhere = ({
    nameId,
    twinNameId,
    clusterId,
    slot,
}: {
    nameId: number | null;
    twinNameId: number | null;
    clusterId: number | null;
    slot: number;
}): WhereOptions => {
    if (nameId === null) {
        return { twinNameId, slot };
    }

    return clusterId === null ? { nameId } : { clusterId };
};
