import {
    firstSyllable,
    ImportFileInput,
    ImportNameSchema,
    ImportSourceInput,
    sortKey,
} from '@tbn/shared';
import { Sequelize, Transaction } from 'sequelize';

import { numerologyOf } from '../names/numerology-backfill.service.js';
import {
    ClustersModel,
    ILookup,
    ISource,
    LookupModel,
    MeaningsModel,
    NamesModel,
    SourcesModel,
} from './models.js';

export interface ImporterModels {
    sequelize: Sequelize;
    names: NamesModel;
    meanings: MeaningsModel;
    clusters: ClustersModel;
    sources: SourcesModel;
    religions: LookupModel;
    languages: LookupModel;
}

/** A record the import would not take, and what was wrong with it. */
export interface ImportRejection {
    /** Its position in the file, which is the only handle a bad record has. */
    at: number;
    name: string | null;
    reason: string;
}

export interface ImportReport {
    source: string;
    clusters: number;
    names: number;
    meanings: number;
    /** Records the catalogue already held in full. */
    unchanged: number;
    rejected: ImportRejection[];
}

export interface ImportOptions {
    /** Of the file, so a source row records which batch its rows came from. */
    checksum?: string;
    /** Reports what would happen and rolls back, writing nothing. */
    dryRun?: boolean;
}

/** Rolls a dry run back without letting a real failure look like one. */
class DryRun extends Error {
    constructor(readonly report: ImportReport) {
        super('dry run');
    }
}

/** For a rejection to name the record before it is known to have a name. */
const nameOf = (record: unknown): string | null => {
    const name = (record as { name?: unknown })?.name;

    return typeof name === 'string' ? name : null;
};

const slugged = async (
    model: LookupModel,
    transaction: Transaction,
): Promise<Map<string, ILookup>> => {
    const rows = (await model.findAll({
        transaction,
        raw: true,
    })) as unknown as ILookup[];

    return new Map(rows.map((row) => [row.slug, row]));
};

/**
 * Adds names and their readings to the catalogue, from a file a source hands
 * over.
 *
 * Nothing it writes is published. A name arrives as a `candidate` row carrying
 * `candidate` readings and stays there until a reviewer decides, which is what
 * the queue and the ledger are for — and the reason an import can be run
 * against a live catalogue without changing a word of what the site shows.
 *
 * Everything lands in one transaction, so a file that fails half way through
 * leaves nothing behind. Re-running the same file writes nothing: a record is
 * matched by its cluster and its source, and a reading by its text across the
 * whole cluster, because publishing is per cluster and a second copy of a text
 * already there is only something for a reviewer to dismiss.
 *
 * Twin pairs are not imported. A pair is a different subject with its own
 * columns, and no source has offered one.
 */
export const importNames = async (
    models: ImporterModels,
    file: ImportFileInput,
    options: ImportOptions = {},
): Promise<ImportReport> => {
    try {
        return await models.sequelize.transaction(async (transaction) => {
            const report = await write(models, file, options, transaction);

            if (options.dryRun) {
                throw new DryRun(report);
            }

            return report;
        });
    } catch (error) {
        if (error instanceof DryRun) {
            return error.report;
        }

        throw error;
    }
};

const write = async (
    models: ImporterModels,
    file: ImportFileInput,
    { checksum }: ImportOptions,
    transaction: Transaction,
): Promise<ImportReport> => {
    const source = await resolveSource(
        models.sources,
        file.source,
        checksum ?? null,
        transaction,
    );

    const religions = await slugged(models.religions, transaction);
    const languages = await slugged(models.languages, transaction);

    const report: ImportReport = {
        source: file.source.slug,
        clusters: 0,
        names: 0,
        meanings: 0,
        unchanged: 0,
        rejected: [],
    };

    // Both caches also hold what this run has written, so two records of one
    // name in a single file meet each other rather than the database.
    const clusterIds = new Map<string, number>();
    const readings = new Map<number, Set<string>>();

    for (const [at, record] of file.names.entries()) {
        const parsed = ImportNameSchema.safeParse(record);

        if (!parsed.success) {
            report.rejected.push({
                at,
                name: nameOf(record),
                reason: parsed.error.issues
                    .map(
                        ({ path, message }) =>
                            `${path.join('.') || 'record'}: ${message}`,
                    )
                    .join('; '),
            });

            continue;
        }

        const { name, gender, meanings, notes } = parsed.data;
        const religion = religions.get(parsed.data.religion);
        const language = languages.get(parsed.data.language);

        if (!religion || !language) {
            report.rejected.push({
                at,
                name,
                reason: religion
                    ? `unknown language "${parsed.data.language}"`
                    : `unknown religion "${parsed.data.religion}"`,
            });

            continue;
        }

        const key = `${gender} ${name}`;
        let clusterId = clusterIds.get(key);

        if (clusterId === undefined) {
            const [cluster, made] = await models.clusters.findOrCreate({
                where: { name, gender },
                // Falls back to the name where the transliteration has nothing
                // to say, which is what 0006 put there and 0010 kept.
                defaults: { name, gender, sortKey: sortKey(name) || name },
                transaction,
            });

            clusterId = cluster.dataValues.id;
            clusterIds.set(key, clusterId);
            report.clusters += made ? 1 : 0;
        }

        // By cluster and source rather than by name: a source filing a name
        // twice is describing one row, and another source's row is its own.
        const existing = await models.names.findOne({
            where: { clusterId, sourceId: source.id },
            transaction,
        });

        const row =
            existing ??
            (await models.names.create(
                {
                    name,
                    gender,
                    religion: religion.name,
                    language: language.name,
                    firstLetter: firstSyllable(name),
                    numerology: numerologyOf(name),
                    sourceId: source.id,
                    clusterId,
                    religionId: religion.id,
                    languageId: language.id,
                    notes: notes ?? null,
                    status: 'candidate',
                },
                { transaction },
            ));

        report.names += existing ? 0 : 1;

        const known = await textsOf(models, clusterId, readings, transaction);
        // Deduplicated against itself as well as against the cluster: a source
        // that repeats a reading inside one record is still saying it once.
        const fresh = [...new Set(meanings)].filter((text) => !known.has(text));

        if (!fresh.length) {
            report.unchanged += existing ? 1 : 0;

            continue;
        }

        await models.meanings.bulkCreate(
            fresh.map((text) => ({
                nameId: row.dataValues.id,
                text,
                sourceId: source.id,
                status: 'candidate' as const,
            })),
            { transaction },
        );

        for (const text of fresh) {
            known.add(text);
        }

        report.meanings += fresh.length;
    }

    return report;
};

/** Every text the cluster already holds, whatever its status or its source. */
const textsOf = async (
    models: ImporterModels,
    clusterId: number,
    cache: Map<number, Set<string>>,
    transaction: Transaction,
): Promise<Set<string>> => {
    const cached = cache.get(clusterId);

    if (cached) {
        return cached;
    }

    const rows = await models.meanings.findAll({
        where: { clusterId },
        attributes: ['text'],
        transaction,
    });

    const texts = new Set(rows.map(({ dataValues }) => dataValues.text));

    cache.set(clusterId, texts);

    return texts;
};

/**
 * The source row, created on first sight and re-stamped after that: the
 * checksum and `scanned_at` describe the batch being imported now, not the
 * first file the slug ever named.
 */
const resolveSource = async (
    sources: SourcesModel,
    draft: ImportSourceInput,
    checksum: string | null,
    transaction: Transaction,
): Promise<ISource> => {
    const [row] = await sources.findOrCreate({
        where: { slug: draft.slug },
        defaults: { slug: draft.slug, kind: draft.kind },
        transaction,
    });

    await sources.update(
        {
            kind: draft.kind,
            title: draft.title ?? null,
            version: draft.version ?? null,
            checksum,
            scannedAt: new Date(),
            ...(draft.trust === undefined ? {} : { trust: draft.trust }),
        },
        { where: { id: row.dataValues.id }, transaction },
    );

    return row.dataValues;
};
