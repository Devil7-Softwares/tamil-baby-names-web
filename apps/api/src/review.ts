import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ReviewOutcome } from '@tbn/shared';
import { Sequelize } from 'sequelize';

import { AppModule } from './app.module.js';
import { DatabaseBootstrap } from './database/database.bootstrap.js';
import { AGENTS_MODEL, SEQUELIZE } from './database/database.constants.js';
import { AgentsModel } from './database/models.js';
import { ReviewService } from './review/review.service.js';

const argument = (name: string): string | undefined =>
    process.argv
        .find((value) => value.startsWith(`--${name}=`))
        ?.slice(name.length + 3);

/** How many verdicts are printed before the counts speak for the rest. */
const LISTED = 20;

const line = (outcome: ReviewOutcome): string => {
    const did = [
        outcome.published && 'published a reading',
        outcome.rejected && `rejected ${outcome.rejected}`,
        outcome.added && 'wrote its own',
        outcome.dropped && `dropped ${outcome.dropped} rows`,
        outcome.abstained && 'left alone',
    ]
        .filter(Boolean)
        .join(', ');

    return `  ${outcome.name}  [${outcome.confidence ?? '—'}] ${did} — ${outcome.note}`;
};

/**
 * Asks an agent to review the queue.
 *
 *     yarn workspace @tbn/api review:names --agent=<slug> [--limit=25]
 *
 * Safe to re-run: an agent is never asked twice about the same cluster, so a
 * second run carries on from where the first stopped.
 */
const run = async (): Promise<void> => {
    const logger = new Logger('Review');
    const slug = argument('agent');
    const limit = Number(argument('limit') ?? 25);

    if (!slug) {
        logger.error('Which agent? Pass --agent=<slug>.');
        process.exitCode = 1;

        return;
    }

    if (!Number.isInteger(limit) || limit < 1) {
        logger.error(`--limit must be a positive whole number, got ${limit}.`);
        process.exitCode = 1;

        return;
    }

    const context = await NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn', 'log'],
    });

    await context.get(DatabaseBootstrap).ready;

    const sequelize = context.get<Sequelize>(SEQUELIZE);

    (
        sequelize as unknown as { options: { logging: boolean } }
    ).options.logging = false;

    const agent = await context
        .get<AgentsModel>(AGENTS_MODEL)
        .findOne({ where: { slug } });

    if (!agent) {
        logger.error(`No agent called “${slug}”.`);
        process.exitCode = 1;
        await context.close();

        return;
    }

    if (!agent.dataValues.enabled) {
        logger.error(`“${slug}” is turned off.`);
        process.exitCode = 1;
        await context.close();

        return;
    }

    const review = context.get(ReviewService);
    const waiting = await review.pending(agent.dataValues.id);

    logger.log(
        `${waiting.toLocaleString()} clusters are waiting on “${slug}”. Reviewing ${Math.min(limit, waiting)}.`,
    );

    const report = await review.run(agent.dataValues, { limit });

    for (const outcome of report.outcomes.slice(0, LISTED)) {
        logger.log(line(outcome));
    }

    if (report.outcomes.length > LISTED) {
        logger.log(`  … and ${report.outcomes.length - LISTED} more.`);
    }

    logger.log(
        `Reviewed ${report.reviewed} clusters: published ${report.published}, ` +
            `rejected ${report.rejected} readings, wrote ${report.added}, ` +
            `dropped ${report.dropped} rows that are not names. ` +
            `${report.abstained} were left alone and ${report.failed} could not be read.`,
    );

    await context.close();
};

await run();
