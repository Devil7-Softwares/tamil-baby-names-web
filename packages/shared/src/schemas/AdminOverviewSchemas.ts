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

/** What one agent's recorded runs have cost, all told. */
export const AdminAgentSpendSchema = z.object({
    agent: z.string(),
    runs: Count,
    inputTokens: Count,
    outputTokens: Count,
    /** US dollars, over the runs that had a price. */
    cost: z.number().nonnegative(),
    /** Runs that recorded tokens while the agent had no price. */
    unpriced: Count,
});

export const AdminSpendSchema = z.object({
    total: z.number().nonnegative(),
    agents: z.array(AdminAgentSpendSchema),
    /** Runs from before tokens were recorded, which no total can include. */
    unrecorded: Count,
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
    spend: AdminSpendSchema,
});

export type AdminAgentSpend = z.infer<typeof AdminAgentSpendSchema>;
export type AdminSpend = z.infer<typeof AdminSpendSchema>;
export type AdminStatusCounts = z.infer<typeof AdminStatusCountsSchema>;
export type AdminActivity = z.infer<typeof AdminActivitySchema>;
export type AdminOverview = z.infer<typeof AdminOverviewSchema>;
