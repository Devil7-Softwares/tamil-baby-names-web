import { z } from 'zod';

import { AGENT_PROVIDERS } from '../types/AgentProvider.js';

const text = (max: number) => z.string().trim().min(1).max(max);

/**
 * An agent as the dashboard sees it. There is no key here and there never will
 * be: a saved key is write-only, and `hasKey` is the whole of what can be said
 * about it afterwards.
 */
export const AdminAgentSchema = z.object({
    id: z.number().int().positive(),
    slug: z.string(),
    name: z.string(),
    provider: z.enum(AGENT_PROVIDERS),
    /** Null for the provider's own endpoint. */
    baseUrl: z.string().nullable(),
    model: z.string(),
    hasKey: z.boolean(),
    options: z.record(z.string(), z.unknown()),
    enabled: z.boolean(),
});

/**
 * What the registry says about each provider, so the form can fill in an
 * endpoint and stop asking for a key nothing will use.
 */
export const AgentProviderSummarySchema = z.object({
    id: z.enum(AGENT_PROVIDERS),
    label: z.string(),
    defaultBaseUrl: z.string(),
    needsKey: z.boolean(),
    /** False while `AGENT_KEY_SECRET` is unset, which only stops keyed ones. */
    usable: z.boolean(),
});

export const AgentProvidersSchema = z.object({
    providers: z.array(AgentProviderSummarySchema),
    /** The dashboard says why a provider is unusable rather than just greying it. */
    canSealKeys: z.boolean(),
});

/**
 * `options` is per-provider dials, and free-form on purpose: `temperature`,
 * `effort` for Claude, `think` for a local reasoning model, `headers` for a
 * gateway. The form takes it as JSON because inventing a control per provider
 * would be a worse guess than letting it be typed.
 */
const OptionsSchema = z.record(z.string(), z.unknown()).default({});

/**
 * A URL, or nothing. Empty string reads as "use the provider's own endpoint",
 * because that is what clearing the field in a form means.
 */
const BaseUrlSchema = z
    .string()
    .trim()
    .max(2000)
    .transform((value) => value || null)
    .nullish()
    .transform((value) => value ?? null)
    .refine(
        (value) => value === null || /^https?:\/\//.test(value),
        'The endpoint must start with http:// or https://.',
    );

export const AgentCreateSchema = z.object({
    name: text(120),
    provider: z.enum(AGENT_PROVIDERS),
    model: text(200),
    baseUrl: BaseUrlSchema,
    /** Sealed on arrival and never read back. */
    apiKey: z.string().min(1).max(500).nullish(),
    options: OptionsSchema,
    enabled: z.boolean().default(true),
});

/**
 * Every field optional, and `apiKey` says three different things: absent leaves
 * the saved key alone, a string replaces it, and an explicit null clears it.
 * A form that had to resend the key to change the model would have to hold it.
 */
export const AgentUpdateSchema = z.object({
    id: z.coerce.number().int().positive(),
    name: text(120).optional(),
    model: text(200).optional(),
    baseUrl: BaseUrlSchema.optional(),
    apiKey: z.string().min(1).max(500).nullish(),
    options: z.record(z.string(), z.unknown()).optional(),
    enabled: z.boolean().optional(),
});

export const AgentIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const AgentListSchema = z.object({
    agents: z.array(AdminAgentSchema),
});

/** What the check found, in words a person can act on. */
export const AgentCheckSchema = z.object({
    ok: z.boolean(),
    why: z.string().nullable(),
});

export type AdminAgent = z.infer<typeof AdminAgentSchema>;
export type AgentProviderSummary = z.infer<typeof AgentProviderSummarySchema>;
export type AgentProviders = z.infer<typeof AgentProvidersSchema>;
export type AgentCreate = z.infer<typeof AgentCreateSchema>;
export type AgentUpdate = z.infer<typeof AgentUpdateSchema>;
export type AgentList = z.infer<typeof AgentListSchema>;
export type AgentCheck = z.infer<typeof AgentCheckSchema>;
