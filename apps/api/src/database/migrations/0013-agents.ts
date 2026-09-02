import { QueryInterface } from 'sequelize';

/**
 * The models that can be asked to review the queue.
 *
 * A row is one configured endpoint: which API shape to speak, which model, and
 * the credential to speak it with. Several rows may point at the same provider
 * — a cheap model for a first pass over 160,000 scraped rows and an expensive
 * one for what it was unsure about is the reason this is a table rather than a
 * pair of environment variables.
 *
 * `provider` is TEXT, not an enum. Which providers exist is the registry in
 * `agents/providers`, and adding one should cost a file, not a migration. A
 * value the registry does not hold is rejected when the row is written.
 *
 * `base_url` is null for the provider's own endpoint and set for a gateway, a
 * proxy or a local Ollama. `model` is free text because every provider names
 * its models differently and they change faster than a migration can.
 *
 * The key is sealed, never stored as given: AES-256-GCM under `AGENT_KEY_SECRET`
 * from the environment, so a database dump carries ciphertext and the secret
 * that opens it lives somewhere else. The three columns are one value — the
 * ciphertext, the nonce it was sealed with, and the tag that proves it was not
 * edited — and are all null together for a provider that needs no key, which is
 * the normal case for Ollama.
 *
 * `options` is per-provider dials (temperature, a token ceiling, extra headers a
 * gateway wants) kept as JSONB rather than columns, because every provider
 * wants a different set and none of them are queried on.
 */
export const up = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        CREATE TABLE IF NOT EXISTS "agents" (
            "id"             SERIAL PRIMARY KEY,
            -- Stable across renames: an agent's own readings are attributed to
            -- a source named after it, and that attribution has to survive
            -- somebody rewording the display name.
            "slug"           TEXT NOT NULL UNIQUE,
            "name"           TEXT NOT NULL,
            "provider"       TEXT NOT NULL,
            "base_url"       TEXT,
            "model"          TEXT NOT NULL,
            "key_ciphertext" BYTEA,
            "key_iv"         BYTEA,
            "key_tag"        BYTEA,
            "options"        JSONB NOT NULL DEFAULT '{}'::jsonb,
            -- Kept rather than deleted when it is no longer wanted: its verdicts
            -- stay in the ledger, and a ledger pointing at a missing agent
            -- cannot say who decided.
            "enabled"        BOOLEAN NOT NULL DEFAULT true,
            "created_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
            "updated_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT "agents_key_is_whole" CHECK (
                ("key_ciphertext" IS NULL
                    AND "key_iv" IS NULL AND "key_tag" IS NULL)
                OR
                ("key_ciphertext" IS NOT NULL
                    AND "key_iv" IS NOT NULL AND "key_tag" IS NOT NULL)
            )
        );

        CREATE INDEX IF NOT EXISTS "agents_enabled_idx"
            ON "agents" ("enabled");
    `);
};

export const down = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`DROP TABLE IF EXISTS "agents";`);
};
