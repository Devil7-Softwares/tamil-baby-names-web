import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Sequelize } from 'sequelize';

import { AppModule } from './app.module.js';
import { DatabaseBootstrap } from './database/database.bootstrap.js';
import {
    MEANINGS_MODEL,
    NAMES_MODEL,
    SEQUELIZE,
    SOURCES_MODEL,
} from './database/database.constants.js';
import {
    DEFAULT_CLUSTERS,
    FixtureModels,
    seedReviewFixture,
    undoReviewFixture,
} from './database/review-fixture.js';

/**
 * Fills the review queue with the catalogue's own disagreements, or takes them
 * back out. Everything shipped is `published`, so without this there is nothing
 * to review and the queue can only be tried by hand-writing SQL.
 */
const run = async (): Promise<void> => {
    const logger = new Logger('Fixture');

    // Refused rather than guarded by a flag: this writes to whatever database
    // the environment points at.
    if (process.env.NODE_ENV === 'production') {
        logger.error('The review fixture is for development databases only.');
        process.exitCode = 1;

        return;
    }

    const undo = process.argv.includes('--undo');
    const clusters = Number(
        process.argv
            .find((argument) => argument.startsWith('--clusters='))
            ?.split('=')[1] ?? DEFAULT_CLUSTERS,
    );

    // 'log' has to be in the list: these levels gate every logger in the
    // process, this one included.
    const context = await NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn', 'log'],
    });

    // The models are defined before the schema is, so the migrations have to
    // have run before anything reads through them.
    await context.get(DatabaseBootstrap).ready;

    const sequelize = context.get<Sequelize>(SEQUELIZE);

    // Every statement would otherwise be echoed, burying the one line that
    // says what the fixture did. The field is public at runtime and not in the
    // v6 types, which describe the constructor's options instead.
    (
        sequelize as unknown as { options: { logging: boolean } }
    ).options.logging = false;

    const models: FixtureModels = {
        sequelize,
        names: context.get(NAMES_MODEL),
        meanings: context.get(MEANINGS_MODEL),
        sources: context.get(SOURCES_MODEL),
    };

    if (undo) {
        const { readings, republished } = await undoReviewFixture(models);

        logger.log(
            `Removed ${readings} fixture readings, republishing ${republished} the catalogue already had.`,
        );
    } else {
        const { clusters: seeded, readings } = await seedReviewFixture(
            models,
            clusters,
        );

        logger.log(
            readings
                ? `Gave ${seeded} clusters ${readings} candidate readings to decide.`
                : `Nothing to add: those ${seeded} clusters already hold their siblings' readings.`,
        );
    }

    await context.close();
};

void run();
