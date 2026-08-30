import { z } from 'zod';

import { GENDERS } from '../types/Gender.js';
import { NAME_STATUSES } from '../types/NameStatus.js';

/** One reading of a name, as the review queue shows it. */
export const AdminMeaningSchema = z.object({
    id: z.number().int().positive(),
    text: z.string(),
    status: z.enum(NAME_STATUSES),
    source: z.string().nullable(),
});

export const AdminNameSchema = z.object({
    id: z.number().int().positive(),
    name: z.string(),
    gender: z.string(),
    religion: z.string(),
    language: z.string(),
    status: z.enum(NAME_STATUSES),
    source: z.string().nullable(),
    meanings: z.array(AdminMeaningSchema),
    /** How many rows carry this same name, this one included. */
    duplicates: z.number().int().positive(),
});

/**
 * A flag that survives the round trip as a query string. `z.coerce.boolean()`
 * cannot: it reads the string "false" as true.
 */
const BooleanParam = z.union([z.boolean(), z.stringbool()]);

export const AdminNamesQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    status: z.enum(NAME_STATUSES).optional(),
    gender: z.enum(GENDERS).optional(),
    search: z.string().trim().max(255).optional(),
    /**
     * Only names the catalogue holds more than once. These are the rows worth
     * a reviewer's time: the import filed them separately and their meanings
     * disagree.
     */
    duplicatesOnly: BooleanParam.optional(),
});

export const AdminNamesPageSchema = z.object({
    items: z.array(AdminNameSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
});

export type AdminMeaning = z.infer<typeof AdminMeaningSchema>;
export type AdminName = z.infer<typeof AdminNameSchema>;
export type AdminNamesQuery = z.infer<typeof AdminNamesQuerySchema>;
export type AdminNamesPage = z.infer<typeof AdminNamesPageSchema>;
