import { z } from 'zod';

import { GENDERS } from '../types/Gender.js';
import { NAME_STATUSES } from '../types/NameStatus.js';

/**
 * One `attestations` row, as the queue shows it: where a source said this and
 * the words it used. A reading two sources agree on carries one of these each,
 * which is the point of showing them.
 */
export const AdminCitationSchema = z.object({
    id: z.number().int().positive(),
    source: z.string().nullable(),
    locator: z.string(),
    excerpt: z.string().nullable(),
});

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
 *
 * Religion and language are null where the import never recorded one, which is
 * most of the catalogue's languages.
 */
export const AdminClusterMemberSchema = z.object({
    id: z.number().int().positive(),
    religion: z.string().nullable(),
    language: z.string().nullable(),
    status: z.enum(NAME_STATUSES),
    source: z.string().nullable(),
    /** What the import recorded that no column could hold. */
    notes: z.string().nullable(),
    /** Where each source listed this spelling. */
    citations: z.array(AdminCitationSchema),
});

/**
 * A reading with the evidence behind it. The queue carries this; a review's
 * response carries the bare reading, because nothing it changes is evidence.
 */
export const AdminCitedMeaningSchema = AdminMeaningSchema.extend({
    citations: z.array(AdminCitationSchema),
});

/**
 * What an agent last said about a cluster. This is what "reviewed by AI" is:
 * not a flag on a name, but the newest entry an agent wrote in the ledger about
 * anything in that cluster.
 */
export const AdminVerdictSchema = z.object({
    agent: z.string(),
    /** The agent's own 0–100. Read it sceptically; see `abstained`. */
    confidence: z.number().int().min(0).max(100).nullable(),
    note: z.string().nullable(),
    /** It looked and would not decide: below the bar, and worth a person. */
    abstained: z.boolean(),
    /** It was sure, and found the catalogue already right. Needs nobody. */
    unchanged: z.boolean(),
    /**
     * It decided, on a run that was told to write nothing. The catalogue is
     * untouched and the verdict is only an opinion — which is a different thing
     * from both of the above, and the queue must not read it as "changed this".
     */
    considered: z.boolean(),
    at: z.string(),
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
    meanings: z.array(AdminCitedMeaningSchema),
    /** Null where no agent has looked at this cluster yet. */
    verdict: AdminVerdictSchema.nullable(),
});

/**
 * A flag that survives the round trip as a query string. `z.coerce.boolean()`
 * cannot: it reads the string "false" as true.
 */
const BooleanParam = z.union([z.boolean(), z.stringbool()]);

export const AGENT_REVIEW_FILTERS = [
    'decided',
    'unsure',
    'unchanged',
    'considered',
    'none',
] as const;

export type AgentReviewFilter = (typeof AGENT_REVIEW_FILTERS)[number];

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
    /**
     * The second pass. `decided` is what an agent changed and a person has not
     * checked; `unsure` is what it looked at and would not decide, which is
     * where a person is worth most; `none` is the backlog no agent has reached.
     */
    agentReview: z.enum(AGENT_REVIEW_FILTERS).optional(),
    /**
     * Only clusters an agent was at most this sure of. A small model's
     * confidence runs high, so this is the dial that finds the ones to re-read.
     */
    maxConfidence: z.coerce.number().int().min(0).max(100).optional(),
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

export type AdminCitation = z.infer<typeof AdminCitationSchema>;
export type AdminVerdict = z.infer<typeof AdminVerdictSchema>;
export type AdminMeaning = z.infer<typeof AdminMeaningSchema>;
export type AdminCitedMeaning = z.infer<typeof AdminCitedMeaningSchema>;
export type AdminClusterMember = z.infer<typeof AdminClusterMemberSchema>;
export type AdminCluster = z.infer<typeof AdminClusterSchema>;
export type AdminNamesQuery = z.infer<typeof AdminNamesQuerySchema>;
export type AdminClustersPage = z.infer<typeof AdminClustersPageSchema>;
export type AdminStatusUpdate = z.infer<typeof AdminStatusUpdateSchema>;
export type AdminMeaningsUpdate = z.infer<typeof AdminMeaningsUpdateSchema>;
