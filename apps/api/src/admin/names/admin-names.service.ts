import { Inject, Injectable } from '@nestjs/common';
import {
    AdminClustersPage,
    AdminMeaning,
    AdminMeaningsUpdate,
    AdminNamesQuery,
    AdminStatusUpdate,
    NAME_STATUSES,
} from '@tbn/shared';
import { Op, Sequelize, Transaction } from 'sequelize';

import {
    CLUSTERS_MODEL,
    MEANINGS_MODEL,
    NAMES_MODEL,
    SEQUELIZE,
    SOURCES_MODEL,
    VERIFICATIONS_MODEL,
} from '../../database/database.constants.js';
import { LookupsService } from '../../database/lookups.service.js';
import {
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
        });

        const members = await this.membersFor(
            rows.map(({ dataValues }) => dataValues.id),
        );

        const [meanings, slugs, labels] = await Promise.all([
            this.meaningsFor([...members.values()].flat().map(({ id }) => id)),
            this.sourceSlugs(),
            this.lookups.labels(),
        ]);

        const slug = labelReader(slugs);
        const religion = labelReader(labels.religions);
        const language = labelReader(labels.languages);

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
                    })),
                    // Pooled across the cluster's rows and re-sorted: gathering
                    // them row by row would order by row before status.
                    meanings: rowsHere
                        .flatMap((row) => meanings.get(row.id) ?? [])
                        .sort(byStatusThenId)
                        .map(({ sourceId, ...meaning }) => ({
                            ...meaning,
                            source: slug(sourceId),
                        })),
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

    private async sourceSlugs(): Promise<Map<number, string>> {
        const rows = (await this.sources.findAll({
            attributes: ['id', 'slug'],
            raw: true,
        })) as unknown as Array<Pick<ISource, 'id' | 'slug'>>;

        return new Map(rows.map(({ id, slug }) => [id, slug]));
    }
}
