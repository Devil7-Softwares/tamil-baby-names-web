import { z } from 'zod';

import { GENDERS } from '../types/Gender.js';
import { NAME_STATUSES } from '../types/NameStatus.js';

/** One reading of a name, as the review queue shows it. */
export const AdminMeaningSchema = z.object({
    id: z.number().int().positive(),
    text: z.string(),
    status: z.enum(NAME_STATUSES),
    source: z.string().nullable(),
    /** The row this reading belongs to, and the one publishing it wins. */
    nameId: z.number().int().positive().nullable(),
});

/**
 * One catalogue row inside a cluster. The spelling and gender live on the
 * cluster; what stays here is what the import filed differently row by row.
 */
export const AdminClusterMemberSchema = z.object({
    id: z.number().int().positive(),
    religion: z.string(),
    language: z.string(),
    status: z.enum(NAME_STATUSES),
    source: z.string().nullable(),
});

export const AdminClusterSchema = z.object({
    id: z.number().int().positive(),
    name: z.string(),
    gender: z.string(),
    members: z.array(AdminClusterMemberSchema),
    /**
     * Every reading across the cluster's rows. A cluster the import filed more
     * than once is where the readings disagree, which is the whole reason to
     * look at it.
     */
    meanings: z.array(AdminMeaningSchema),
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
     * Only clusters the import filed more than once. These are the ones worth
     * a reviewer's time: their readings are the ones that disagree.
     */
    duplicatesOnly: BooleanParam.optional(),
});

export const AdminClustersPageSchema = z.object({
    items: z.array(AdminClusterSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
});

/** The id travels in the path, so it arrives as a string whatever sent it. */
export const AdminStatusUpdateSchema = z.object({
    id: z.coerce.number().int().positive(),
    status: z.enum(NAME_STATUSES),
});

/**
 * Every reading a meaning review changed. Publishing one returns the reading it
 * displaced as well: only one reading of a name may be published, so the
 * incumbent goes back to the pool rather than being rejected on its behalf.
 */
export const AdminMeaningsUpdateSchema = z.object({
    meanings: z.array(AdminMeaningSchema),
});

export type AdminMeaning = z.infer<typeof AdminMeaningSchema>;
export type AdminClusterMember = z.infer<typeof AdminClusterMemberSchema>;
export type AdminCluster = z.infer<typeof AdminClusterSchema>;
export type AdminNamesQuery = z.infer<typeof AdminNamesQuerySchema>;
export type AdminClustersPage = z.infer<typeof AdminClustersPageSchema>;
export type AdminStatusUpdate = z.infer<typeof AdminStatusUpdateSchema>;
export type AdminMeaningsUpdate = z.infer<typeof AdminMeaningsUpdateSchema>;
