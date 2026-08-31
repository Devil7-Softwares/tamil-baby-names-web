import { QueryInterface } from 'sequelize';

/**
 * Who decided what, and when. The review mutations change a status in place, so
 * until now the catalogue held the verdict and nothing else: a published
 * reading looked identical whether a reviewer chose it, an import guessed it,
 * or a model proposed it and nobody has looked yet.
 *
 * Append only. A row records one transition rather than a state, which is what
 * makes the ledger answer "how did this get published" instead of repeating
 * what the subject row already says.
 *
 * `reason` separates the reading a reviewer judged from the incumbent their
 * promotion sent back to the pool: the same actor, but not the same act.
 *
 * Nothing is backfilled. The 12,389 readings the import published were never
 * reviewed, and inventing entries for them would put a reviewer's name — or a
 * decision that never happened — on all of them.
 */
export const up = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        DO $$ BEGIN
            CREATE TYPE "enum_verification_reason"
                AS ENUM ('decision', 'displacement');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        CREATE TABLE IF NOT EXISTS "verifications" (
            "id"          SERIAL PRIMARY KEY,
            "name_id"     INTEGER REFERENCES "names" ("id") ON DELETE CASCADE,
            "meaning_id"  INTEGER REFERENCES "meanings" ("id") ON DELETE CASCADE,
            "from_status" "enum_name_status" NOT NULL,
            "to_status"   "enum_name_status" NOT NULL,
            "reason"      "enum_verification_reason" NOT NULL DEFAULT 'decision',
            -- Null once an account is removed, and null for whatever the
            -- pipeline decides on its own.
            "actor_id"    INTEGER REFERENCES "admin_users" ("id") ON DELETE SET NULL,
            "created_at"  TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT "verifications_one_subject" CHECK (
                ("name_id" IS NOT NULL AND "meaning_id" IS NULL)
                OR
                ("name_id" IS NULL AND "meaning_id" IS NOT NULL)
            )
        );

        CREATE INDEX IF NOT EXISTS "verifications_name_id_idx"
            ON "verifications" ("name_id");
        CREATE INDEX IF NOT EXISTS "verifications_meaning_id_idx"
            ON "verifications" ("meaning_id");
        CREATE INDEX IF NOT EXISTS "verifications_actor_id_idx"
            ON "verifications" ("actor_id", "created_at" DESC);
    `);
};

export const down = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        DROP TABLE IF EXISTS "verifications";
        DROP TYPE IF EXISTS "enum_verification_reason";
    `);
};
