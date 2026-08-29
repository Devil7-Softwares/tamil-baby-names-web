import {
    DEFAULT_NUMEROLOGY,
    DEFAULT_PANJANGAM,
    getBirthDate,
    getBirthNumberFor,
    getLunarMansion,
    getLunarMansionIndex,
    getMoonSign,
    getMoonSignIndex,
    getStartingLettersForFilter,
    IFilterData,
    IName,
    ITwinName,
    locales,
    numerologyLocales,
    sentenseCase,
} from '@tbn/shared';
import { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';

import { numbersOf } from '../names/names.query';

export interface DocumentOrigin {
    host: string;
    link: string;
}

export function withFonts(rows: TableCell[][]): TableCell[][] {
    return rows.map((row) =>
        row.map((cell) =>
            typeof cell === 'object'
                ? cell
                : {
                      font:
                          typeof cell === 'number' ||
                          /[^\u0000-\u00ff]/.test(String(cell))
                              ? 'Barathi'
                              : 'Roboto',
                      text: cell,
                  },
        ),
    );
}
/**
 * Sets its own font and refuses to wrap: the column is only as wide as its
 * "No." heading, which would otherwise break "5 / 9" across two lines.
 */
const nameNumberCell = (item: IName | ITwinName): TableCell => ({
    text: numbersOf(item)
        .map((value) => value?.toString() ?? '-')
        .join(' / '),
    font: 'Roboto',
    noWrap: true,
});

export function buildDocument(
    filters: IFilterData,
    rows: Array<IName | ITwinName>,
    origin: DocumentOrigin,
    zodiacIcon: (sign: string) => string,
): TDocumentDefinitions {
    const filterTable: TableCell[][] = [];
    let iconName: string | null = null;
    let rowHeight = 2;

    if (filters.gender) {
        filterTable.push(['Gender', ':', sentenseCase(filters.gender)]);
        rowHeight += 20;
    }

    if (filters.religion) {
        filterTable.push(['Religion', ':', sentenseCase(filters.religion)]);
        rowHeight += 20;
    }

    if (filters.startsWithMode === 'auto') {
        const date = getBirthDate(filters.tob, filters.tz);

        if (date) {
            const moonSignIndex = getMoonSignIndex(date, filters.panjangam);
            const lunarMansionIndex = getLunarMansionIndex(
                date,
                filters.panjangam,
            );

            const moonSignEN = getMoonSign(moonSignIndex, 'en');
            const moonSignTA = getMoonSign(moonSignIndex, 'ta');
            const lunarMansionEN = getLunarMansion(lunarMansionIndex, 'en');
            const lunarMansionTA = getLunarMansion(lunarMansionIndex, 'ta');

            iconName = moonSignEN.toLowerCase();

            // The two methods disagree for roughly one birth in eleven, so
            // a sheet computed the non-default way has to say so.
            if (filters.panjangam !== DEFAULT_PANJANGAM) {
                filterTable.push([
                    {
                        columns: [
                            {
                                text: 'Panjangam / ',
                                font: 'Roboto',
                                preserveTrailingSpaces: true,
                            },
                            { text: 'பஞ்சாங்கம்', font: 'Barathi' },
                        ],
                    },
                    ':',
                    {
                        stack: [
                            {
                                text: locales.en.panjangams[filters.panjangam],
                                font: 'Roboto',
                            },
                            {
                                text: locales.ta.panjangams[filters.panjangam],
                                font: 'Barathi',
                            },
                        ],
                    },
                ]);

                rowHeight += 15 * 2;
            }

            filterTable.push([
                {
                    columns: [
                        {
                            text: 'Moon Sign / ',
                            font: 'Roboto',
                            preserveTrailingSpaces: true,
                        },
                        { text: 'ராசி', font: 'Barathi' },
                    ],
                },
                ':',
                {
                    stack: [
                        {
                            text: moonSignEN,
                            font: 'Roboto',
                        },
                        {
                            text: moonSignTA,
                            font: 'Barathi',
                        },
                    ],
                },
            ]);

            filterTable.push([
                {
                    columns: [
                        {
                            text: `Lunar Mansion / `,
                            font: 'Roboto',
                            preserveTrailingSpaces: true,
                        },
                        { text: 'நட்சத்திரம்', font: 'Barathi' },
                    ],
                },
                ':',
                {
                    stack: [
                        {
                            text: lunarMansionEN,
                            font: 'Roboto',
                        },
                        { text: lunarMansionTA, font: 'Barathi' },
                    ],
                },
            ]);

            rowHeight += 15 * 4;

            const birthNumber = getBirthNumberFor(
                filters.startsWithMode,
                filters.tob,
                filters.tz,
            );

            if (birthNumber !== null) {
                filterTable.push([
                    {
                        columns: [
                            {
                                text: 'Birth Number / ',
                                font: 'Roboto',
                                preserveTrailingSpaces: true,
                            },
                            { text: 'பிறந்த எண்', font: 'Barathi' },
                        ],
                    },
                    ':',
                    { text: String(birthNumber), font: 'Roboto' },
                ]);

                rowHeight += 15;
            }
        }
    }

    // Same reason the panjangam is named: the numbers in the sheet mean
    // nothing without the method that produced them.
    if (filters.numerology !== DEFAULT_NUMEROLOGY) {
        filterTable.push([
            {
                columns: [
                    {
                        text: 'Numerology / ',
                        font: 'Roboto',
                        preserveTrailingSpaces: true,
                    },
                    { text: 'எண்கணிதம்', font: 'Barathi' },
                ],
            },
            ':',
            {
                stack: [
                    {
                        text: numerologyLocales.en.numerologies[
                            filters.numerology
                        ],
                        font: 'Roboto',
                    },
                    {
                        text: numerologyLocales.ta.numerologies[
                            filters.numerology
                        ],
                        font: 'Barathi',
                    },
                ],
            },
        ]);

        rowHeight += 15 * 2;
    }

    if (filters.nameNumbers && filters.nameNumbers.length) {
        filterTable.push([
            {
                columns: [
                    {
                        text: 'Name Number / ',
                        font: 'Roboto',
                        preserveTrailingSpaces: true,
                    },
                    { text: 'பெயர் எண்', font: 'Barathi' },
                ],
            },
            ':',
            { text: filters.nameNumbers.join(', '), font: 'Roboto' },
        ]);

        rowHeight += 15;
    }

    const startingLetters = getStartingLettersForFilter(filters);

    if (startingLetters && startingLetters.length) {
        const startsWithEnglish = startingLetters.filter(
            (item) => !/[^\u0000-\u00ff]/.test(String(item)),
        );

        const startsWithTamil = startingLetters.filter((item) =>
            /[^\u0000-\u00ff]/.test(String(item)),
        );

        const startsWith: Content[] = [];

        if (startsWithEnglish.length) {
            startsWith.push({
                text: startsWithEnglish.join(', '),
                font: 'Roboto',
            });
        }

        if (startsWithTamil.length) {
            startsWith.push({
                text: startsWithTamil.join(', '),
                font: 'Barathi',
            });
        }

        filterTable.push(['Starts With', ':', { stack: startsWith }]);

        rowHeight += 15 * startsWith.length;
    }

    if (iconName) {
        filterTable.unshift([
            '',
            '',
            '',
            {
                image: zodiacIcon(iconName),
                rowSpan: filterTable.length + 1,
                background: '#ffffff',
                width: 90,
                absolutePosition: {
                    x: 595.28 - 160,
                    y: (rowHeight - 90) / 2,
                },
            },
        ]);
    }

    return {
        pageOrientation: filters.twinNames ? 'landscape' : 'portrait',
        pageMargins: [20, 20, 20, 40],
        pageSize: 'A4', // 595.28 x 841.89
        watermark: {
            text: 'DEVIL7 SOFTWARES',
            opacity: 0.1,
        },
        content: [
            {
                columns: [
                    { width: '*', text: '' },
                    {
                        text: 'Tamil Baby Names',
                        fontSize: 20,
                        bold: true,
                        noWrap: true,
                    },
                    { width: '*', text: '' },
                ],
                marginBottom: 20,
            },
            filterTable.length
                ? {
                      fontSize: 12,
                      table: {
                          dontBreakRows: true,
                          body: withFonts(filterTable),
                      },
                      layout: 'noBorders',
                      marginBottom: 10,
                  }
                : (null as unknown as Content),
            {
                fontSize: 11,
                table: {
                    headerRows: 1,
                    widths: [
                        'auto',
                        ...(filters.twinNames
                            ? ['auto', '*', 'auto', '*']
                            : ['auto', '*']),
                        'auto',
                        ...(!filters.gender ? ['auto'] : []),
                        ...(!filters.twinNames && !filters.religion
                            ? ['auto']
                            : []),
                        'auto',
                    ],
                    body: withFonts([
                        [
                            'S.No',
                            ...(filters.twinNames
                                ? ['Name 1', 'Meaning 1', 'Name 2', 'Meaning 2']
                                : ['Name', 'Meaning']),
                            'No.',
                            ...(!filters.gender ? ['Gender'] : []),
                            ...(!filters.twinNames && !filters.religion
                                ? ['Religion']
                                : []),
                            'Language',
                        ],
                        ...rows.map((item, index) => [
                            index + 1,
                            ...('name1' in item
                                ? [
                                      item.name1,
                                      item.meaning1,
                                      item.name2,
                                      item.meaning2,
                                  ]
                                : [item.name, item.meaning]),
                            nameNumberCell(item),
                            ...(!filters.gender
                                ? [item.gender === 'boy' ? 'ஆண்' : 'பெண்']
                                : []),
                            ...('religion' in item && !filters.religion
                                ? [item.religion]
                                : []),
                            item.language,
                        ]),
                    ]),
                },
            },
        ].filter(Boolean),
        footer: [
            {
                text: origin.host,
                alignment: 'right',
                link: origin.link,
                color: '#4f4f4f',
                margin: [20, 10, 20, 5],
            },
        ],
    };
}
