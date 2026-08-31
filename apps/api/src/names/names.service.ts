import { Inject, Injectable } from '@nestjs/common';
import {
    getStartingLettersForFilter,
    IFilterData,
    IName,
    ITwinName,
    PUBLISHED,
} from '@tbn/shared';
import { Op, Sequelize } from 'sequelize';

import {
    MEANINGS_MODEL,
    NAMES_MODEL,
    SEQUELIZE,
    TWIN_NAMES_MODEL,
} from '../database/database.constants.js';
import {
    MeaningsModel,
    NamesModel,
    TwinNamesModel,
} from '../database/models.js';
import { SortCollationService } from '../database/sort-collation.service.js';
import {
    nameNumberWhere,
    namesWhere,
    resolveNameNumber,
    twinNamesWhere,
    wantedNumbers,
} from './names.query.js';

@Injectable()
export class NamesService {
    constructor(
        @Inject(SEQUELIZE) private readonly sequelize: Sequelize,
        @Inject(NAMES_MODEL) private readonly names: NamesModel,
        @Inject(TWIN_NAMES_MODEL) private readonly twinNames: TwinNamesModel,
        @Inject(MEANINGS_MODEL) private readonly meanings: MeaningsModel,
        private readonly sortCollation: SortCollationService,
    ) {}

    /**
     * The published meaning of every row on the page, keyed by subject and
     * slot. A second query rather than a join, because the name lists are
     * ordered by a collation Sequelize cannot express inside an include.
     */
    private async publishedMeanings(
        column: 'nameId' | 'twinNameId',
        ids: number[],
    ): Promise<Map<string, string>> {
        if (!ids.length) {
            return new Map();
        }

        const rows = await this.meanings.findAll({
            where: { [column]: { [Op.in]: ids }, status: PUBLISHED },
            attributes: [column, 'slot', 'text'],
        });

        return new Map(
            rows.map(({ dataValues }) => [
                `${dataValues[column]}:${dataValues.slot}`,
                dataValues.text,
            ]),
        );
    }

    async getNamesForFilter(
        filters: IFilterData,
        page?: number,
        limit?: number,
    ): Promise<[IName[] | ITwinName[], number]> {
        const startsWith = getStartingLettersForFilter(filters);
        const wanted = wantedNumbers(filters);

        const nameNumbers = wanted.length
            ? nameNumberWhere(filters, wanted)
            : null;

        const offset = page && limit ? (page - 1) * limit : undefined;

        if (filters.twinNames) {
            const { rows, count } = await this.twinNames.findAndCountAll({
                where: twinNamesWhere(filters, startsWith, nameNumbers),
                order: this.sortCollation.order(['name1', 'name2']),
                offset,
                limit,
            });

            const meanings = await this.publishedMeanings(
                'twinNameId',
                rows.map(({ dataValues }) => dataValues.id),
            );

            // Named rather than spread: the columns review needs — the
            // source, the status, the reviewer's notes — stay out of what a
            // client is sent however many of them the catalogue grows.
            // `numerology1`/`numerology2` carry every method, and the client is
            // sent only the number for the one it asked about.
            const values = rows.map(({ dataValues: row }) => ({
                id: row.id,
                gender: row.gender,
                language: row.language,
                name1: row.name1,
                meaning1: meanings.get(`${row.id}:1`) ?? '',
                name2: row.name2,
                meaning2: meanings.get(`${row.id}:2`) ?? '',
                nameNumber1: resolveNameNumber(
                    filters,
                    row.name1,
                    row.numerology1,
                ),
                nameNumber2: resolveNameNumber(
                    filters,
                    row.name2,
                    row.numerology2,
                ),
            }));

            return [values, count];
        }

        const { rows, count } = await this.names.findAndCountAll({
            where: namesWhere(filters, startsWith, nameNumbers),
            order: this.sortCollation.order(['name']),
            offset,
            limit,
        });

        const meanings = await this.publishedMeanings(
            'nameId',
            rows.map(({ dataValues }) => dataValues.id),
        );

        const values = rows.map(({ dataValues: row }) => ({
            id: row.id,
            gender: row.gender,
            religion: row.religion,
            firstLetter: row.firstLetter,
            language: row.language,
            name: row.name,
            meaning: meanings.get(`${row.id}:1`) ?? '',
            nameNumber: resolveNameNumber(filters, row.name, row.numerology),
        }));

        return [values, count];
    }

    async getFirstLetters(filters: IFilterData): Promise<string[]> {
        // The picker offers letters the site can actually show, so it reads the
        // same published subset the name lists do.
        const where = filters.gender
            ? `WHERE status = '${PUBLISHED}' AND gender = :gender`
            : `WHERE status = '${PUBLISHED}'`;
        const replacements = filters.gender ? { gender: filters.gender } : {};

        // The alias is quoted because postgres folds unquoted identifiers to
        // lower case, which would return the column as `firstletter`. The
        // ordering takes the same collation as the name lists rather than the
        // database default, so the picker follows the Tamil alphabet.
        const collate = this.sortCollation.clause;
        // The distinct set is wrapped because a COLLATE makes the ORDER BY an
        // expression, and an expression cannot reference an output alias.
        const [letters] = await (filters.twinNames
            ? this.sequelize.query(
                  /*sql*/ `
                SELECT "firstLetter" FROM (
                    SELECT DISTINCT left(name1, 1) AS "firstLetter" FROM twin_names ${where}
                    UNION
                    SELECT DISTINCT left(name2, 1) AS "firstLetter" FROM twin_names ${where}
                ) letters ORDER BY "firstLetter"${collate};
            `,
                  { replacements },
              )
            : this.sequelize.query(
                  /*sql*/ `
                SELECT "firstLetter" FROM (
                    SELECT DISTINCT left(name, 1) AS "firstLetter" FROM names ${where}
                ) letters ORDER BY "firstLetter"${collate};
            `,
                  { replacements },
              ));

        return (letters as Array<{ firstLetter: string }>).map(
            (item) => item.firstLetter,
        );
    }
}
