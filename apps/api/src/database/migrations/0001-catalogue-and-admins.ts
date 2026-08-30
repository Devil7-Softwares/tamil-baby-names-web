import { QueryInterface } from 'sequelize';

/**
 * The schema as `sync()` left it, so a database built that way recognises
 * itself and a fresh one comes out identical — down to the enum type sequelize
 * generated for `role`.
 *
 * `names` and `twin_names` arrived with the catalogue import rather than being
 * designed here, which is why they carry no timestamps and no constraints
 * beyond the primary key.
 *
 * There is deliberately no `down`: this holds the catalogue, and reverting it
 * should not be one command away.
 */
export const up = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        CREATE TABLE IF NOT EXISTS "names" (
            "id"           SERIAL PRIMARY KEY,
            "gender"       VARCHAR(255),
            "religion"     VARCHAR(255),
            "first_letter" VARCHAR(255),
            "language"     VARCHAR(255),
            "name"         VARCHAR(255),
            "meaning"      VARCHAR(255)
        );

        CREATE TABLE IF NOT EXISTS "twin_names" (
            "id"       SERIAL PRIMARY KEY,
            "gender"   VARCHAR(255),
            "language" VARCHAR(255),
            "name1"    VARCHAR(255),
            "meaning1" VARCHAR(255),
            "name2"    VARCHAR(255),
            "meaning2" VARCHAR(255)
        );

        DO $$ BEGIN
            CREATE TYPE "enum_admin_users_role" AS ENUM ('admin', 'reviewer');
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;

        CREATE TABLE IF NOT EXISTS "admin_users" (
            "id"            SERIAL PRIMARY KEY,
            "email"         VARCHAR(255) NOT NULL UNIQUE,
            "password_hash" VARCHAR(255) NOT NULL,
            "name"          VARCHAR(255) NOT NULL,
            "role"          "enum_admin_users_role" NOT NULL DEFAULT 'reviewer',
            "created_at"    TIMESTAMPTZ,
            "updated_at"    TIMESTAMPTZ
        );
    `);
};
