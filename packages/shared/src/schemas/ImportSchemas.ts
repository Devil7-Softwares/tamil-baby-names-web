import { z } from 'zod';

import { GENDERS } from '../types/Gender.js';

/**
 * Composed once because every text a source hands over is treated the same
 * way: trimmed, bounded, and normalised so two spellings that look identical
 * compare identical. Without the normalisation a decomposed அ would import
 * beside a composed one as a second, invisible reading.
 */
const text = (max: number) =>
    z
        .string()
        .trim()
        .min(1)
        .max(max)
        .transform((value) => value.normalize('NFC'));

/** Where a batch came from. Recorded on every row and reading it writes. */
export const ImportSourceSchema = z.object({
    slug: text(64),
    kind: text(64).default('file'),
    title: text(255).nullish(),
    /** The source's own edition, so a later batch can be told from this one. */
    version: text(255).nullish(),
    trust: z.number().int().min(0).max(100).optional(),
});

/**
 * Where in the source the record was found. `locator` is whatever lets somebody
 * go and check — a URL, a page number, a record id — and `excerpt` is the
 * source's own words, so a reviewer can read what a reading is based on rather
 * than trusting the source's name.
 */
export const ImportAttestationSchema = z.object({
    locator: text(2000),
    excerpt: text(4000).nullish(),
});

/**
 * One name as a source gives it.
 *
 * `religion` and `language` are the lookup slugs the catalogue already filters
 * on — `hindu`, `tamil` — and one the lookups do not hold is reported rather
 * than created: which religions the catalogue carries is a decision, not
 * something a file gets to make in passing.
 *
 * Both are optional, because plenty of sources are simply a list of names and
 * do not file them at all. Omitting one lands the row unfiled, which is a
 * question for the queue rather than a gap in the catalogue: nothing imported
 * is published, so the site never has to display a row with no religion. A
 * source that does say is taken at its word; one that does not is not guessed
 * at on its behalf.
 */
export const ImportNameSchema = z.object({
    name: text(255),
    gender: z.enum(GENDERS),
    religion: text(64).nullish(),
    language: text(64).nullish(),
    meanings: z.array(text(2000)).default([]),
    /** What the source recorded that no column holds. */
    notes: text(1000).nullish(),
    attestation: ImportAttestationSchema.nullish(),
});

/**
 * Records stay `unknown` here so that one malformed row is reported by name
 * instead of refusing the whole file. The importer parses them one at a time.
 */
export const ImportFileSchema = z.object({
    source: ImportSourceSchema,
    names: z.array(z.unknown()).min(1),
});

export type ImportSourceInput = z.output<typeof ImportSourceSchema>;
export type ImportNameInput = z.output<typeof ImportNameSchema>;
export type ImportFileInput = z.output<typeof ImportFileSchema>;

/** A record the import would not take, and what was wrong with it. */
export const ImportRejectionSchema = z.object({
    /** Its position in the file, which is the only handle a bad record has. */
    at: z.number().int().min(0),
    name: z.string().nullable(),
    reason: z.string(),
});

/** What an import did, as the CLI prints it and the dashboard shows it. */
export const ImportReportSchema = z.object({
    source: z.string(),
    clusters: z.number().int().min(0),
    names: z.number().int().min(0),
    meanings: z.number().int().min(0),
    /** Citations written, which a record without one contributes none of. */
    attestations: z.number().int().min(0),
    /** Records the catalogue already held in full. */
    unchanged: z.number().int().min(0),
    rejected: z.array(ImportRejectionSchema),
});

/**
 * Roughly 5 MB, which is thousands of names. A batch bigger than this belongs
 * on the command line, where nothing has to hold it in a browser first.
 */
export const IMPORT_LIMIT = 5_000_000;

/**
 * A batch as the dashboard sends it: the file's own text rather than a parsed
 * object, so the checksum recorded against the source is over the bytes the
 * file actually holds — the same one the command line computes for it.
 */
export const ImportRequestSchema = z.object({
    content: z.string().min(1).max(IMPORT_LIMIT),
    /** Reports what would happen and rolls it back, writing nothing. */
    dryRun: z.boolean().default(false),
});

export type ImportAttestationInput = z.output<typeof ImportAttestationSchema>;
export type ImportRejection = z.output<typeof ImportRejectionSchema>;
export type ImportReport = z.output<typeof ImportReportSchema>;
export type ImportRequest = z.output<typeof ImportRequestSchema>;
