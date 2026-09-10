import { writeFile } from 'node:fs/promises';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module.js';
import { DatabaseBootstrap } from './database/database.bootstrap.js';
import { CLUSTERS_MODEL } from './database/database.constants.js';
import { knownNames } from './database/known-names.js';

const argument = (name: string): string | undefined =>
    process.argv
        .find((value) => value.startsWith(`--${name}=`))
        ?.slice(name.length + 3);

/**
 * Writes the names the catalogue already holds, so a scout run can say which of
 * the names it found are new before anybody imports them.
 *
 *     yarn workspace @tbn/api export:names --out=./known-names.json
 *
 * Read-only. The file holds a spelling and a gender per name and nothing else.
 */
const run = async (): Promise<void> => {
    const logger = new Logger('Export');
    const out = argument('out');

    if (!out) {
        logger.error('Nowhere to write: pass --out=<path to a json file>.');
        process.exitCode = 1;

        return;
    }

    const context = await NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn', 'log'],
    });

    await context.get(DatabaseBootstrap).ready;

    const names = await knownNames(context.get(CLUSTERS_MODEL));

    await writeFile(
        out,
        `${JSON.stringify(
            { exportedAt: new Date().toISOString(), names },
            null,
            2,
        )}\n`,
        'utf8',
    );

    logger.log(`Wrote ${names.length} names to ${out}.`);

    await context.close();
};

void run();
