import { z } from 'zod';

import { NAME_STATUSES } from '../types/NameStatus.js';
import { VERIFICATION_REASONS } from '../types/VerificationReason.js';

const Count = z.number().int().nonnegative();

/** How much of the catalogue sits at each status. */
export const AdminStatusCountsSchema = z.object({
    published: Count,
    candidate: Count,
    rejected: Count,
});

/**
 * One entry from the verification ledger, named rather than numbered: a
 * reviewer reads what was decided, not which row id it was decided on.
 */
export const AdminActivitySchema = z.object({
    id: z.number().int().positive(),
    kind: z.enum(['name', 'meaning']),
    /** Null only if the subject went away between the two reads. */
    subject: z.string().nullable(),
    fromStatus: z.enum(NAME_STATUSES),
    toStatus: z.enum(NAME_STATUSES),
    reason: z.enum(VERIFICATION_REASONS),
    /** Null for a removed account, and for whatever the pipeline decides. */
    actor: z.string().nullable(),
    at: z.iso.datetime(),
});

export const AdminOverviewSchema = z.object({
    names: AdminStatusCountsSchema,
    meanings: AdminStatusCountsSchema,
    clusters: z.object({
        total: Count,
        /** Clusters the import filed more than once, which is the work queue. */
        duplicated: Count,
    }),
    activity: z.array(AdminActivitySchema),
});

export type AdminStatusCounts = z.infer<typeof AdminStatusCountsSchema>;
export type AdminActivity = z.infer<typeof AdminActivitySchema>;
export type AdminOverview = z.infer<typeof AdminOverviewSchema>;
