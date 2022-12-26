import axios from 'axios';
import { config } from 'dotenv';
import express, { RequestHandler } from 'express';
import { existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { DataTypes, Model, Op, Sequelize, WhereOptions } from 'sequelize';
import jwt, { TokenExpiredError } from 'jsonwebtoken';
import { IFilterData, IName, IResponseData, ITwinName } from './interfaces';
import cookieParser from 'cookie-parser';
import PdfPrinter from 'pdfmake';

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

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (publicDir) {
    console.log(`Using public dir: ${publicDir}`);
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
                filters.startsWith
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
                filters.startsWith
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
            normal: join(__dirname, 'assets', 'fonts', 'Roboto-Regular.ttf'),
        },
        Barathi: {
            normal: join(
                __dirname,
                'assets',
                'fonts',
                'TAU-Barathi-Regular.ttf'
            ),
        },
    });

    try {
        const [rows] = await getNamesForFilter(filters);

        const pdfDoc = pdfPrinter.createPdfKitDocument({
            pageOrientation: filters.twinNames ? 'landscape' : 'portrait',
            pageMargins: [20, 20, 20, 40],
            watermark: {
                text: 'DEVIL7 SOFTWARES',
                opacity: 0.2,
            },
            content: [
                {
                    pageBreak: 'after',
                    fontSize: 11,
                    table: {
                        body: [
                            [
                                ...(filters.twinNames
                                    ? [
                                          'Name 1',
                                          'Meaning 1',
                                          'Name 2',
                                          'Meaning 2',
                                      ]
                                    : ['Name', 'Meaning']),
                                ...(!filters.gender ? ['Gender'] : []),
                                ...(!filters.twinNames ? ['Religion'] : []),
                                'Language',
                            ],
                            ...rows.map((item) => [
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
                                ...('religion' in item ? [item.religion] : []),
                                item.language,
                            ]),
                        ].map((row) =>
                            row.map((cell) => ({
                                font:
                                    typeof cell === 'number' ||
                                    /[^\u0000-\u00ff]/.test(cell)
                                        ? 'Barathi'
                                        : 'Roboto',
                                text: cell,
                            }))
                        ),
                    },
                },
            ],
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

        res.setHeader('Content-Type', 'application/pdf')
            .setHeader(
                'Content-Disposition',
                'attachment; filename=BabyNames.pdf'
            )
            .send(pdfBuffer);
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
    app.get('*', (req, res) => {
        if (!res.headersSent) {
            res.sendFile(join(publicDir, 'index.html'));
        }
    });
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
