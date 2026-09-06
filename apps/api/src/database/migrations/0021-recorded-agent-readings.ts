import { QueryInterface } from 'sequelize';

/**
 * The readings agents wrote, put back in the ledger.
 *
 * A verdict whose only act is writing a reading promotes nothing and displaces
 * nothing, so it built no ledger entry — and on a run that applied, the
 * `considered` fallback that catches this did not fire. The reading landed in
 * `meanings` and the run kept no record of ever having seen the cluster.
 *
 * Two things broke on that. A re-ask reads a run's clusters out of the ledger,
 * so pointing a second model at the first one's run silently skipped every
 * name it had written from scratch — which is exactly the set a second opinion
 * was wanted for. And 0018's `proposed`, the column the "two or more suggested
 * a meaning" filter counts, had no row to sit on: runs 42 and 43 wrote 1,452
 * readings between them and stamped it 193 times, all of them abstentions.
 *
 * Every such reading is still recoverable, because an agent writes under a
 * source of its own (`agent:<slug>`) and the run it belongs to is the one whose
 * window covers the row's `created_at`. The ledger row is dated to match, both
 * because that is when the agent wrote it and because it is what tells these
 * rows apart from ones written by a review.
 *
 * `confidence` and `note` are left null: they were never recorded and are gone.
 * A written reading was above the bar by construction — below it the agent
 * abstains and writes nothing — so the row saying nothing about how sure it was
 * is a smaller lie than a number invented here.
 */
export const up = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        INSERT INTO "verifications" (
            "meaning_id", "from_status", "to_status", "reason",
            "agent_id", "proposed", "run_id", "created_at"
        )
        SELECT
            m."id", 'candidate', 'candidate', 'decision',
            a."id", m."text",
            (
                SELECT r."id" FROM "review_runs" r
                WHERE r."agent_id" = a."id"
                  AND m."created_at" >= r."started_at"
                  AND m."created_at" <= r."finished_at"
                ORDER BY r."started_at" DESC
                LIMIT 1
            ),
            m."created_at"
        FROM "meanings" m
        JOIN "sources" s
          ON s."id" = m."source_id" AND s."kind" = 'agent'
        JOIN "agents" a
          ON ('agent:' || a."slug") = s."slug"
        WHERE NOT EXISTS (
            SELECT 1 FROM "verifications" v
            WHERE v."meaning_id" = m."id" AND v."agent_id" = a."id"
        );
    `);
};

/**
 * Only the rows this wrote: an agent's own reading, standing still, dated to
 * the reading itself and carrying neither a confidence nor a note. A verdict
 * recorded by a run has all three.
 */
export const down = async ({
    context,
}: {
    context: QueryInterface;
}): Promise<void> => {
    await context.sequelize.query(`
        DELETE FROM "verifications" v
        USING "meanings" m
        WHERE v."meaning_id" = m."id"
          AND v."agent_id" IS NOT NULL
          AND v."reason" = 'decision'
          AND v."from_status" = 'candidate'
          AND v."to_status" = 'candidate'
          AND v."confidence" IS NULL
          AND v."note" IS NULL
          AND v."created_at" = m."created_at";
    `);
};
