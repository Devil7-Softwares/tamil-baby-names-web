import { Inject, Injectable } from '@nestjs/common';
import {
    AdminActivity,
    AdminOverview,
    AdminSpend,
    AdminStatusCounts,
    NameStatus,
} from '@tbn/shared';
import { GroupedCountResultItem, Op, QueryTypes, Sequelize } from 'sequelize';

import {
    ADMIN_USERS_MODEL,
    CLUSTERS_MODEL,
    MEANINGS_MODEL,
    NAMES_MODEL,
    SEQUELIZE,
    VERIFICATIONS_MODEL,
} from '../../database/database.constants.js';
import {
    AdminUsersModel,
    ClustersModel,
    IVerification,
    MeaningsModel,
    NamesModel,
    VerificationsModel,
} from '../../database/models.js';

/** Enough to see what happened today without reading the whole ledger. */
const RECENT = 10;

const NO_COUNTS: AdminStatusCounts = {
    published: 0,
    candidate: 0,
    rejected: 0,
};

/**
 * Grouping counts in the database gives one row per status *that exists*, so
 * the statuses nothing sits at have to come from somewhere: they are zero, not
 * missing.
 */
const countsFrom = (rows: GroupedCountResultItem[]): AdminStatusCounts =>
    rows.reduce(
        (counts, row) => ({
            ...counts,
            [row.status as NameStatus]: Number(row.count),
        }),
        NO_COUNTS,
    );

const byId = <Row extends { id: number }>(
    rows: Row[],
    label: (row: Row) => string,
): Map<number, string> => new Map(rows.map((row) => [row.id, label(row)]));

const idsOf = (
    entries: IVerification[],
    key: 'nameId' | 'meaningId' | 'actorId',
): number[] =>
    entries
        .map((entry) => entry[key])
        .filter((id): id is number => id !== null);

@Injectable()
export class AdminOverviewService {
    constructor(
        @Inject(SEQUELIZE) private readonly sequelize: Sequelize,
        @Inject(NAMES_MODEL) private readonly names: NamesModel,
        @Inject(MEANINGS_MODEL) private readonly meanings: MeaningsModel,
        @Inject(CLUSTERS_MODEL) private readonly clusters: ClustersModel,
        @Inject(VERIFICATIONS_MODEL)
        private readonly verifications: VerificationsModel,
        @Inject(ADMIN_USERS_MODEL) private readonly users: AdminUsersModel,
    ) {}

    async get(): Promise<AdminOverview> {
        const [names, meanings, total, duplicated, activity, spend] =
            await Promise.all([
                this.names.count({ group: ['status'] }),
                this.meanings.count({ group: ['status'] }),
                this.clusters.count(),
                this.duplicatedClusters(),
                this.activity(),
                this.spend(),
            ]);

        return {
            names: countsFrom(names),
            meanings: countsFrom(meanings),
            clusters: { total, duplicated },
            activity,
            spend,
        };
    }

    /**
     * What the recorded runs have cost, by agent, at the prices each run
     * started with. Runs from before tokens were recorded are counted apart
     * rather than folded in as free.
     */
    private async spend(): Promise<AdminSpend> {
        const [agents, [{ unrecorded }]] = await Promise.all([
            this.sequelize.query<{
                agent: string;
                runs: string;
                input_tokens: string;
                output_tokens: string;
                cost: string | null;
                unpriced: string;
            }>(
                `SELECT "agents"."name" AS "agent",
                        count(*) AS "runs",
                        sum("runs"."input_tokens") AS "input_tokens",
                        sum("runs"."output_tokens") AS "output_tokens",
                        sum(("runs"."input_tokens" * "runs"."input_price"
                            + "runs"."output_tokens" * "runs"."output_price")
                            / 1000000) AS "cost",
                        count(*) FILTER (
                            WHERE "runs"."input_price" IS NULL
                               OR "runs"."output_price" IS NULL
                        ) AS "unpriced"
                 FROM "review_runs" AS "runs"
                 JOIN "agents" ON "agents"."id" = "runs"."agent_id"
                 WHERE "runs"."input_tokens" IS NOT NULL
                 GROUP BY "agents"."id", "agents"."name"
                 ORDER BY "cost" DESC NULLS LAST, "agents"."name"`,
                { type: QueryTypes.SELECT },
            ),
            this.sequelize.query<{ unrecorded: string }>(
                `SELECT count(*) AS "unrecorded" FROM "review_runs"
                 WHERE "input_tokens" IS NULL`,
                { type: QueryTypes.SELECT },
            ),
        ]);

        const byAgent = agents.map((row) => ({
            agent: row.agent,
            runs: Number(row.runs),
            inputTokens: Number(row.input_tokens),
            outputTokens: Number(row.output_tokens),
            cost: Number(row.cost ?? 0),
            unpriced: Number(row.unpriced),
        }));

        return {
            total: byAgent.reduce((sum, { cost }) => sum + cost, 0),
            agents: byAgent,
            unrecorded: Number(unrecorded),
        };
    }

    /** The clusters worth a reviewer's time: the ones holding more than a row. */
    private async duplicatedClusters(): Promise<number> {
        const [{ duplicated }] = await this.sequelize.query<{
            duplicated: string;
        }>(
            `SELECT count(*) AS "duplicated" FROM (
                 SELECT "cluster_id" FROM "names"
                 WHERE "cluster_id" IS NOT NULL
                 GROUP BY "cluster_id" HAVING count(*) > 1
             ) AS "clusters"`,
            { type: QueryTypes.SELECT },
        );

        return Number(duplicated);
    }

    private async activity(): Promise<AdminActivity[]> {
        const entries = (
            await this.verifications.findAll({
                order: [['id', 'DESC']],
                limit: RECENT,
            })
        ).map(({ dataValues }) => dataValues);

        if (!entries.length) {
            return [];
        }

        const [names, meanings, actors] = await Promise.all([
            this.nameSubjects(idsOf(entries, 'nameId')),
            this.meaningSubjects(idsOf(entries, 'meaningId')),
            this.actorNames(idsOf(entries, 'actorId')),
        ]);

        return entries.map((entry) => {
            const isName = entry.nameId !== null;

            return {
                id: entry.id,
                kind: isName ? ('name' as const) : ('meaning' as const),
                subject: isName
                    ? (names.get(entry.nameId as number) ?? null)
                    : (meanings.get(entry.meaningId as number) ?? null),
                fromStatus: entry.fromStatus,
                toStatus: entry.toStatus,
                reason: entry.reason,
                actor:
                    entry.actorId === null
                        ? null
                        : (actors.get(entry.actorId) ?? null),
                at: entry.createdAt.toISOString(),
            };
        });
    }

    private async nameSubjects(ids: number[]): Promise<Map<number, string>> {
        const rows = (await this.names.findAll({
            attributes: ['id', 'name'],
            where: { id: { [Op.in]: ids } },
            raw: true,
        })) as unknown as Array<{ id: number; name: string }>;

        return byId(rows, ({ name }) => name);
    }

    private async meaningSubjects(ids: number[]): Promise<Map<number, string>> {
        const rows = (await this.meanings.findAll({
            attributes: ['id', 'text'],
            where: { id: { [Op.in]: ids } },
            raw: true,
        })) as unknown as Array<{ id: number; text: string }>;

        return byId(rows, ({ text }) => text);
    }

    private async actorNames(ids: number[]): Promise<Map<number, string>> {
        const rows = (await this.users.findAll({
            attributes: ['id', 'name'],
            where: { id: { [Op.in]: ids } },
            raw: true,
        })) as unknown as Array<{ id: number; name: string }>;

        return byId(rows, ({ name }) => name);
    }
}
