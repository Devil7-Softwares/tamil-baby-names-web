import { ImportFileInput, ImportNameInput } from '@tbn/shared';

/**
 * A row of an apk-db-scout scan. One name in one script, as the scan found it:
 * a record that carries the same name in two scripts is two rows sharing a
 * `record`, which is what pairs them back up here.
 */
export interface ScoutRow {
    name: string;
    meaning: string;
    gender: string;
    script: string;
    package: string;
    version: string;
    origin: string;
    record: string;
}

/** A record the batch leaves behind, and what the scan did not say about it. */
export interface ScoutSkip {
    record: string;
    name: string | null;
    reason: string;
}

export interface ScoutBatch {
    file: ImportFileInput;
    /** Records read, which is names plus skips. */
    records: number;
    skipped: ScoutSkip[];
}

export interface ScoutBatchOptions {
    /** The package to take, since a scan holds every app that was scanned. */
    package: string;
    /** The app's own name, which a scan does not record. */
    title?: string;
}

const COLUMNS = [
    'name',
    'meaning',
    'gender',
    'script',
    'key',
    'package',
    'version',
    'origin',
    'record',
    'extra',
] as const;

/**
 * The scan as CSV.
 *
 * Parsed here rather than by a dependency: the file is RFC 4180 and the only
 * thing in it needing care is a quoted field holding commas, quotes or
 * newlines, which `extra` and the occasional meaning both do.
 */
export const parseScan = (text: string): ScoutRow[] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let quoted = false;

    for (let at = 0; at < text.length; at += 1) {
        const character = text[at];

        if (quoted) {
            if (character !== '"') {
                field += character;
            } else if (text[at + 1] === '"') {
                field += '"';
                at += 1;
            } else {
                quoted = false;
            }

            continue;
        }

        if (character === '"') {
            quoted = true;
        } else if (character === ',') {
            row.push(field);
            field = '';
        } else if (character === '\n' || character === '\r') {
            // A row is only ended by the newline that follows content, so
            // CRLF and a trailing newline do not each add an empty row.
            if (field || row.length) {
                row.push(field);
                rows.push(row);
                row = [];
                field = '';
            }
        } else {
            field += character;
        }
    }

    if (field || row.length) {
        rows.push([...row, field]);
    }

    const [header, ...body] = rows;

    if (!header) {
        return [];
    }

    const index = new Map(header.map((name, at) => [name.trim(), at]));
    const missing = COLUMNS.filter((name) => !index.has(name));

    if (missing.length) {
        throw new Error(`The scan is missing ${missing.join(', ')}.`);
    }

    return body.map(
        (values) =>
            Object.fromEntries(
                COLUMNS.map((name) => [name, values[index.get(name)!] ?? '']),
            ) as unknown as ScoutRow,
    );
};

/** The scan's own genders, which are the catalogue's two or nothing at all. */
const GENDERS: Record<string, ImportNameInput['gender'] | undefined> = {
    boy: 'boy',
    girl: 'girl',
};

/**
 * Turns one package of a scan into a batch the importer takes.
 *
 * The Tamil spelling is the name and a Latin one becomes a note, because the
 * two are one name and the catalogue clusters by spelling: importing both
 * would file every record twice, under two clusters nothing can currently
 * join. A record the scan only found in Latin is still imported — the
 * alternative is dropping a name because of the script it was written in.
 *
 * Nothing is filed under a religion or a language. This kind of source is a
 * list of names, and says neither.
 */
export const scoutBatch = (
    rows: ScoutRow[],
    options: ScoutBatchOptions,
): ScoutBatch => {
    const here = rows.filter((row) => row.package === options.package);
    const records = new Map<string, ScoutRow[]>();

    for (const [at, row] of here.entries()) {
        // A scan that records no id per record still has one row per name, so
        // its position stands in — grouping every row of it under `''` would
        // collapse the package into a single record.
        const key = row.record || `#${at}`;

        records.set(key, [...(records.get(key) ?? []), row]);
    }

    const names: ImportNameInput[] = [];
    const skipped: ScoutSkip[] = [];

    for (const [record, group] of records) {
        const tamil = group.find(({ script }) => script === 'tamil');
        const latin = group.find(({ script }) => script === 'latin');
        const spelling = tamil ?? latin ?? group[0];
        const gender =
            GENDERS[group.find(({ gender }) => gender)?.gender ?? ''];
        const meaning = group.find(({ meaning }) => meaning.trim())?.meaning;

        if (!spelling?.name.trim()) {
            skipped.push({ record, name: null, reason: 'no spelling' });

            continue;
        }

        if (!gender) {
            skipped.push({
                record,
                name: spelling.name,
                reason: 'no gender',
            });

            continue;
        }

        const transliteration = tamil && latin ? latin.name : null;

        names.push({
            name: spelling.name,
            gender,
            meanings: meaning ? [meaning] : [],
            notes: transliteration
                ? `The source spells it "${transliteration}" in Latin script.`
                : null,
            attestation: {
                locator: record,
                excerpt: [
                    transliteration
                        ? `${spelling.name} (${transliteration})`
                        : spelling.name,
                    meaning,
                ]
                    .filter(Boolean)
                    .join(' — '),
            },
        });
    }

    return {
        records: records.size,
        skipped,
        file: {
            source: {
                slug: options.package,
                kind: 'android-app',
                title: options.title ?? null,
                // Every row of a package carries it, so the first one speaks
                // for the scan.
                version: here[0]?.version || null,
            },
            names,
        },
    };
};
