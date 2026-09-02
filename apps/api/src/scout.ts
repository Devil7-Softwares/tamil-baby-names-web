import { readFile, writeFile } from 'node:fs/promises';

import { Logger } from '@nestjs/common';

import { parseScan, scoutBatch, ScoutBatchOptions } from './scout-batch.js';

/**
 * `x:0=girl,1=boy` — the `extra` field holding an app's own gender flag, and
 * what its values mean. Rejected rather than half-read: a mapping typed wrong
 * would file a whole catalogue under the wrong gender.
 */
const genderMapping = (
    given: string,
): ScoutBatchOptions['gender'] | undefined => {
    if (!given) {
        return undefined;
    }

    const [field, pairs] = given.split(':');
    const values = Object.fromEntries(
        (pairs ?? '')
            .split(',')
            .filter(Boolean)
            .map((pair) => pair.split('=', 2) as [string, string]),
    );

    if (!field || !Object.keys(values).length) {
        throw new Error(`--gender-from should read like x:0=girl,1=boy`);
    }

    return { field, values };
};

/** How many skipped records are listed before the count speaks for the rest. */
const LISTED = 20;

const argument = (name: string): string | undefined =>
    process.argv
        .find((value) => value.startsWith(`--${name}=`))
        ?.slice(name.length + 3);

/**
 * Turns one package of an apk-db-scout scan into a batch for `import:names`.
 *
 *     yarn workspace @tbn/api scout:batch --scan=./names-all.csv \
 *         --package=com.rmitms.namesBabyTamil --out=./batch.json [--title=…]
 *         [--gender-from=x:0=girl,1=boy] [--religion=muslim] [--language=tamil]
 *
 * Written out rather than imported directly, so the batch can be read before
 * anything is written: a scan is a decompiled app, and what it calls a name is
 * worth looking at before the catalogue carries it.
 */
const run = async (): Promise<void> => {
    const logger = new Logger('Scout');
    const scan = argument('scan');
    const packageName = argument('package');
    const out = argument('out');

    if (!scan || !packageName || !out) {
        logger.error(
            'Needs --scan=<path to a scan csv>, --package=<name> and ' +
                '--out=<path to write>.',
        );
        process.exitCode = 1;

        return;
    }

    let batch;

    try {
        const rows = parseScan(await readFile(scan, 'utf8'));

        batch = scoutBatch(rows, {
            package: packageName,
            title: argument('title'),
            gender: genderMapping(argument('gender-from') ?? ''),
            religion: argument('religion'),
            language: argument('language'),
        });
    } catch (error) {
        logger.error(`Could not read ${scan}.`, error);
        process.exitCode = 1;

        return;
    }

    if (!batch.file.names.length) {
        logger.error(`${scan} has nothing importable for ${packageName}.`);
        process.exitCode = 1;

        return;
    }

    for (const { record, name, reason } of batch.skipped.slice(0, LISTED)) {
        logger.warn(`${record} (${name ?? 'unnamed'}) left out — ${reason}.`);
    }

    if (batch.skipped.length > LISTED) {
        logger.warn(`${batch.skipped.length - LISTED} more were left out.`);
    }

    await writeFile(out, `${JSON.stringify(batch.file, null, 4)}\n`, 'utf8');

    logger.log(
        `Wrote ${batch.file.names.length} of ${packageName}'s ` +
            `${batch.records} records to ${out}, ` +
            `${batch.skipped.length} left out.`,
    );
};

void run();
