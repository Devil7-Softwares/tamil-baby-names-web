import axios from 'axios';
import cookieParser from 'cookie-parser';
import dayjs from 'dayjs';
import { config } from 'dotenv';
import express, { RequestHandler } from 'express';
import { existsSync, readFileSync } from 'fs';
import jwt, { TokenExpiredError } from 'jsonwebtoken';
import { join } from 'path';
import PdfPrinter from 'pdfmake';
import { Content, TableCell } from 'pdfmake/interfaces';
import { DataTypes, Model, Op, Sequelize, WhereOptions } from 'sequelize';
import { parse } from 'url';

import { IFilterData, IName, ITwinName } from './interfaces';
import {
    getLunarMansion,
    getLunarMansionIndex,
    getMoonSign,
    getMoonSignIndex,
} from './utils';
import {
    getDocumentTitleByFilter,
    getStateFromParams,
    sentenseCase,
} from './utils/Common';

config();

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
    }
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
    }
);

const publicDir = [
    join(__dirname, 'public'),
    join(process.cwd(), 'public'),
].find((path) => existsSync(path));
const assetsDir =
    [join(__dirname, 'assets'), join(process.cwd(), 'assets')].find((path) =>
        existsSync(path)
    ) || './assets';
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
        res.locals.filterOptions = jwt.verify(
            accessToken,
            process.env.JWT_SECRET || 'Jwt@123'
        ) as Record<string, unknown>;

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
                getStateFromParams(new URLSearchParams(search))
            );

            res.send(
                indexHtml.replace(
                    /<title>(.*?)<\/title>/,
                    `<title>${title}</title>`
                )
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

    app.use(express.static(publicDir));
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
            `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`
        );

        if (!captchaResponse.data.success) {
            console.error(
                'Recaptcha verfication failed!',
                captchaResponse.data
            );
            return res.status(400).send({
                success: false,
                message: 'CAPTCHA verification failed!',
            });
        }
    } catch (error) {
        console.error('Recaptcha verfication failed!', error);
        res.status(400).send({
            success: false,
            message: 'CAPTCHA verification failed!',
        });
    }

    const accessToken = jwt.sign(filters, process.env.JWT_SECRET || 'Jwt@123', {
        expiresIn: '1h',
    });

    res.cookie('accessToken', accessToken).send({
        success: true,
        message: 'Access token generated successfully!',
    });
});

async function getNamesForFilter(
    filters: IFilterData,
    page?: number,
    limit?: number
): Promise<[IName[] | ITwinName[], number]> {
    if (filters.twinNames) {
        const where = {
            [Op.and]: [
                filters.startsWithMode !== 'none' && filters.startsWith
                    ? {
                          [Op.or]: filters.startsWith.reduce<WhereOptions[]>(
                              (arr, char) => {
                                  arr.push({
                                      name1: {
                                          [Op.like]: `${char}%`,
                                      },
                                  });
                                  arr.push({
                                      name2: {
                                          [Op.like]: `${char}%`,
                                      },
                                  });

                                  return arr;
                              },
                              []
                          ),
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

        const { rows, count } = await TwinNames.findAndCountAll({
            where,
            offset: page && limit ? (page - 1) * limit : undefined,
            limit,
        });

        return [rows.map((item) => item.dataValues), count];
    } else {
        const where = {
            [Op.and]: [
                filters.startsWithMode !== 'none' && filters.startsWith
                    ? {
                          firstLetter: {
                              [Op.in]: filters.startsWith,
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
            offset: page && limit ? (page - 1) * limit : undefined,
            limit,
        });

        return [rows.map((item) => item.dataValues), count];
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
                  }
        )
    );
}
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

    const pdfPrinter = new PdfPrinter({
        Roboto: {
            normal: join(assetsDir, 'fonts', 'Roboto-Regular.ttf'),
            bold: join(assetsDir, 'fonts', 'Roboto-Bold.ttf'),
        },
        Barathi: {
            normal: join(assetsDir, 'fonts', 'TAU-Barathi-Regular.ttf'),
        },
    });

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
            const date = dayjs(filters.tob, filters.tz);

            if (date.isValid()) {
                const moonSignIndex = getMoonSignIndex(date.toDate());
                const lunarMansionIndex = getLunarMansionIndex(date.toDate());

                const moonSignEN = getMoonSign(moonSignIndex, 'en');
                const moonSignTA = getMoonSign(moonSignIndex, 'ta');
                const lunarMansionEN = getLunarMansion(lunarMansionIndex, 'en');
                const lunarMansionTA = getLunarMansion(lunarMansionIndex, 'ta');

                iconName = moonSignEN.toLowerCase();

                filterTable.push([
                    {
                        columns: [
                            {
                                text: 'Lunar Mansion / ',
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
            }
        }

        if (
            filters.startsWithMode !== 'none' &&
            filters.startsWith &&
            filters.startsWith.length
        ) {
            const startsWithEnglish = filters.startsWith.filter(
                (item) => !/[^\u0000-\u00ff]/.test(String(item))
            );

            const startsWithTamil = filters.startsWith.filter((item) =>
                /[^\u0000-\u00ff]/.test(String(item))
            );

            const startsWith: TableCell[] = [];

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
                        join(assetsDir, 'zodiac', `${iconName}.png`)
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

        const pdfDoc = pdfPrinter.createPdfKitDocument({
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

        const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
            try {
                var chunks: Uint8Array[] = [];
                pdfDoc.on('data', (chunk) => chunks.push(chunk));
                pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
                pdfDoc.end();
            } catch (err) {
                reject(err);
            }
        });

        res.setHeader('Content-Type', 'application/pdf');

        if (req.query.inline === 'true') {
            res.setHeader('Content-Disposition', 'inline');
        } else {
            res.setHeader(
                'Content-Disposition',
                'attachment; filename=BabyNames.pdf'
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
        const where = filters.gender
            ? /*sqlFragment*/ `WHERE gender='${filters.gender}'`
            : '';

        const [letters] = await (filters.twinNames
            ? sequalize.query(/*sql*/ `
                SELECT DISTINCT left(name1, 1) firstLetter FROM twin_names ${where}
                UNION
                SELECT DISTINCT left(name2, 1) firstLetter FROM twin_names ${where}
                ORDER BY firstLetter;
            `)
            : sequalize.query(/*sql*/ `
                SELECT DISTINCT left(name, 1) firstLetter FROM names ${where} ORDER BY firstLetter;
            `));

        res.send({
            success: true,
            message: 'Names fetched successfully!',
            data: (letters as Array<{ firstLetter: string }>).map(
                (item) => item.firstLetter
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
    app.get('*', indexHandler);
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
