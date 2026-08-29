import {
    getBirthDate,
    getMoonSign,
    getMoonSignIndex,
    IFilterData,
    IName,
    ITwinName,
} from '@tbn/shared';
import { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { describe, expect, it, vi } from 'vitest';

import {
    buildDocument,
    DocumentOrigin,
    withFonts,
} from '../src/export/export.document';

const origin: DocumentOrigin = {
    host: 'tamil-baby-names.test',
    link: 'https://tamil-baby-names.test/',
};

const base: IFilterData = {
    startsWithMode: 'none',
    tob: '',
    tz: 'Asia/Kolkata',
    panjangam: 'thirukanitha',
    numerology: 'enkanitham',
};

const names = [
    {
        id: 1,
        name: 'அறிவு',
        meaning: 'Wisdom',
        gender: 'boy',
        religion: 'இந்து',
        language: 'Tamil',
        nameNumber: 5,
    },
] as IName[];

const twins = [
    {
        id: 1,
        name1: 'அகமது',
        meaning1: 'One',
        name2: 'முகம்மது',
        meaning2: 'Two',
        gender: 'boy',
        language: 'Tamil',
        nameNumber1: 5,
        nameNumber2: null,
    },
] as unknown as ITwinName[];

const build = (
    filters: IFilterData,
    rows: Array<IName | ITwinName> = names,
    zodiacIcon = vi.fn(() => 'data:image/png;base64,ICON'),
) => ({
    document: buildDocument(filters, rows, origin, zodiacIcon),
    zodiacIcon,
});

const tables = (document: TDocumentDefinitions) =>
    (document.content as Content[]).filter(
        (item): item is Content & { table: { body: TableCell[][] } } =>
            typeof item === 'object' && item !== null && 'table' in item,
    );

const namesTable = (document: TDocumentDefinitions) => {
    const found = tables(document);

    return found[found.length - 1].table.body;
};

const textOf = (cell: unknown): string => {
    if (cell === null || cell === undefined) {
        return '';
    }

    if (typeof cell !== 'object') {
        return String(cell);
    }

    if (Array.isArray(cell)) {
        return cell.map(textOf).join(' ');
    }

    const node = cell as Record<string, unknown>;

    return [node.text, node.stack, node.columns]
        .filter((value) => value !== undefined)
        .map(textOf)
        .join(' ');
};

const flatten = (rows: TableCell[][]) =>
    rows.map((row) => row.map(textOf).join('|')).join('\n');

describe('buildDocument', () => {
    it('names the columns the filters did not already pin down', () => {
        const [header] = namesTable(build(base).document);

        expect(header.map(textOf)).toEqual([
            'S.No',
            'Name',
            'Meaning',
            'No.',
            'Gender',
            'Religion',
            'Language',
        ]);
    });

    it('drops the columns the filters already pinned down', () => {
        const [header] = namesTable(
            build({ ...base, gender: 'boy', religion: 'hindu' }).document,
        );

        expect(header.map(textOf)).toEqual([
            'S.No',
            'Name',
            'Meaning',
            'No.',
            'Language',
        ]);
    });

    it('turns the sheet on its side for twin names', () => {
        const { document } = build({ ...base, twinNames: true }, twins);

        expect(document.pageOrientation).toBe('landscape');
        expect(namesTable(document)[0].map(textOf)).toEqual([
            'S.No',
            'Name 1',
            'Meaning 1',
            'Name 2',
            'Meaning 2',
            'No.',
            'Gender',
            'Language',
        ]);
    });

    it('prints both numbers of a pair, and a dash for one with no value', () => {
        const { document } = build({ ...base, twinNames: true }, twins);
        const [, row] = namesTable(document);

        expect(row.map(textOf)).toContain('5 / -');
    });

    it('reads the gender of a row in tamil', () => {
        expect(flatten(namesTable(build(base).document))).toContain('ஆண்');
    });

    it('asks for no zodiac icon when the letters were picked by hand', () => {
        const { zodiacIcon } = build({
            ...base,
            startsWithMode: 'manual',
            startsWith: ['க'],
        });

        expect(zodiacIcon).not.toHaveBeenCalled();
    });

    it('asks for the icon of the moon sign the birth time falls in', () => {
        const filters: IFilterData = {
            ...base,
            startsWithMode: 'auto',
            tob: '2000-01-01T05:30',
        };

        const date = getBirthDate(filters.tob, filters.tz);
        const sign = getMoonSign(
            getMoonSignIndex(date!, filters.panjangam),
            'en',
        );

        const { document, zodiacIcon } = build(filters);

        expect(zodiacIcon).toHaveBeenCalledExactlyOnceWith(sign.toLowerCase());
        expect(flatten(tables(document)[0].table.body)).toContain(sign);
    });

    it('names the panjangam only when it is not the default', () => {
        const auto: IFilterData = {
            ...base,
            startsWithMode: 'auto',
            tob: '2000-01-01T05:30',
        };

        expect(
            flatten(tables(build(auto).document)[0].table.body),
        ).not.toContain('Panjangam');
        expect(
            flatten(
                tables(build({ ...auto, panjangam: 'vakkiya' }).document)[0]
                    .table.body,
            ),
        ).toContain('Panjangam');
    });

    it('names the numerology only when it is not the default', () => {
        expect(tables(build(base).document)).toHaveLength(1);
        expect(
            flatten(
                tables(
                    build({ ...base, numerology: 'pythagorean' }).document,
                )[0].table.body,
            ),
        ).toContain('Numerology');
    });

    it('lists the picked numbers and letters', () => {
        const { document } = build({
            ...base,
            startsWithMode: 'manual',
            startsWith: ['க', 'A'],
            nameNumbers: [1, 5],
        });

        const printed = flatten(tables(document)[0].table.body);

        expect(printed).toContain('1, 5');
        expect(printed).toContain('Starts With');
        expect(printed).toContain('A');
        expect(printed).toContain('க');
    });

    it('links the footer back to the site that rendered it', () => {
        const [footer] = build(base).document.footer as Array<{
            text: string;
            link: string;
        }>;

        expect(footer.text).toBe(origin.host);
        expect(footer.link).toBe(origin.link);
    });
});

describe('withFonts', () => {
    it('sets the tamil font for anything outside latin-1, and a number', () => {
        const [row] = withFonts([['Name', 'அறிவு', 5]]);

        expect(row.map((cell) => (cell as { font: string }).font)).toEqual([
            'Roboto',
            'Barathi',
            'Barathi',
        ]);
    });

    it('leaves a cell that already says how to render itself', () => {
        const cell = { text: 'அறிவு', font: 'Roboto' };

        expect(withFonts([[cell]])[0][0]).toBe(cell);
    });
});
