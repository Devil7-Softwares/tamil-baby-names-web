import { Inject, Injectable } from '@nestjs/common';
import {
    AdminCitation,
    AdminClustersPage,
    AdminMeaning,
    AdminMeaningsUpdate,
    AdminNamesQuery,
    AdminProposal,
    AdminStatusUpdate,
    AdminVerdict,
    CONFIDENT_ENOUGH,
    NAME_STATUSES,
} from '@tbn/shared';
import { Op, QueryTypes, Sequelize, Transaction } from 'sequelize';

import {
    ATTESTATIONS_MODEL,
    CLUSTERS_MODEL,
    MEANINGS_MODEL,
    NAMES_MODEL,
    SEQUELIZE,
    SOURCES_MODEL,
    VERIFICATIONS_MODEL,
} from '../../database/database.constants.js';
import { LookupsService } from '../../database/lookups.service.js';
import {
    AttestationsModel,
    ClustersModel,
    IMeaning,
    ISource,
    MeaningsModel,
    NamesModel,
    NamesRow,
    SourcesModel,
    VerificationDraft,
    VerificationsModel,
} from '../../database/models.js';
import { SortCollationService } from '../../database/sort-collation.service.js';
import {
    adminClustersWhere,
    meaningSubjectWhere,
} from './admin-names.query.js';

/** A meaning before its source id is resolved to the slug the client sees. */
type StoredMeaning = Omit<AdminMeaning, 'source'> & { sourceId: number | null };

/** A citation before the same resolution. Its source is never null. */
type StoredCitation = Omit<AdminCitation, 'source'> & { sourceId: number };

/** Reads a name off a lookup, for the rows the import gave one. */
const labelReader =
    (labels: Map<number, string>) =>
    (id: number | null): string | null =>
        id === null ? null : (labels.get(id) ?? null);

/** Published, then candidate, then rejected — the order a reviewer reads in. */
const byStatusThenId = (a: StoredMeaning, b: StoredMeaning): number =>
    NAME_STATUSES.indexOf(a.status) - NAME_STATUSES.indexOf(b.status) ||
    a.id - b.id;

@Injectable()
export class AdminNamesService {
    constructor(
        @Inject(SEQUELIZE) private readonly sequelize: Sequelize,
        @Inject(NAMES_MODEL) private readonly names: NamesModel,
        @Inject(MEANINGS_MODEL) private readonly meanings: MeaningsModel,
        @Inject(CLUSTERS_MODEL) private readonly clusters: ClustersModel,
        @Inject(SOURCES_MODEL) private readonly sources: SourcesModel,
        @Inject(VERIFICATIONS_MODEL)
        private readonly verifications: VerificationsModel,
        @Inject(ATTESTATIONS_MODEL)
        private readonly attestations: AttestationsModel,
        private readonly lookups: LookupsService,
        private readonly sortCollation: SortCollationService,
    ) {}

    /**
     * A page of clusters rather than of catalogue rows: the import filed a name
     * once per reading it found, and a reviewer wants those readings in front
     * of them together rather than pages apart.
     */
    async list(query: AdminNamesQuery): Promise<AdminClustersPage> {
        const { rows, count } = await this.clusters.findAndCountAll({
            where: adminClustersWhere(query),
            order: this.sortCollation.order(['sort_key']),
            offset: (query.page - 1) * query.limit,
            limit: query.limit,
            // Bound, because it arrived with the request. The rest of the
            // clause text is built from enums.
            replacements: { maxConfidence: query.maxConfidence ?? null },
        });

        const members = await this.membersFor(
            rows.map(({ dataValues }) => dataValues.id),
        );

        const nameIds = [...members.values()].flat().map(({ id }) => id);

        const [meanings, slugs, labels] = await Promise.all([
            this.meaningsFor(nameIds),
            this.sourceSlugs(),
            this.lookups.labels(),
        ]);

        // After the readings, because a reading is one of the two things a
        // source is cited for.
        const cited = await this.citationsFor(
            nameIds,
            [...meanings.values()].flat().map(({ id }) => id),
        );

        const clusterIds = rows.map(({ dataValues }) => dataValues.id);
        const [verdicts, proposals] = await Promise.all([
            this.verdictsFor(clusterIds),
            this.proposalsFor(clusterIds),
        ]);

        const slug = labelReader(slugs);
        const religion = labelReader(labels.religions);
        const language = labelReader(labels.languages);

        const citations = (
            from: Map<number, StoredCitation[]>,
            id: number,
        ): AdminCitation[] =>
            (from.get(id) ?? []).map(({ sourceId, ...citation }) => ({
                ...citation,
                source: slug(sourceId),
            }));

        return {
            items: rows.map(({ dataValues: cluster }) => {
                const rowsHere = members.get(cluster.id) ?? [];

                return {
                    id: cluster.id,
                    name: cluster.name,
                    gender: cluster.gender,
                    members: rowsHere.map((row) => ({
                        id: row.id,
                        religion: religion(row.religionId),
                        language: language(row.languageId),
                        status: row.status,
                        source: slug(row.sourceId),
                        notes: row.notes,
                        citations: citations(cited.byName, row.id),
                    })),
                    // Pooled across the cluster's rows and re-sorted: gathering
                    // them row by row would order by row before status.
                    meanings: rowsHere
                        .flatMap((row) => meanings.get(row.id) ?? [])
                        .sort(byStatusThenId)
                        .map(({ sourceId, ...meaning }) => ({
                            ...meaning,
                            source: slug(sourceId),
                            citations: citations(cited.byMeaning, meaning.id),
                        })),
                    verdict: verdicts.get(cluster.id) ?? null,
                    proposals: proposals.get(cluster.id) ?? [],
                };
            }),
            total: count,
            page: query.page,
            limit: query.limit,
        };
    }

    /** Null when no such row exists, which the handler reports as a 404. */
    async setStatus(
        { id, status }: AdminStatusUpdate,
        actorId: number,
    ): Promise<AdminStatusUpdate | null> {
        return this.sequelize.transaction(async (transaction) => {
            // Read before written, because the ledger records a transition and
            // the status it moved from is gone once the update lands.
            const row = await this.names.findByPk(id, { transaction });

            if (!row) {
                return null;
            }

            await this.names.update({ status }, { where: { id }, transaction });

            await this.record(
                [
                    {
                        nameId: id,
                        fromStatus: row.dataValues.status,
                        toStatus: status,
                        actorId,
                    },
                ],
                transaction,
            );

            return { id, status };
        });
    }

    async setMeaningStatus(
        { id, status }: AdminStatusUpdate,
        actorId: number,
    ): Promise<AdminMeaningsUpdate | null> {
        const changed = await this.sequelize.transaction(
            async (transaction) => {
                const subject = await this.meanings.findByPk(id, {
                    transaction,
                });

                if (!subject) {
                    return null;
                }

                // Before the promotion, not after: `meanings_published_name_idx`
                // is unique, so writing the second published row would be
                // rejected outright.
                const displaced =
                    status === 'published'
                        ? await this.demoteIncumbents(
                              subject.dataValues,
                              transaction,
                          )
                        : [];

                await this.meanings.update(
                    { status },
                    { where: { id }, transaction },
                );

                await this.record(
                    [
                        {
                            meaningId: id,
                            fromStatus: subject.dataValues.status,
                            toStatus: status,
                            actorId,
                        },
                        ...displaced.map((row) => ({
                            meaningId: row.id,
                            fromStatus: 'published' as const,
                            toStatus: row.status,
                            reason: 'displacement' as const,
                            actorId,
                        })),
                    ],
                    transaction,
                );

                return [{ ...subject.dataValues, status }, ...displaced];
            },
        );

        if (!changed) {
            return null;
        }

        const slugs = await this.sourceSlugs();

        return {
            meanings: changed.map(({ id, text, status, sourceId, nameId }) => ({
                id,
                text,
                status,
                nameId,
                source: sourceId ? (slugs.get(sourceId) ?? null) : null,
            })),
        };
    }

    /**
     * Writes in the caller's transaction, so a status change and the record of
     * who made it either both land or neither does.
     */
    private async record(
        entries: VerificationDraft[],
        transaction: Transaction,
    ): Promise<void> {
        await this.verifications.bulkCreate(entries, { transaction });
    }

    /**
     * Sends whatever is published for this subject back to the pool. Candidate,
     * never rejected: rejection is a reviewer's judgment on the text, not
     * something another reading's promotion should decide on its behalf.
     */
    private async demoteIncumbents(
        subject: IMeaning,
        transaction: Transaction,
    ): Promise<IMeaning[]> {
        // Locks every reading of the subject, the one being promoted included,
        // so two reviewers publishing different readings of the same name
        // queue up instead of racing the unique index.
        const siblings = await this.meanings.findAll({
            where: meaningSubjectWhere(subject),
            transaction,
            lock: transaction.LOCK.UPDATE,
        });

        const incumbents = siblings
            .map(({ dataValues }) => dataValues)
            .filter(
                (row) => row.id !== subject.id && row.status === 'published',
            );

        if (!incumbents.length) {
            return [];
        }

        await this.meanings.update(
            { status: 'candidate' },
            {
                where: { id: { [Op.in]: incumbents.map(({ id }) => id) } },
                transaction,
            },
        );

        return incumbents.map((row) => ({
            ...row,
            status: 'candidate' as const,
        }));
    }

    /** The catalogue rows each of these clusters gathered. */
    private async membersFor(
        clusterIds: number[],
    ): Promise<Map<number, NamesRow[]>> {
        const byCluster = new Map<number, NamesRow[]>();

        if (!clusterIds.length) {
            return byCluster;
        }

        const rows = await this.names.findAll({
            where: { clusterId: { [Op.in]: clusterIds } },
            order: ['id'],
        });

        for (const { dataValues } of rows) {
            // Every row read here was selected by `clusterId`, so it has one.
            const clusterId = dataValues.clusterId as number;

            byCluster.set(clusterId, [
                ...(byCluster.get(clusterId) ?? []),
                dataValues,
            ]);
        }

        return byCluster;
    }

    /** Every reading of the rows on this page, keyed by the row it belongs to. */
    private async meaningsFor(
        ids: number[],
    ): Promise<Map<number, StoredMeaning[]>> {
        const byName = new Map<number, StoredMeaning[]>();

        if (!ids.length) {
            return byName;
        }

        const rows = await this.meanings.findAll({
            where: { nameId: { [Op.in]: ids } },
            order: [
                ['status', 'ASC'],
                ['id', 'ASC'],
            ],
        });

        for (const { dataValues } of rows) {
            // Every row read here was selected by `nameId`, so it has one.
            const nameId = dataValues.nameId as number;

            byName.set(nameId, [
                ...(byName.get(nameId) ?? []),
                {
                    id: dataValues.id,
                    text: dataValues.text,
                    status: dataValues.status,
                    nameId: dataValues.nameId,
                    sourceId: dataValues.sourceId,
                },
            ]);
        }

        return byName;
    }

    /**
     * What cites the rows and readings on this page. A source that names a page
     * number is worth more to a reviewer than a slug on its own, and two
     * sources citing the same reading is the agreement they are looking for.
     */
    private async citationsFor(
        nameIds: number[],
        meaningIds: number[],
    ): Promise<{
        byName: Map<number, StoredCitation[]>;
        byMeaning: Map<number, StoredCitation[]>;
    }> {
        const byName = new Map<number, StoredCitation[]>();
        const byMeaning = new Map<number, StoredCitation[]>();

        const subjects = [
            ...(nameIds.length ? [{ nameId: { [Op.in]: nameIds } }] : []),
            ...(meaningIds.length
                ? [{ meaningId: { [Op.in]: meaningIds } }]
                : []),
        ];

        if (!subjects.length) {
            return { byName, byMeaning };
        }

        const rows = await this.attestations.findAll({
            where: { [Op.or]: subjects },
            order: ['id'],
        });

        for (const { dataValues } of rows) {
            // 0012's exclusive arc: a citation has one subject or the other.
            const [into, subject] =
                typeof dataValues.nameId === 'number'
                    ? [byName, dataValues.nameId]
                    : [byMeaning, dataValues.meaningId as number];

            into.set(subject, [
                ...(into.get(subject) ?? []),
                {
                    id: dataValues.id,
                    locator: dataValues.locator,
                    excerpt: dataValues.excerpt,
                    sourceId: dataValues.sourceId,
                },
            ]);
        }

        return { byName, byMeaning };
    }

    /**
     * The newest thing an agent said about each cluster on this page.
     *
     * Newest only: a run that changed its mind, or a second agent, should show
     * what is true now rather than a history the queue has no room for. The
     * whole history is in the ledger for anyone who wants it.
     */
    private async verdictsFor(
        clusterIds: number[],
    ): Promise<Map<number, AdminVerdict>> {
        const found = new Map<number, AdminVerdict>();

        if (!clusterIds.length) {
            return found;
        }

        const rows = await this.sequelize.query<{
            cluster_id: number;
            agent: string | null;
            confidence: number | null;
            note: string | null;
            reason: string;
            created_at: Date;
        }>(
            `SELECT DISTINCT ON (COALESCE(vn."cluster_id", vm."cluster_id"))
                    COALESCE(vn."cluster_id", vm."cluster_id") AS cluster_id,
                    a."name" AS agent,
                    v."confidence", v."note", v."reason", v."created_at"
             FROM "verifications" v
             LEFT JOIN "names" vn ON vn."id" = v."name_id"
             LEFT JOIN "meanings" vm ON vm."id" = v."meaning_id"
             LEFT JOIN "agents" a ON a."id" = v."agent_id"
             WHERE v."agent_id" IS NOT NULL
               AND COALESCE(vn."cluster_id", vm."cluster_id") IN (:clusterIds)
             ORDER BY COALESCE(vn."cluster_id", vm."cluster_id"),
                      v."created_at" DESC, v."id" DESC`,
            { type: QueryTypes.SELECT, replacements: { clusterIds } },
        );

        for (const row of rows) {
            found.set(row.cluster_id, {
                // Null only if the agent was removed after it decided; the
                // ledger nulls the reference rather than losing the verdict.
                agent: row.agent ?? 'an agent since removed',
                confidence: row.confidence,
                note: row.note,
                abstained: row.reason === 'abstained',
                unchanged: row.reason === 'unchanged',
                considered: row.reason === 'considered',
                at: row.created_at.toISOString(),
            });
        }

        return found;
    }

    /**
     * What each agent said it would write for a cluster, one entry per agent.
     *
     * `DISTINCT ON (cluster, agent)` because an agent asked twice has answered
     * twice and only its latest word is worth showing — but every *agent* is,
     * which is the whole point: one proposal is an opinion, and two that agree
     * are the strongest thing the catalogue can say about a name nobody has
     * written a meaning for.
     */
    private async proposalsFor(
        clusterIds: number[],
    ): Promise<Map<number, AdminProposal[]>> {
        const found = new Map<number, AdminProposal[]>();

        if (!clusterIds.length) {
            return found;
        }

        const rows = await this.sequelize.query<{
            cluster_id: number;
            agent: string | null;
            confidence: number | null;
            proposed: string;
            written: boolean;
        }>(
            `SELECT DISTINCT ON (
                    COALESCE(vn."cluster_id", vm."cluster_id"), v."agent_id"
                )
                    COALESCE(vn."cluster_id", vm."cluster_id") AS cluster_id,
                    a."name" AS agent, v."confidence", v."proposed",
                    (vm."text" = v."proposed") AS written
             FROM "verifications" v
             LEFT JOIN "names" vn ON vn."id" = v."name_id"
             LEFT JOIN "meanings" vm ON vm."id" = v."meaning_id"
             LEFT JOIN "agents" a ON a."id" = v."agent_id"
             WHERE v."agent_id" IS NOT NULL
               AND v."proposed" IS NOT NULL
               AND COALESCE(vn."cluster_id", vm."cluster_id") IN (:clusterIds)
             ORDER BY COALESCE(vn."cluster_id", vm."cluster_id"), v."agent_id",
                      v."created_at" DESC, v."id" DESC`,
            { type: QueryTypes.SELECT, replacements: { clusterIds } },
        );

        for (const row of rows) {
            found.set(row.cluster_id, [
                ...(found.get(row.cluster_id) ?? []),
                {
                    agent: row.agent ?? 'an agent since removed',
                    confidence: row.confidence,
                    text: row.proposed,
                    // A reading the agent wrote into the catalogue was above
                    // the bar by construction — below it, it abstains and
                    // writes nothing. Runs before 0021 recorded no confidence
                    // for those, and reading the absence as "unsure" would
                    // grey out the surest proposals there are.
                    confident:
                        row.written ||
                        (row.confidence ?? 0) >= CONFIDENT_ENOUGH,
                },
            ]);
        }

        // Most sure first, so two that agree sit together at the top. One that
        // was acted on but never scored sorts with the confident rather than
        // below every abstention.
        const sureness = ({ confidence, confident }: AdminProposal): number =>
            confidence ?? (confident ? CONFIDENT_ENOUGH : 0);

        for (const list of found.values()) {
            list.sort((a, b) => sureness(b) - sureness(a));
        }

        return found;
    }

    private async sourceSlugs(): Promise<Map<number, string>> {
        const rows = (await this.sources.findAll({
            attributes: ['id', 'slug'],
            raw: true,
        })) as unknown as Array<Pick<ISource, 'id' | 'slug'>>;

        return new Map(rows.map(({ id, slug }) => [id, slug]));
    }
}
