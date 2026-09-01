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
 * One name as a source gives it.
 *
 * `religion` and `language` are the lookup slugs the catalogue already filters
 * on — `hindu`, `tamil` — and one the lookups do not hold is reported rather
 * than created: which religions the catalogue carries is a decision, not
 * something a file gets to make in passing.
 *
 * Both are required, though most of the catalogue's own rows never recorded a
 * language. The site filters and shows them, so a row missing one is a row it
 * cannot display properly, and the import inheriting that gap is no reason to
 * keep adding to it.
 */
export const ImportNameSchema = z.object({
    name: text(255),
    gender: z.enum(GENDERS),
    religion: text(64),
    language: text(64),
    meanings: z.array(text(2000)).default([]),
    /** What the source recorded that no column holds. */
    notes: text(1000).nullish(),
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
