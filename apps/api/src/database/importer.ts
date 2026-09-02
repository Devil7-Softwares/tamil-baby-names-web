import {
    firstSyllable,
    ImportFileInput,
    ImportNameSchema,
    ImportReport,
    ImportSourceInput,
    sortKey,
} from '@tbn/shared';
import { Op, Sequelize, Transaction } from 'sequelize';

import { numerologyOf } from '../names/numerology-backfill.service.js';
import {
    AttestationDraft,
    AttestationsModel,
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
    attestations: AttestationsModel;
    religions: LookupModel;
    languages: LookupModel;
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

/**
 * Which side of the arc a citation is on, written the same way for a draft and
 * for a row read back, so an absent id and a null one are one key.
 */
const subjectKey = ({
    nameId,
    meaningId,
}: {
    nameId?: number | null;
    meaningId?: number | null;
}): string => `${nameId ?? '-'}:${meaningId ?? '-'}`;

/** For a rejection to name the record before it is known to have a name. */
const nameOf = (record: unknown): string | null => {
    const name = (record as { name?: unknown })?.name;

    return typeof name === 'string' ? name : null;
};

/**
 * The lookup row a slug names, `null` where the source filed the record under
 * nothing, and `undefined` where it named a bucket the catalogue does not
 * carry — which is the one of the three that is a rejection.
 */
const filed = (
    slug: string | null | undefined,
    lookup: Map<string, ILookup>,
): ILookup | null | undefined =>
    slug === null || slug === undefined ? null : lookup.get(slug);

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
        attestations: 0,
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

        const { name, gender, meanings, notes, attestation } = parsed.data;
        const religion = filed(parsed.data.religion, religions);
        const language = filed(parsed.data.language, languages);

        if (religion === undefined || language === undefined) {
            report.rejected.push({
                at,
                name,
                reason:
                    religion === undefined
                        ? `unknown religion "${parsed.data.religion}"`
                        : `unknown language "${parsed.data.language}"`,
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
                    religion: religion?.name ?? null,
                    language: language?.name ?? null,
                    firstLetter: firstSyllable(name),
                    numerology: numerologyOf(name),
                    sourceId: source.id,
                    clusterId,
                    religionId: religion?.id ?? null,
                    languageId: language?.id ?? null,
                    notes: notes ?? null,
                    status: 'candidate',
                },
                { transaction },
            ));

        const added = existing ? 0 : 1;

        report.names += added;

        const known = await textsOf(models, clusterId, readings, transaction);
        // Deduplicated against itself as well as against the cluster: a source
        // that repeats a reading inside one record is still saying it once.
        const wanted = [...new Set(meanings)];
        const fresh = wanted.filter((text) => !known.has(text));

        if (fresh.length) {
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

        const cited = attestation
            ? await cite(
                  models,
                  {
                      sourceId: source.id,
                      nameId: row.dataValues.id,
                      clusterId,
                      texts: wanted,
                      ...attestation,
                  },
                  transaction,
              )
            : 0;

        report.attestations += cited;

        // Nothing at all: no row, no reading, no citation. Which is what a
        // second run of the same file should report for every record in it.
        if (!added && !fresh.length && !cited) {
            report.unchanged += 1;
        }
    }

    return report;
};

/**
 * Cites the row and every reading of the record, and says how many citations
 * were new.
 *
 * The readings are found by text across the cluster rather than by the ids this
 * run wrote, so a source landing on a reading another source already published
 * cites *that* row. Two sources agreeing is the opposite of a duplicate — it is
 * the strongest thing the catalogue can say about a reading — and it is only
 * visible if both citations reach the same row.
 */
const cite = async (
    models: ImporterModels,
    subject: {
        sourceId: number;
        nameId: number;
        clusterId: number;
        texts: string[];
        locator: string;
        excerpt?: string | null;
    },
    transaction: Transaction,
): Promise<number> => {
    const { sourceId, nameId, clusterId, texts, locator } = subject;
    const excerpt = subject.excerpt ?? null;

    const readings = texts.length
        ? await models.meanings.findAll({
              where: { clusterId, text: { [Op.in]: texts } },
              attributes: ['id'],
              transaction,
          })
        : [];

    const drafts: AttestationDraft[] = [
        { nameId, sourceId, locator, excerpt },
        ...readings.map(({ dataValues }) => ({
            meaningId: dataValues.id,
            sourceId,
            locator,
            excerpt,
        })),
    ];

    // Counted by what is missing rather than by what the insert returns:
    // `ignoreDuplicates` cannot say which rows it skipped.
    const already = await models.attestations.findAll({
        where: {
            sourceId,
            locator,
            [Op.or]: [
                { nameId },
                {
                    meaningId: {
                        [Op.in]: readings.map((r) => r.dataValues.id),
                    },
                },
            ],
        },
        attributes: ['nameId', 'meaningId'],
        transaction,
    });

    const cited = new Set(
        already.map(({ dataValues }) => subjectKey(dataValues)),
    );
    const missing = drafts.filter((draft) => !cited.has(subjectKey(draft)));

    if (missing.length) {
        await models.attestations.bulkCreate(missing, {
            ignoreDuplicates: true,
            transaction,
        });
    }

    return missing.length;
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
