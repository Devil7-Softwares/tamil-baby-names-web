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
    it('files nothing under a religion or a language', () => {
        const [name] = scoutBatch([row()], {
            package: 'com.rmitms.namesBabyTamil',
        }).file.names as Array<Record<string, unknown>>;

        expect(name).not.toHaveProperty('religion');
        expect(name).not.toHaveProperty('language');
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
