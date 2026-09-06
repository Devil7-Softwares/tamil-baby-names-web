import {
    AdminNamesQuery,
    AgentReviewFilter,
    NAME_STATUSES,
    NameStatus,
    RUN_OUTCOMES,
    RunOutcome,
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

/**
 * What one run did to a cluster, read back off the ledger.
 *
 * Written to hold for a run that changed nothing as well as one that did, which
 * is what 0017 bought: `considered` replaces the reason and leaves `to_status`
 * as the status the row *would* have reached. So these ask about the transition
 * rather than the reason wherever they can, and "175 written" on a run that
 * wrote nothing lands on the same 175 clusters it would have written to.
 *
 * `written` is the reading the agent composed rather than any it moved. On an
 * applied run that is the row it created, whose text is the one it proposed;
 * on a run told not to write there is no such row, and the opinion is recorded
 * against the name instead. An abstention also carries `proposed` and is
 * neither: it is below the bar and did not act.
 *
 * `published` excludes a reading that was already published, because the ledger
 * records the incumbent being kept as well as a promotion, and only one of
 * those is something the run did. `rejected` and `dropped` are the same
 * transition on the two arcs — a reading thrown away, and a catalogue row
 * thrown away — which is how the run's own report counts them.
 *
 * Built from the enum, so the clause text can hold nothing from a request. The
 * run id is the one value that arrived with one, and it is bound.
 */
const RUN_OUTCOME: Record<RunOutcome, string> = {
    written: `v."proposed" IS NOT NULL
              AND (vm."text" = v."proposed" OR v."reason" = 'considered')`,
    published: `v."to_status" = 'published' AND v."from_status" <> 'published'`,
    rejected: `v."to_status" = 'rejected' AND v."meaning_id" IS NOT NULL`,
    dropped: `v."to_status" = 'rejected' AND v."name_id" IS NOT NULL`,
    abstained: `v."reason" = 'abstained'`,
    unchanged: `v."reason" = 'unchanged'`,
    considered: `v."reason" = 'considered'`,
    // Nothing was judged, so there is nothing in the ledger to read: see below.
    failed: '',
};

const inRun = (extra: string): string =>
    `EXISTS (
        SELECT 1 FROM "verifications" v
        LEFT JOIN "names" vn ON vn."id" = v."name_id"
        LEFT JOIN "meanings" vm ON vm."id" = v."meaning_id"
        WHERE v."run_id" = :run
          AND COALESCE(vn."cluster_id", vm."cluster_id") = "Clusters"."id"
          ${extra ? `AND (${extra})` : ''}
    )`;

const FAILED_IN_RUN = `EXISTS (
    SELECT 1 FROM "review_run_failures" f
    WHERE f."run_id" = :run AND f."cluster_id" = "Clusters"."id"
)`;

/**
 * Every cluster a run reached, with or without an outcome to narrow it by.
 * Without one that has to include the failures: they are half of what a run
 * like 43 touched, and asking "what did this run see" and being shown only
 * what it managed to answer is the question answered wrongly.
 */
const REACHED_BY_RUN: Record<RunOutcome | 'any', Utils.Literal> =
    Object.fromEntries([
        ['any', literal(`(${inRun('')} OR ${FAILED_IN_RUN})`)],
        ...RUN_OUTCOMES.map((outcome) => [
            outcome,
            literal(
                outcome === 'failed'
                    ? FAILED_IN_RUN
                    : inRun(RUN_OUTCOME[outcome]),
            ),
        ]),
    ]) as Record<RunOutcome | 'any', Utils.Literal>;

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

    // The outcome says nothing without a run to ask it about, so it is read
    // only alongside one rather than quietly filtering the whole catalogue.
    if (query.run !== undefined) {
        clauses.push(REACHED_BY_RUN[query.runOutcome ?? 'any']);
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
