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
    /** Whatever the scan could not name, as JSON. Usually an app's own flags. */
    extra: string;
}

/**
 * A field of the scan's `extra`, and what its values mean here.
 *
 * The scan records what an app stored without interpreting it, because a column
 * of `0` and `1` is as likely to be a favourite as a gender and guessing is how
 * a catalogue fills with confident nonsense. The reading comes from whoever
 * checked it. A value the mapping does not cover is left unanswered rather than
 * guessed at.
 */
export interface Mapping {
    field: string;
    values: Record<string, string>;
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
    /**
     * Where to read gender when the scan could not: a field of `extra` and
     * what its values mean — `{ field: 'x', values: { '0': 'girl' } }`.
     *
     * An app that keeps gender as a flag leaves the scan nothing to go on — a
     * column of `0` and `1` is as likely to be a favourite as a gender, and
     * guessing is how a catalogue fills with confident nonsense. So the mapping
     * comes from whoever checked it, rather than being inferred here.
     */
    gender?: Mapping;
    /**
     * The same, for the lookup slugs. `nithra.babyname` carries both per row in
     * its own Tamil labels, so `{ field: 'Religion', values: { 'இந்து': 'hindu' } }`
     * files each name where the source filed it.
     */
    religion?: Mapping;
    language?: Mapping;
    /**
     * The lookup slugs every name in the package is filed under, where the
     * source says so of its whole catalogue — an app called "Muslim Tamil
     * Names" is stating a religion, even though no column holds it. Ignored
     * for a field the mapping above already answered.
     */
    religionSlug?: string;
    languageSlug?: string;
    /**
     * Only rows whose `origin` contains this. One app's database is several
     * tables, and they are not all catalogues: `nithra.babyname` keeps its
     * names in `baby_names` and `twin_baby_names` and its nakshatras in
     * `star_use`, which are not names anybody is called.
     */
    origin?: string;
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

/** A scan writes `extra` as JSON, and writes nothing where it found nothing. */
const parseExtra = (extra: string): Record<string, string> => {
    if (!extra.trim()) {
        return {};
    }

    try {
        return JSON.parse(extra) as Record<string, string>;
    } catch {
        return {};
    }
};

/** What a declared `extra` field says about this record, if anything. */
const mapped = (
    group: ScoutRow[],
    mapping: Mapping | undefined,
): string | undefined => {
    if (!mapping) {
        return undefined;
    }

    for (const { extra } of group) {
        const value = parseExtra(extra)[mapping.field];

        if (value !== undefined) {
            return mapping.values[value.trim()];
        }
    }

    return undefined;
};

/** What the scan read as a gender, else what the app's own flag was declared
 * to mean. */
const genderOf = (
    group: ScoutRow[],
    mapping: Mapping | undefined,
): ImportNameInput['gender'] | undefined =>
    GENDERS[group.find(({ gender }) => gender)?.gender ?? ''] ??
    GENDERS[mapped(group, mapping) ?? ''];

/**
 * A reading, or nothing where the source wrote a placeholder.
 *
 * `nithra.babyname` stores `-` for the 13,351 names it has no meaning for, and
 * importing that as a reading would put a dash on the site under 13,351 names.
 * An empty field and a field holding only punctuation say the same thing.
 */
const PLACEHOLDER = /^[\s\-–—.·?]*$/;

const meaningOf = (group: ScoutRow[]): string | undefined =>
    group
        .map(({ meaning }) => meaning.trim())
        .find((meaning) => meaning && !PLACEHOLDER.test(meaning));

/**
 * Turns one package of a scan into a batch the importer takes.
 *
 * The Tamil spelling is the name and a Latin one becomes a note, because the
 * two are one name and the catalogue clusters by spelling: importing both
 * would file every record twice, under two clusters nothing can currently
 * join. A record the scan only found in Latin is still imported — the
 * alternative is dropping a name because of the script it was written in.
 *
 * A religion and a language are filed only where the caller passes them,
 * because a source that is a list of names says neither and the queue is where
 * that gets decided.
 */
export const scoutBatch = (
    rows: ScoutRow[],
    options: ScoutBatchOptions,
): ScoutBatch => {
    const here = rows.filter(
        (row) =>
            row.package === options.package &&
            (!options.origin || row.origin.includes(options.origin)),
    );
    const records = new Map<string, ScoutRow[]>();
    const seen = new Map<string, number>();

    for (const [at, row] of here.entries()) {
        // A scan that records no id per record still has one row per name, so
        // its position stands in — grouping every row of it under `''` would
        // collapse the package into a single record.
        const id = row.record || `#${at}`;
        // A record groups the *scripts* of one name, so two rows in the same
        // script are two names and not two spellings. `twin_baby_names` puts
        // both children on one row, and without this the second of every pair
        // is silently dropped — 349 names in `nithra.babyname` alone.
        const nth = seen.get(`${id} ${row.script}`) ?? 0;
        const key = nth ? `${id} ${nth}` : id;

        seen.set(`${id} ${row.script}`, nth + 1);
        records.set(key, [...(records.get(key) ?? []), row]);
    }

    const names: ImportNameInput[] = [];
    const skipped: ScoutSkip[] = [];

    for (const [record, group] of records) {
        const tamil = group.find(({ script }) => script === 'tamil');
        const latin = group.find(({ script }) => script === 'latin');
        const spelling = tamil ?? latin ?? group[0];
        const gender = genderOf(group, options.gender);
        const meaning = meaningOf(group);

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
            religion:
                mapped(group, options.religion) ?? options.religionSlug ?? null,
            language:
                mapped(group, options.language) ?? options.languageSlug ?? null,
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
