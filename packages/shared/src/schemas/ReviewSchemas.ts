import { z } from 'zod';

/**
 * One reading, as the model is shown it. Numbered from 1 rather than carrying
 * the database id: a model asked to echo ids invents them, and an index into a
 * list it was just given is the one thing it can get right. The mapping back to
 * ids stays on this side.
 */
export const ReviewReadingSchema = z.object({
    at: z.number().int().positive(),
    text: z.string(),
    source: z.string().nullable(),
    /** Already live on the site, so displacing it is a bigger claim. */
    published: z.boolean(),
});

/** One cluster, as the model is shown it. */
export const ReviewSubjectSchema = z.object({
    name: z.string(),
    gender: z.string(),
    religion: z.string().nullable(),
    language: z.string().nullable(),
    readings: z.array(ReviewReadingSchema),
});

/**
 * What the model answers. Every field is required so a provider's JSON mode has
 * a complete schema to hold it to — "no opinion" is said with `null` and an
 * empty list, not by leaving a field out.
 */
export const ReviewVerdictSchema = z.object({
    /** The reading to publish, by its `at`, or null for none of them. */
    publish: z.number().int().positive().nullable(),
    /** Readings that are wrong, by `at`. */
    reject: z.array(z.number().int().positive()),
    /** True when the entry is not a name at all — a word, a phrase, a verse. */
    rejectName: z.boolean(),
    /** A better reading, when every one offered is wrong. Null otherwise. */
    add: z.string().nullable(),
    /** 0–100. Anything low is what a person should read again. */
    confidence: z.number().int().min(0).max(100),
    /** One line of why, in English. */
    note: z.string(),
});

/**
 * The same schema as JSON Schema, which is what every provider's structured
 * output wants — Claude's `output_config.format`, an OpenAI `json_schema`
 * response format, and Ollama's `format`. Generated rather than written twice.
 */
export const REVIEW_VERDICT_JSON_SCHEMA = z.toJSONSchema(
    ReviewVerdictSchema,
) as Record<string, unknown>;

/** Below this a verdict is recorded but nothing is changed. */
export const CONFIDENT_ENOUGH = 55;

/** What applying one verdict actually did. */
export const ReviewOutcomeSchema = z.object({
    clusterId: z.number().int().positive(),
    name: z.string(),
    /** Null when the model could not be read, which the note explains. */
    confidence: z.number().int().min(0).max(100).nullable(),
    note: z.string(),
    published: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
    added: z.number().int().nonnegative(),
    /** Rows sent to `rejected` because the entry is not a name. */
    dropped: z.number().int().nonnegative(),
    /** True when the verdict was recorded but changed nothing. */
    abstained: z.boolean(),
});

export const ReviewReportSchema = z.object({
    agent: z.string(),
    reviewed: z.number().int().nonnegative(),
    /** Clusters the model answered on but that were left alone. */
    abstained: z.number().int().nonnegative(),
    published: z.number().int().nonnegative(),
    rejected: z.number().int().nonnegative(),
    added: z.number().int().nonnegative(),
    dropped: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    outcomes: z.array(ReviewOutcomeSchema),
});

export type ReviewReading = z.infer<typeof ReviewReadingSchema>;
export type ReviewSubject = z.infer<typeof ReviewSubjectSchema>;
export type ReviewVerdict = z.infer<typeof ReviewVerdictSchema>;
export type ReviewOutcome = z.infer<typeof ReviewOutcomeSchema>;
export type ReviewReport = z.infer<typeof ReviewReportSchema>;
