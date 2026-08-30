import { Inject, Injectable } from '@nestjs/common';
import { AdminMeaning, AdminNamesPage, AdminNamesQuery } from '@tbn/shared';
import { col, fn, Op } from 'sequelize';

import {
    MEANINGS_MODEL,
    NAMES_MODEL,
    SOURCES_MODEL,
} from '../../database/database.constants.js';
import {
    ISource,
    MeaningsModel,
    NamesModel,
    SourcesModel,
} from '../../database/models.js';
import { SortCollationService } from '../../database/sort-collation.service.js';
import { adminNamesWhere } from './admin-names.query.js';

/** A meaning before its source id is resolved to the slug the client sees. */
type StoredMeaning = Omit<AdminMeaning, 'source'> & { sourceId: number | null };

@Injectable()
export class AdminNamesService {
    constructor(
        @Inject(NAMES_MODEL) private readonly names: NamesModel,
        @Inject(MEANINGS_MODEL) private readonly meanings: MeaningsModel,
        @Inject(SOURCES_MODEL) private readonly sources: SourcesModel,
        private readonly sortCollation: SortCollationService,
    ) {}

    async list(query: AdminNamesQuery): Promise<AdminNamesPage> {
        const { rows, count } = await this.names.findAndCountAll({
            where: adminNamesWhere(query),
            order: this.sortCollation.order(['name']),
            offset: (query.page - 1) * query.limit,
            limit: query.limit,
        });

        const ids = rows.map(({ dataValues }) => dataValues.id);

        const [meanings, duplicates, slugs] = await Promise.all([
            this.meaningsFor(ids),
            this.duplicateCounts(rows.map(({ dataValues }) => dataValues.name)),
            this.sourceSlugs(),
        ]);

        return {
            items: rows.map(({ dataValues: row }) => ({
                id: row.id,
                name: row.name,
                gender: row.gender,
                religion: row.religion,
                language: row.language,
                status: row.status,
                source: row.sourceId ? (slugs.get(row.sourceId) ?? null) : null,
                meanings: (meanings.get(row.id) ?? []).map(
                    ({ sourceId, ...meaning }) => ({
                        ...meaning,
                        source: sourceId ? (slugs.get(sourceId) ?? null) : null,
                    }),
                ),
                duplicates: duplicates.get(row.name) ?? 1,
            })),
            total: count,
            page: query.page,
            limit: query.limit,
        };
    }

    /**
     * Every reading of the names on this page, published first: the enum is
     * declared published, candidate, rejected, which is the order a reviewer
     * wants to read them in.
     */
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
            const list = byName.get(nameId) ?? [];

            list.push({
                id: dataValues.id,
                text: dataValues.text,
                status: dataValues.status,
                sourceId: dataValues.sourceId,
            });

            byName.set(nameId, list);
        }

        return byName;
    }

    /** How many rows each of these names occupies, so the page can flag them. */
    private async duplicateCounts(
        names: string[],
    ): Promise<Map<string, number>> {
        if (!names.length) {
            return new Map();
        }

        const rows = await this.names.findAll({
            attributes: ['name', [fn('count', col('id')), 'count']],
            where: { name: { [Op.in]: [...new Set(names)] } },
            group: ['name'],
            raw: true,
        });

        return new Map(
            (rows as unknown as Array<{ name: string; count: string }>).map(
                ({ name, count }) => [name, Number(count)],
            ),
        );
    }

    private async sourceSlugs(): Promise<Map<number, string>> {
        const rows = (await this.sources.findAll({
            attributes: ['id', 'slug'],
            raw: true,
        })) as unknown as Array<Pick<ISource, 'id' | 'slug'>>;

        return new Map(rows.map(({ id, slug }) => [id, slug]));
    }
}
