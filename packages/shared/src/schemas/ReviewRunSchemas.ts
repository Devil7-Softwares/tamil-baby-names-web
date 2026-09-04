import { z } from 'zod';

import { REVIEW_RUN_STATUSES } from '../types/ReviewRunStatus.js';

/** A run as the dashboard watches it. */
export const AdminReviewRunSchema = z.object({
    id: z.number().int().positive(),
    agentId: z.number().int().positive(),
    /** The agent's display name, so the row reads without a second lookup. */
    agent: z.string(),
    status: z.enum(REVIEW_RUN_STATUSES),
    requested: z.number().int().nonnegative(),
    /** What the queue actually held, which is what the progress bar is over. */
    total: z.number().int().nonnegative(),
    reviewed: z.number().int().nonnegative(),
    /** It would not decide — below the confidence bar, and worth a person. */
    abstained: z.number().int().nonnegative(),
    /** It was sure, and the catalogue was already right. Needs nobody. */
    unchanged: z.number().int().nonnegative(),
    published: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
    added: z.number().int().nonnegative(),
    dropped: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    error: z.string().nullable(),
    /** The run whose clusters this one re-asked, or null for the queue's own. */
    compareWith: z.number().int().positive().nullable(),
    /**
     * False for a run that recorded what it would have done and wrote nothing.
     * The counts then read as "would have", which is what the page says.
     */
    applied: z.boolean(),
    startedAt: z.string(),
    finishedAt: z.string().nullable(),
});

/** An agent, with how much of the queue it has left to look at. */
export const ReviewAgentSchema = z.object({
    id: z.number().int().positive(),
    name: z.string(),
    slug: z.string(),
    model: z.string(),
    enabled: z.boolean(),
    pending: z.number().int().nonnegative(),
});

export const ReviewOverviewSchema = z.object({
    agents: z.array(ReviewAgentSchema),
    runs: z.array(AdminReviewRunSchema),
});

/** How many clusters one run may look at. */
export const REVIEW_BATCH_MAX = 5000;

export const ReviewStartSchema = z.object({
    agentId: z.coerce.number().int().positive(),
    limit: z.number().int().min(1).max(REVIEW_BATCH_MAX).default(25),
    /**
     * Re-ask the clusters an earlier run looked at, rather than take the next
     * unreviewed ones. This is what puts two agents on the same question, and
     * it deliberately overrides "not already answered by this agent" — asking
     * again is the point.
     */
    compareWith: z.number().int().positive().nullish(),
    /**
     * False records the verdicts and changes nothing. Three models can then be
     * asked about one cluster from one starting state, which is the only way
     * the answers are about the models rather than about who ran first.
     */
    applied: z.boolean().default(true),
    /**
     * Only names that hold no reading at all. A different job from choosing
     * between rival readings — there is nothing to weigh, and the model is
     * being asked to write one — and the queue's id order would not reach them
     * for a very long time.
     */
    unwritten: z.boolean().default(false),
});

export const ReviewRunIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export type AdminReviewRun = z.infer<typeof AdminReviewRunSchema>;
export type ReviewAgent = z.infer<typeof ReviewAgentSchema>;
export type ReviewOverview = z.infer<typeof ReviewOverviewSchema>;
export type ReviewStart = z.infer<typeof ReviewStartSchema>;
