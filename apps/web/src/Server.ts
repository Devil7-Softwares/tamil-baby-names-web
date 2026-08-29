import {
    DEFAULT_NUMEROLOGY,
    DEFAULT_PANJANGAM,
    getLunarMansion,
    getLunarMansionIndex,
    getMoonSign,
    getMoonSignIndex,
    getNameNumber,
    IFilterData,
    implementedNumerologies,
    IName,
    ITwinName,
    locales,
    Numerology,
    numerologyLocales,
} from '@tbn/shared';
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
import {
    col,
    DataTypes,
    literal,
    Model,
    Op,
    Order,
    ProjectionAlias,
    Sequelize,
    WhereOptions,
} from 'sequelize';
import { parse } from 'url';

import {
    getBirthDate,
    getBirthNumberFor,
    getDocumentTitleByFilter,
    getStartingLettersForFilter,
    getStateFromParams,
    sentenseCase,
} from './utils/Common';

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

/**
 * Set once the precomputed columns exist and hold no NULLs. Until then the
 * numerology filter reads every matching row instead, so a database that
 * refuses the ALTER costs performance rather than correctness.
 */
let numerologyColumnsReady = false;

/**
 * 0 records "this method gives the name no value", which keeps it distinct from
 * NULL, "not computed yet" - so the backfill can resume on IS NULL alone.
 */
const NUMEROLOGY_TABLES = [
    { table: 'names', columns: [{ name: 'name', suffix: '' }] },
    {
        table: 'twin_names',
        columns: [
            { name: 'name1', suffix: '1' },
            { name: 'name2', suffix: '2' },
        ],
    },
] as const;

const BACKFILL_CHUNK = 1000;

async function backfillNumerology(
    table: string,
    nameColumn: string,
    target: string,
    numerology: Numerology,
): Promise<number> {
    let written = 0;

    for (;;) {
        const [rows] = (await sequalize.query(
            `SELECT \`id\`, \`${nameColumn}\` AS \`name\` FROM \`${table}\`
             WHERE \`${target}\` IS NULL LIMIT ${BACKFILL_CHUNK}`,
            { logging: false },
        )) as [Array<{ id: number; name: string }>, unknown];

        if (!rows.length) {
            return written;
        }

        const ids = new Map<number, number[]>();

        for (const row of rows) {
            const value = getNameNumber(row.name, numerology)?.number ?? 0;

            ids.set(value, [...(ids.get(value) || []), row.id]);
        }

        // One statement per distinct number rather than per row: at most ten,
        // whatever the chunk size.
        for (const [value, rowIds] of ids) {
            await sequalize.query(
                `UPDATE \`${table}\` SET \`${target}\` = ${value}
                 WHERE \`id\` IN (${rowIds.join(',')})`,
                { logging: false },
            );
        }

        written += rows.length;
    }
}

async function ensureNumerologyColumns() {
    for (const numerology of implementedNumerologies) {
        for (const { table, columns } of NUMEROLOGY_TABLES) {
            for (const { name, suffix } of columns) {
                const target = numerologyColumn(numerology, suffix);

                await sequalize.query(
                    `ALTER TABLE \`${table}\`
                     ADD COLUMN IF NOT EXISTS \`${target}\` TINYINT NULL`,
                    { logging: false },
                );

                const written = await backfillNumerology(
                    table,
                    name,
                    target,
                    numerology,
                );

                if (written) {
                    console.log(
                        `Backfilled ${table}.${target} for ${written} rows.`,
                    );
                }
            }
        }
    }
}

/**
 * `/api/generate` signs the request body as it stands, so these arrive from the
 * client. Sequelize escapes them, but only 1-9 ever means anything - and 0 is
 * the "no value" marker, which must never be selectable.
 */
const wantedNumbers = (filters: IFilterData): number[] =>
    (filters.nameNumbers || [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value >= 1 && value <= 9);

/**
 * The precomputed column for a method, derived from its name so that
 * registering one needs no mapping here.
 */
const numerologyColumn = (numerology: Numerology, suffix: '' | '1' | '2') => {
    if (!/^[a-z]+$/.test(numerology)) {
        throw new Error(`Unsafe numerology name: ${numerology}`);
    }

    return `${numerology}_number${suffix}`;
};

/**
 * Reads the stored column, so the number shown and the number filtered on are
 * the same value. A row inserted since the last backfill has none yet, and is
 * computed rather than reported as unvalued.
 */
const resolveNameNumber = (
    filters: IFilterData,
    name: string,
    stored: number | null | undefined,
): number | null => {
    if (stored === null || stored === undefined) {
        return getNameNumber(name, filters.numerology)?.number ?? null;
    }

    return stored === 0 ? null : stored;
};

const nameNumberAttributes = (
    filters: IFilterData,
): { include: ProjectionAlias[] } | undefined => {
    if (!numerologyColumnsReady) {
        return undefined;
    }

    const aliases: ReadonlyArray<readonly ['' | '1' | '2', string]> =
        filters.twinNames
            ? [
                  ['1', 'nameNumber1'],
                  ['2', 'nameNumber2'],
              ]
            : [['', 'nameNumber']];

    return {
        include: aliases.map(([suffix, alias]) => [
            col(numerologyColumn(filters.numerology, suffix)),
            alias,
        ]),
    };
};

const numbersOf = (item: IName | ITwinName) =>
    'name1' in item ? [item.nameNumber1, item.nameNumber2] : [item.nameNumber];

// Either name qualifies a twin pair; both numbers are printed, so which one
// matched stays visible.
const nameNumberWhere = (
    filters: IFilterData,
    wanted: number[],
): WhereOptions => ({
    [Op.or]: (filters.twinNames ? (['1', '2'] as const) : ([''] as const)).map(
        (suffix) => ({
            [numerologyColumn(filters.numerology, suffix)]: { [Op.in]: wanted },
        }),
    ),
});

/**
 * The fallback for when the columns are not ready: filter over the rows, which
 * costs the query its own LIMIT, since the page has to be cut from the rows
 * that survive the filter rather than the ones that reached it.
 */
function applyNameNumbers<T extends IName | ITwinName>(
    filters: IFilterData,
    rows: T[],
    total: number,
    page?: number,
    limit?: number,
): [T[], number] {
    const wanted = wantedNumbers(filters);

    if (!wanted.length) {
        return [rows, total];
    }

    const filtered = rows.filter((item) =>
        numbersOf(item).some(
            (value) =>
                value !== null && value !== undefined && wanted.includes(value),
        ),
    );

    return [
        page && limit
            ? filtered.slice((page - 1) * limit, page * limit)
            : filtered,
        filtered.length,
    ];
}

/**
 * The column's own `utf8mb4_unicode_ci` (UCA 4.0.0) orders Tamil by code point,
 * which misplaces ன, ற, ல, ள, ழ and வ. 5.2.0 knows the alphabet's order, and
 * unlike `utf8mb4_uca1400_ai_ci` it exists on the 10.11 the host runs; an empty
 * string leaves the column collation in place should a server not carry it.
 */
let sortCollation = '';

async function resolveSortCollation() {
    const [rows] = await sequalize.query(
        "SHOW COLLATION LIKE 'utf8mb4_unicode_520_ci'",
        { logging: false },
    );

    sortCollation = rows.length ? ' COLLATE utf8mb4_unicode_520_ci' : '';
}

/**
 * Unicode sorts the whole Latin block ahead of the whole Tamil one, so leaving
 * it at that buries every Tamil name pages deep behind the English spellings.
 * Ordering on the script first keeps each block whole, Tamil first. `id` breaks
 * ties, without which two rows sharing a name could swap places between pages.
 */
const nameOrder = (columns: string[]): Order => [
    ...columns.flatMap((column) => [
        literal(`\`${column}\` REGEXP '^[A-Za-z]'`),
        literal(`\`${column}\`${sortCollation}`),
    ]),
    'id',
];

async function getNamesForFilter(
    filters: IFilterData,
    page?: number,
    limit?: number,
): Promise<[IName[] | ITwinName[], number]> {
    const startsWith = getStartingLettersForFilter(filters);
    const wanted = wantedNumbers(filters);

    // With the columns in place the filter is just another predicate, so the
    // query keeps its own LIMIT; without them it has to read every match.
    const inSql = wanted.length > 0 && numerologyColumnsReady;
    const inMemory = wanted.length > 0 && !numerologyColumnsReady;

    const nameNumbers = inSql ? nameNumberWhere(filters, wanted) : null;
    const paged = inMemory ? undefined : { page, limit };

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
                nameNumbers,
            ].filter((item) => item !== null),
        };

        const { rows, count } = await TwinNames.findAndCountAll({
            where,
            attributes: nameNumberAttributes(filters),
            order: nameOrder(['name1', 'name2']),
            offset:
                paged?.page && paged.limit
                    ? (paged.page - 1) * paged.limit
                    : undefined,
            limit: paged?.limit,
        });

        const values = rows.map(({ dataValues: row }) => ({
            ...row,
            nameNumber1: resolveNameNumber(filters, row.name1, row.nameNumber1),
            nameNumber2: resolveNameNumber(filters, row.name2, row.nameNumber2),
        }));

        return inMemory
            ? applyNameNumbers(filters, values, count, page, limit)
            : [values, count];
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
                nameNumbers,
            ].filter((item) => item !== null),
        };

        const { rows, count } = await Names.findAndCountAll({
            where,
            attributes: nameNumberAttributes(filters),
            order: nameOrder(['name']),
            offset:
                paged?.page && paged.limit
                    ? (paged.page - 1) * paged.limit
                    : undefined,
            limit: paged?.limit,
        });

        const values = rows.map(({ dataValues: row }) => ({
            ...row,
            nameNumber: resolveNameNumber(filters, row.name, row.nameNumber),
        }));

        return inMemory
            ? applyNameNumbers(filters, values, count, page, limit)
            : [values, count];
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
const nameNumberCell = (item: IName | ITwinName): TableCell => ({
    text: numbersOf(item)
        .map((value) => value?.toString() ?? '-')
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

        try {
            await ensureNumerologyColumns();
            numerologyColumnsReady = true;
        } catch (error) {
            console.log('Failed to prepare numerology columns!', error);
        }

        try {
            await resolveSortCollation();
        } catch (error) {
            console.log('Failed to resolve the sort collation!', error);
        }
    })
    .catch((error) => {
        console.log('Failed to authenticate to database!', error);
    });

app.listen(process.env.PORT || 3000, () => {
    console.log('Server started!');
});
