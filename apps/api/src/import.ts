import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ImportFileSchema } from '@tbn/shared';
import { Sequelize } from 'sequelize';

import { AppModule } from './app.module.js';
import { DatabaseBootstrap } from './database/database.bootstrap.js';
import {
    ATTESTATIONS_MODEL,
    CLUSTERS_MODEL,
    LANGUAGES_MODEL,
    MEANINGS_MODEL,
    NAMES_MODEL,
    RELIGIONS_MODEL,
    SEQUELIZE,
    SOURCES_MODEL,
} from './database/database.constants.js';
import { ImporterModels, importNames } from './database/importer.js';

/** How many rejections are listed before the count speaks for the rest. */
const LISTED = 20;

const argument = (name: string): string | undefined =>
    process.argv
        .find((value) => value.startsWith(`--${name}=`))
        ?.slice(name.length + 3);

/**
 * Adds a source's names to the catalogue, as candidates for review.
 *
 * The file is JSON: a `source` naming where the names came from, and `names`,
 * each with a spelling, a gender, whatever readings the source gives, and —
 * where the source files its names at all — the religion and language slugs
 * the catalogue filters on.
 *
 *     yarn workspace @tbn/api import:names --file=./batch.json [--dry-run]
 *
 * Safe to re-run: importing the same file twice writes nothing the second
 * time.
 */
const run = async (): Promise<void> => {
    const logger = new Logger('Import');
    const path = argument('file');

    if (!path) {
        logger.error('Nothing to import: pass --file=<path to a json file>.');
        process.exitCode = 1;

        return;
    }

    const dryRun = process.argv.includes('--dry-run');

    let file;
    let checksum;

    try {
        const raw = await readFile(path);

        checksum = createHash('sha256').update(raw).digest('hex');
        file = ImportFileSchema.parse(JSON.parse(raw.toString('utf8')));
    } catch (error) {
        logger.error(`Could not read ${path}.`, error);
        process.exitCode = 1;

        return;
    }

    // 'log' has to be in the list: these levels gate every logger in the
    // process, this one included.
    const context = await NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn', 'log'],
    });

    // The models are defined before the schema is, so the migrations have to
    // have run before anything reads through them.
    await context.get(DatabaseBootstrap).ready;

    const sequelize = context.get<Sequelize>(SEQUELIZE);

    // Every statement would otherwise be echoed, burying the lines that say
    // what the import did. The field is public at runtime and not in the v6
    // types, which describe the constructor's options instead.
    (
        sequelize as unknown as { options: { logging: boolean } }
    ).options.logging = false;

    const models: ImporterModels = {
        sequelize,
        names: context.get(NAMES_MODEL),
        meanings: context.get(MEANINGS_MODEL),
        clusters: context.get(CLUSTERS_MODEL),
        sources: context.get(SOURCES_MODEL),
        attestations: context.get(ATTESTATIONS_MODEL),
        religions: context.get(RELIGIONS_MODEL),
        languages: context.get(LANGUAGES_MODEL),
    };

    const report = await importNames(models, file, { checksum, dryRun });

    for (const { at, name, reason } of report.rejected.slice(0, LISTED)) {
        logger.warn(`Record ${at} (${name ?? 'unnamed'}) refused — ${reason}.`);
    }

    if (report.rejected.length > LISTED) {
        logger.warn(`${report.rejected.length - LISTED} more were refused.`);
    }

    logger.log(
        `${dryRun ? 'Would add' : 'Added'} ${report.names} names in ` +
            `${report.clusters} new clusters with ${report.meanings} readings ` +
            `and ${report.attestations} citations from "${report.source}", as ` +
            `candidates. ${report.unchanged} were already there and ` +
            `${report.rejected.length} were refused.`,
    );

    await context.close();
};

void run();
