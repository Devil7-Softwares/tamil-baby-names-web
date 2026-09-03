import { describe, expect, it } from 'vitest';

import { parseScan, scoutBatch, ScoutRow } from '../src/scout-batch.js';

const HEADER =
    'name,meaning,gender,script,key,package,version,origin,record,extra';

const row = (over: Partial<ScoutRow> = {}): ScoutRow => ({
    name: 'கணேஷ்',
    meaning: 'சிவனின் மகன்',
    gender: 'boy',
    script: 'tamil',
    package: 'com.rmitms.namesBabyTamil',
    version: '2.0',
    origin: 'classes.dex#record0.nametamil',
    record: 'classes.dex#record0:1',
    extra: '',
    ...over,
});

const latin = (over: Partial<ScoutRow> = {}): ScoutRow =>
    row({ name: 'Ganesh', script: 'latin', ...over });

describe('reading a scan', () => {
    it('takes a quoted field holding commas and quotes', () => {
        const rows = parseScan(
            `${HEADER}\n` +
                'கஜானன்,"யானை முகக்கடவுள், விநாயகன்",boy,tamil,க,p,1.0,o,r,' +
                '"{""a2z"": ""G""}"\n',
        );

        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            name: 'கஜானன்',
            meaning: 'யானை முகக்கடவுள், விநாயகன்',
            gender: 'boy',
        });
    });

    // A trailing newline and CRLF would each otherwise close a second, empty
    // row, which then reads as a record with no spelling.
    it('ends a row once, however the line ends', () => {
        expect(
            parseScan(`${HEADER}\r\nஅ,ம,boy,tamil,அ,p,1.0,o,r,\r\n`),
        ).toHaveLength(1);
    });

    it('refuses a scan missing a column it reads', () => {
        expect(() => parseScan('name,meaning\nஅ,ம\n')).toThrow(/gender/);
    });
});

describe('batching a package', () => {
    it('pairs the two scripts of one record into a single name', () => {
        const batch = scoutBatch([row(), latin()], {
            package: 'com.rmitms.namesBabyTamil',
            title: 'Baby Names Tamil',
        });

        expect(batch.records).toBe(1);
        expect(batch.file.source).toMatchObject({
            slug: 'com.rmitms.namesBabyTamil',
            kind: 'android-app',
            title: 'Baby Names Tamil',
            version: '2.0',
        });
        expect(batch.file.names).toEqual([
            {
                name: 'கணேஷ்',
                gender: 'boy',
                religion: null,
                language: null,
                meanings: ['சிவனின் மகன்'],
                notes: 'The source spells it "Ganesh" in Latin script.',
                attestation: {
                    locator: 'classes.dex#record0:1',
                    excerpt: 'கணேஷ் (Ganesh) — சிவனின் மகன்',
                },
            },
        ]);
    });

    // The one thing the batch must not do: file a list of names under a
    // religion the source never named.
    it('files nothing under a religion or a language by default', () => {
        const [name] = scoutBatch([row()], {
            package: 'com.rmitms.namesBabyTamil',
        }).file.names as Array<Record<string, unknown>>;

        expect(name).toMatchObject({ religion: null, language: null });
    });

    // An app called "Muslim Tamil Names" is stating a religion of its whole
    // catalogue, even though no column holds it.
    it('files the whole package under a religion the caller states', () => {
        const batch = scoutBatch(
            [row({ package: 'bridleway.muslimtamilnames' })],
            {
                package: 'bridleway.muslimtamilnames',
                religionSlug: 'muslim',
            },
        );

        expect(batch.file.names).toMatchObject([
            { religion: 'muslim', language: null },
        ]);
    });

    // nithra.babyname files every name itself, in its own Tamil labels.
    it('files each name where the source filed it', () => {
        const batch = scoutBatch(
            [
                row({ extra: '{"Religion": "இந்து", "languages": "தமிழ்"}' }),
                row({
                    name: 'அப்துல்',
                    record: 'r2',
                    extra: '{"Religion": "முஸ்லிம்", "languages": "-"}',
                }),
            ],
            {
                package: 'com.rmitms.namesBabyTamil',
                religion: {
                    field: 'Religion',
                    values: { இந்து: 'hindu', முஸ்லிம்: 'muslim' },
                },
                language: { field: 'languages', values: { தமிழ்: 'tamil' } },
            },
        );

        expect(batch.file.names).toMatchObject([
            { religion: 'hindu', language: 'tamil' },
            // "-" is not a language, and inventing one for it would be worse
            // than leaving the row for a reviewer.
            { religion: 'muslim', language: null },
        ]);
    });

    // 13,351 of nithra's names carry "-" where a meaning would go. Importing
    // that would put a dash on the site under every one of them.
    it('reads a placeholder meaning as no meaning', () => {
        const batch = scoutBatch(
            [
                row({ meaning: '-' }),
                row({ name: 'அன்பு', record: 'r2', meaning: ' — ' }),
            ],
            { package: 'com.rmitms.namesBabyTamil' },
        );

        expect(batch.file.names).toMatchObject([
            { meanings: [] },
            { meanings: [] },
        ]);
    });

    // One app's database is several tables and they are not all catalogues.
    it('takes only the rows from the origin it was pointed at', () => {
        const batch = scoutBatch(
            [
                row({ origin: 'baby.db#baby_names.Name' }),
                row({
                    name: 'பரணி',
                    record: 'r2',
                    origin: 'baby.db#star_use.star',
                }),
            ],
            { package: 'com.rmitms.namesBabyTamil', origin: 'baby_names.' },
        );

        expect(batch.records).toBe(1);
        expect(batch.file.names).toMatchObject([{ name: 'கணேஷ்' }]);
    });

    // twin_baby_names puts both children on one row, so one record id carries
    // two names in the same script. Pairing them as spellings loses the second.
    it('reads two rows of one script as two names, not two spellings', () => {
        const batch = scoutBatch(
            [
                row({ name: 'ஆச்சார்யா', record: 'twins:0' }),
                row({ name: 'ஆத்ரேயா', record: 'twins:0' }),
                row({ name: 'Acharya', record: 'twins:0', script: 'latin' }),
            ],
            { package: 'com.rmitms.namesBabyTamil' },
        );

        expect(batch.records).toBe(2);
        expect(batch.file.names).toMatchObject([
            // The Latin row pairs with the first Tamil one, as a spelling.
            {
                name: 'ஆச்சார்யா',
                notes: 'The source spells it "Acharya" in Latin script.',
            },
            { name: 'ஆத்ரேயா', notes: null },
        ]);
    });

    it('keeps a record the scan only found in Latin', () => {
        const batch = scoutBatch([latin({ record: 'classes.dex#record1:0' })], {
            package: 'com.rmitms.namesBabyTamil',
        });

        expect(batch.file.names).toMatchObject([
            { name: 'Ganesh', notes: null },
        ]);
    });

    it('leaves out a record the scan gives no gender', () => {
        const batch = scoutBatch([row({ gender: '' }), latin({ gender: '' })], {
            package: 'com.rmitms.namesBabyTamil',
        });

        expect(batch.file.names).toHaveLength(0);
        expect(batch.skipped).toEqual([
            {
                record: 'classes.dex#record0:1',
                name: 'கணேஷ்',
                reason: 'no gender',
            },
        ]);
    });

    // The app whose gender column the scan could not read: assets/dbs.db keeps
    // it as x=0/1, which is as likely to be a favourite flag as a gender.
    it('reads gender from a flag it was told the meaning of', () => {
        const flagged = (x: string, name: string): ScoutRow =>
            row({
                name,
                gender: '',
                record: `assets_dbs.db#names:${name}`,
                extra: JSON.stringify({ x }),
            });

        const batch = scoutBatch(
            [flagged('0', 'அபீர்'), flagged('1', 'அபீப்')],
            {
                package: 'com.rmitms.namesBabyTamil',
                gender: { field: 'x', values: { '0': 'girl', '1': 'boy' } },
            },
        );

        expect(batch.file.names).toMatchObject([
            { name: 'அபீர்', gender: 'girl' },
            { name: 'அபீப்', gender: 'boy' },
        ]);
    });

    it('leaves out a record whose flag the mapping does not cover', () => {
        const batch = scoutBatch([row({ gender: '', extra: '{"x": "2"}' })], {
            package: 'com.rmitms.namesBabyTamil',
            gender: { field: 'x', values: { '0': 'girl' } },
        });

        expect(batch.file.names).toHaveLength(0);
        expect(batch.skipped[0]).toMatchObject({ reason: 'no gender' });
    });

    // The scan's own reading wins: a flag is a fallback for what it could not
    // work out, not an override of what it did.
    it('prefers the gender the scan read over the flag', () => {
        const batch = scoutBatch([row({ extra: '{"x": "0"}' })], {
            package: 'com.rmitms.namesBabyTamil',
            gender: { field: 'x', values: { '0': 'girl' } },
        });

        expect(batch.file.names).toMatchObject([{ gender: 'boy' }]);
    });

    it('takes only the package it was asked for', () => {
        const batch = scoutBatch(
            [row(), row({ package: 'com.tos.qurantamil', record: 'x' })],
            { package: 'com.rmitms.namesBabyTamil' },
        );

        expect(batch.records).toBe(1);
        expect(batch.file.names).toHaveLength(1);
    });

    // Every row of these packages carries an empty record id, so grouping on
    // it alone would read the whole app as one name.
    it('keeps records apart when the scan numbers none of them', () => {
        const batch = scoutBatch(
            [
                row({ record: '', name: 'அறிவு' }),
                row({ record: '', name: 'அன்பு' }),
            ],
            { package: 'com.rmitms.namesBabyTamil' },
        );

        expect(batch.records).toBe(2);
        expect(batch.file.names).toHaveLength(2);
    });
});
