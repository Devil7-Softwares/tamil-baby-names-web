import { QueryInterface } from 'sequelize';

/**
 * Where a source actually said it.
 *
 * A row already names the source it came from, which answers "who says so" and
 * nothing else: `source_id` points at a whole book, app or site, and the claim
 * that அறிவு means அறிவு is somewhere inside it. An attestation is the page
 * number — a locator the source can be checked against, and the words it used,
 * so a reviewer deciding between two readings can read what each one is based
 * on rather than trusting the slug.
 *
 * The subject is a catalogue row or a reading, as the exclusive arc 0007 uses
 * for the ledger. A source attests both: that it lists this spelling, and that
 * it gives this reading for it. Refusing to cite the name and citing only the
 * reading would be an arbitrary half.
 *
 * `locator` is free text because sources have nothing in common — a URL, a page
 * number, a record id in an app's database. `excerpt` is the source's own
 * words, and is null where there is nothing quotable.
 *
 * Unique per subject, source and locator, so re-running an import cites a
 * reading once however many times it is imported. Two *different* sources
 * landing on the same reading is the opposite of a duplicate: it is agreement,
 * and both citations are kept.
 *
 * Nothing is backfilled. The 12,389 readings the catalogue holds came from an
 * app that recorded no locator, and writing one for them would invent evidence.
 */
export const up = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        CREATE TABLE IF NOT EXISTS "attestations" (
            "id"         SERIAL PRIMARY KEY,
            "name_id"    INTEGER REFERENCES "names" ("id") ON DELETE CASCADE,
            "meaning_id" INTEGER REFERENCES "meanings" ("id") ON DELETE CASCADE,
            -- Cascades rather than nulling: a citation into a source the
            -- catalogue no longer holds says nothing.
            "source_id"  INTEGER NOT NULL
                         REFERENCES "sources" ("id") ON DELETE CASCADE,
            "locator"    TEXT NOT NULL,
            "excerpt"    TEXT,
            "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT "attestations_one_subject" CHECK (
                ("name_id" IS NOT NULL AND "meaning_id" IS NULL)
                OR
                ("name_id" IS NULL AND "meaning_id" IS NOT NULL)
            )
        );

        CREATE INDEX IF NOT EXISTS "attestations_name_id_idx"
            ON "attestations" ("name_id");
        CREATE INDEX IF NOT EXISTS "attestations_meaning_id_idx"
            ON "attestations" ("meaning_id");
        CREATE INDEX IF NOT EXISTS "attestations_source_id_idx"
            ON "attestations" ("source_id");

        CREATE UNIQUE INDEX IF NOT EXISTS "attestations_name_cited_idx"
            ON "attestations" ("name_id", "source_id", "locator")
            WHERE "name_id" IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS "attestations_meaning_cited_idx"
            ON "attestations" ("meaning_id", "source_id", "locator")
            WHERE "meaning_id" IS NOT NULL;
    `);
};

export const down = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`DROP TABLE IF EXISTS "attestations";`);
};
