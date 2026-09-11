import { QueryInterface } from 'sequelize';

/**
 * Switches for the public site that an admin flips without a deploy.
 *
 * One row, held to one by the check: there is a single site, and a second row
 * would leave every reader guessing which of the two is in force.
 *
 * `show_unreviewed` puts candidate names on the site beside the published ones.
 * The import brought in ten candidates for every published name, and review
 * will take a while to reach them. Off by default, so the site serves what it
 * did before this migration.
 */
export const up = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        CREATE TABLE IF NOT EXISTS "site_settings" (
            "id" SMALLINT PRIMARY KEY DEFAULT 1 CHECK ("id" = 1),
            "show_unreviewed" BOOLEAN NOT NULL DEFAULT false,
            "updated_by" INTEGER
                REFERENCES "admin_users" ("id") ON DELETE SET NULL,
            "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    `);

    await context.sequelize.query(`
        INSERT INTO "site_settings" ("id") VALUES (1) ON CONFLICT DO NOTHING;
    `);
};

export const down = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        DROP TABLE IF EXISTS "site_settings";
    `);
};
