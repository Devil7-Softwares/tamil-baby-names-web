import axios from 'axios';
import cookieParser from 'cookie-parser';
import { config } from 'dotenv';
import express, { RequestHandler } from 'express';
import expressStaticGzip from 'express-static-gzip';
import { existsSync, readFileSync } from 'fs';
import jwt, { TokenExpiredError } from 'jsonwebtoken';
import { join, resolve } from 'path';
import pdfmake from 'pdfmake';
import { Content, TableCell } from 'pdfmake/interfaces';
import { DataTypes, Model, Op, Sequelize, WhereOptions } from 'sequelize';
import { parse } from 'url';

import { IFilterData, IName, ITwinName } from './interfaces';
import {
    DEFAULT_PANJANGAM,
    getLunarMansion,
    getLunarMansionIndex,
    getMoonSign,
    getMoonSignIndex,
    locales,
} from './utils/astro';
import {
    getBirthDate,
    getBirthNumberFor,
    getDocumentTitleByFilter,
    getStartingLettersForFilter,
    getStateFromParams,
    sentenseCase,
} from './utils/Common';
import {
    DEFAULT_NUMEROLOGY,
    getNameNumber,
    numerologyLocales,
} from './utils/numerology';

config({ quiet: true });

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable must be set.');
}

const sequalize = new Sequelize({
    host: process.env.MYSQL_HOST,
    database: process.env.MYSQL_DATABASE,
    username: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    dialect: 'mysql',
});

const Names = sequalize.define<Model<IName>>(
    'Names',
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        gender: DataTypes.STRING,
        religion: DataTypes.STRING,
        firstLetter: { type: DataTypes.STRING, field: 'first_letter' },
        language: DataTypes.STRING,
        name: DataTypes.STRING,
        meaning: DataTypes.STRING,
    },
    {
        tableName: 'names',
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci',
        timestamps: false,
    },
);

const TwinNames = sequalize.define<Model<ITwinName>>(
    'TwinNames',
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        gender: DataTypes.STRING,
        language: DataTypes.STRING,
        name1: DataTypes.STRING,
        meaning1: DataTypes.STRING,
        name2: DataTypes.STRING,
        meaning2: DataTypes.STRING,
    },
    {
        tableName: 'twin_names',
        charset: 'utf8mb4',
        collate: 'utf8mb4_unicode_ci',
        timestamps: false,
    },
);

const publicDir = [
    join(__dirname, 'public'),
    join(process.cwd(), 'public'),
].find((path) => existsSync(path));
const assetsDir =
    [join(__dirname, 'assets'), join(process.cwd(), 'assets')].find((path) =>
        existsSync(path),
    ) || './assets';
const fontsDir = join(assetsDir, 'fonts');

pdfmake.setFonts({
    Roboto: {
        normal: join(fontsDir, 'Roboto-Regular.ttf'),
        bold: join(fontsDir, 'Roboto-Bold.ttf'),
    },
    Barathi: {
        normal: join(fontsDir, 'TAU-Barathi-Regular.ttf'),
    },
});

pdfmake.setLocalAccessPolicy((path) =>
    resolve(path).startsWith(resolve(fontsDir)),
);
pdfmake.setUrlAccessPolicy(() => false);

const indexHtml = publicDir
    ? readFileSync(join(publicDir, 'index.html'), 'utf-8')
    : null;

const authMiddleware: RequestHandler = (req, res, next) => {
    const accessToken = req.cookies['accessToken'];

    if (!accessToken) {
        return res
            .status(401)
            .send({ success: false, message: 'No token provided!' });
    }

    try {
        res.locals.filterOptions = jwt.verify(accessToken, jwtSecret) as Record<
            string,
            unknown
        >;

        if (res.locals.filterOptions.exp) delete res.locals.filterOptions.exp;
        if (res.locals.filterOptions.iat) delete res.locals.filterOptions.iat;

        next();
    } catch (error) {
        if (error instanceof TokenExpiredError) {
            return res
                .status(401)
                .send({ success: false, message: 'Token expired!' });
        } else {
            return res
                .status(401)
                .send({ success: false, message: 'Invalid token!' });
        }
    }
};

const indexHandler: RequestHandler = (req, res) => {
    if (!indexHtml) {
        return res.status(404).send('Not found!');
    }

    if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        res.status(200);

        const search = parse(req.url || '').search;
        if (search) {
            const title = getDocumentTitleByFilter(
                getStateFromParams(new URLSearchParams(search)),
            );

            res.send(
                indexHtml.replace(
                    /<title>(.*?)<\/title>/,
                    `<title>${title}</title>`,
                ),
            );
        } else {
            res.send(indexHtml);
        }
    }
};

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (publicDir) {
    console.log(`Using public dir: ${publicDir}`);

    app.get('/', indexHandler);

    app.use(
        expressStaticGzip(publicDir, {
            enableBrotli: true,
            orderPreference: ['br', 'gz'],
        }),
    );
} else {
    console.log(`No public dir found!`);
}

app.post('/api/generate', async (req, res) => {
    const token = req.header('token');

    if (!token) {
        return res
            .status(400)
            .send({ success: false, message: 'Invalid request!' });
    }

    const filters = req.body;

    try {
        const captchaResponse = await axios.post(
            `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`,
        );

        if (!captchaResponse.data.success) {
            console.error(
                'Recaptcha verfication failed!',
                captchaResponse.data,
            );
            return res.status(400).send({
                success: false,
                message: 'CAPTCHA verification failed!',
            });
        }
    } catch (error) {
        console.error('Recaptcha verfication failed!', error);
        return res.status(400).send({
            success: false,
            message: 'CAPTCHA verification failed!',
        });
    }

    const accessToken = jwt.sign(filters, jwtSecret, {
        expiresIn: '1h',
    });

    res.cookie('accessToken', accessToken).send({
        success: true,
        message: 'Access token generated successfully!',
    });
});

const TAMIL_VOWEL_SIGN = /[\u0BBE-\u0BCD]/;

const isBareTamilLetter = (letter: string) =>
    /[\u0B80-\u0BFF]/.test(letter) && !TAMIL_VOWEL_SIGN.test(letter.slice(-1));

const startsWithLetter = (
    column: 'name1' | 'name2',
    letter: string,
    exactSyllable: boolean,
): WhereOptions =>
    exactSyllable && isBareTamilLetter(letter)
        ? {
              [Op.and]: [
                  { [column]: { [Op.like]: `${letter}%` } },
                  {
                      [column]: {
                          [Op.notRegexp]: `^${letter}[\\x{0BBE}-\\x{0BCD}]`,
                      },
                  },
              ],
          }
        : { [column]: { [Op.like]: `${letter}%` } };

const hasNameNumberFilter = (filters: IFilterData) =>
    Boolean(filters.nameNumbers && filters.nameNumbers.length);

/**
 * SQL cannot compute a name's number, so this filter runs over the rows and the
 * query gives up its own LIMIT: the page has to be cut from the rows that
 * survive the filter, not from the ones that reached it.
 */
function applyNameNumbers<T extends IName | ITwinName>(
    filters: IFilterData,
    rows: T[],
    total: number,
    page?: number,
    limit?: number,
): [T[], number] {
    const wanted = filters.nameNumbers;

    if (!wanted || !wanted.length) {
        return [rows, total];
    }

    const filtered = rows.filter((item) => {
        const names = 'name1' in item ? [item.name1, item.name2] : [item.name];

        // Either name qualifies the pair; both numbers are printed, so which
        // one matched stays visible.
        return names.some((name) => {
            const value = getNameNumber(name, filters.numerology);

            return value !== null && wanted.includes(value.number);
        });
    });

    return [
        page && limit
            ? filtered.slice((page - 1) * limit, page * limit)
            : filtered,
        filtered.length,
    ];
}

async function getNamesForFilter(
    filters: IFilterData,
    page?: number,
    limit?: number,
): Promise<[IName[] | ITwinName[], number]> {
    const startsWith = getStartingLettersForFilter(filters);
    const paged = hasNameNumberFilter(filters) ? undefined : { page, limit };

    if (filters.twinNames) {
        const where = {
            [Op.and]: [
                startsWith && startsWith.length
                    ? {
                          [Op.or]: startsWith.reduce<WhereOptions[]>(
                              (arr, char) => {
                                  const exactSyllable =
                                      filters.startsWithMode === 'auto';

                                  arr.push(
                                      startsWithLetter(
                                          'name1',
                                          char,
                                          exactSyllable,
                                      ),
                                  );
                                  arr.push(
                                      startsWithLetter(
                                          'name2',
                                          char,
                                          exactSyllable,
                                      ),
                                  );

                                  return arr;
                              },
                              [],
                          ),
                      }
                    : null,
                filters.gender
                    ? {
                          gender: filters.gender,
                      }
                    : null,
            ].filter((item) => item !== null),
        };

        const { rows, count } = await TwinNames.findAndCountAll({
            where,
            offset:
                paged?.page && paged.limit
                    ? (paged.page - 1) * paged.limit
                    : undefined,
            limit: paged?.limit,
        });

        return applyNameNumbers(
            filters,
            rows.map((item) => item.dataValues),
            count,
            page,
            limit,
        );
    } else {
        const where = {
            [Op.and]: [
                startsWith && startsWith.length
                    ? filters.startsWithMode === 'manual'
                        ? {
                              // A picked letter means "names beginning with
                              // it": prefix-match `first_letter` (it stores
                              // whole syllables, so `க` must reach `கா`) and
                              // the name itself for Latin spellings.
                              [Op.or]: startsWith.reduce<WhereOptions[]>(
                                  (arr, char) => {
                                      arr.push({
                                          firstLetter: {
                                              [Op.like]: `${char}%`,
                                          },
                                      });
                                      arr.push({
                                          name: {
                                              [Op.like]: `${char}%`,
                                          },
                                      });

                                      return arr;
                                  },
                                  [],
                              ),
                          }
                        : {
                              // Auto mode names exact syllables, and
                              // `first_letter` already normalises Latin
                              // spellings onto them, so match it exactly.
                              firstLetter: {
                                  [Op.in]: startsWith,
                              },
                          }
                    : null,
                filters.gender
                    ? {
                          gender: filters.gender,
                      }
                    : null,
                filters.religion
                    ? {
                          religion:
                              filters.religion === 'hindu'
                                  ? 'இந்து'
                                  : filters.religion === 'christian'
                                    ? 'கிறிஸ்துவர்'
                                    : 'முஸ்லிம்',
                      }
                    : null,
            ].filter((item) => item !== null),
        };

        const { rows, count } = await Names.findAndCountAll({
            where,
            offset:
                paged?.page && paged.limit
                    ? (paged.page - 1) * paged.limit
                    : undefined,
            limit: paged?.limit,
        });

        return applyNameNumbers(
            filters,
            rows.map((item) => item.dataValues),
            count,
            page,
            limit,
        );
    }
}

function withFonts(rows: TableCell[][]): TableCell[][] {
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
const nameNumberCell = (
    filters: IFilterData,
    item: IName | ITwinName,
): TableCell => ({
    text: ('name1' in item ? [item.name1, item.name2] : [item.name])
        .map(
            (name) =>
                getNameNumber(name, filters.numerology)?.number.toString() ??
                '-',
        )
        .join(' / '),
    font: 'Roboto',
    noWrap: true,
});

app.get('/api/names', authMiddleware, async (req, res) => {
    const filters = (res.locals.filterOptions || {}) as IFilterData;

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 25;

    try {
        const [rows, count] = await getNamesForFilter(filters, page, limit);

        res.send({
            success: true,
            message: 'Names fetched successfully!',
            data: rows,
            total: count,
            filters,
        });
    } catch (error) {
        console.error('Failed to establish database connection!', error);
        res.status(500).send({
            success: false,
            message: 'Database connection failed!',
        });
    }
});

app.get('/api/export', authMiddleware, async (req, res) => {
    const filters = (res.locals.filterOptions || {}) as IFilterData;

    try {
        const [rows] = await getNamesForFilter(filters);

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
                                    text: locales.en.panjangams[
                                        filters.panjangam
                                    ],
                                    font: 'Roboto',
                                },
                                {
                                    text: locales.ta.panjangams[
                                        filters.panjangam
                                    ],
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
                    image: `data:image/png;base64,${readFileSync(
                        join(assetsDir, 'zodiac', `${iconName}.png`),
                    ).toString('base64')}`,
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

        console.log(filters);

        const pdfDoc = pdfmake.createPdf({
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
                                    ? [
                                          'Name 1',
                                          'Meaning 1',
                                          'Name 2',
                                          'Meaning 2',
                                      ]
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
                                nameNumberCell(filters, item),
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
                    text: req.hostname,
                    alignment: 'right',
                    link: `${req.protocol}://${req.get('host')}/`,
                    color: '#4f4f4f',
                    margin: [20, 10, 20, 5],
                },
            ],
        });

        const pdfBuffer = await pdfDoc.getBuffer();

        res.setHeader('Content-Type', 'application/pdf');

        if (req.query.inline === 'true') {
            res.setHeader('Content-Disposition', 'inline');
        } else {
            res.setHeader(
                'Content-Disposition',
                'attachment; filename=BabyNames.pdf',
            );
        }

        res.send(pdfBuffer);
    } catch (error) {
        console.error('Failed to establish database connection!', error);
        res.status(500).send({
            success: false,
            message: 'Database connection failed!',
        });
    }
});

app.post('/api/letters', async (req, res) => {
    const filters = (req.body || {}) as IFilterData;

    try {
        const where = filters.gender ? 'WHERE gender = :gender' : '';
        const replacements = filters.gender ? { gender: filters.gender } : {};

        const [letters] = await (filters.twinNames
            ? sequalize.query(
                  /*sql*/ `
                SELECT DISTINCT left(name1, 1) firstLetter FROM twin_names ${where}
                UNION
                SELECT DISTINCT left(name2, 1) firstLetter FROM twin_names ${where}
                ORDER BY firstLetter;
            `,
                  { replacements },
              )
            : sequalize.query(
                  /*sql*/ `
                SELECT DISTINCT left(name, 1) firstLetter FROM names ${where} ORDER BY firstLetter;
            `,
                  { replacements },
              ));

        res.send({
            success: true,
            message: 'Names fetched successfully!',
            data: (letters as Array<{ firstLetter: string }>).map(
                (item) => item.firstLetter,
            ),
        });
    } catch (error) {
        console.error('Failed to establish database connection!', error);
        res.status(500).send({
            success: false,
            message: 'Database connection failed!',
        });
    }
});

if (publicDir) {
    app.get('/*splat', indexHandler);
}

sequalize
    .authenticate()
    .then(async () => {
        console.log('Database authentication successful!');

        try {
            await Names.sync();
            await TwinNames.sync();
        } catch (error) {
            console.log('Failed to syncronise tables!', error);
        }
    })
    .catch((error) => {
        console.log('Failed to authenticate to database!', error);
    });

app.listen(process.env.PORT || 3000, () => {
    console.log('Server started!');
});
