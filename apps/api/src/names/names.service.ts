import { Inject, Injectable } from '@nestjs/common';
import {
    getStartingLettersForFilter,
    IFilterData,
    IName,
    ITwinName,
} from '@tbn/shared';
import { Sequelize } from 'sequelize';

import {
    NAMES_MODEL,
    SEQUELIZE,
    TWIN_NAMES_MODEL,
} from '../database/database.constants.js';
import { NamesModel, TwinNamesModel } from '../database/models.js';
import {
    nameNumberWhere,
    namesWhere,
    resolveNameNumber,
    twinNamesWhere,
    wantedNumbers,
} from './names.query.js';
import { SortCollationService } from './sort-collation.service.js';

@Injectable()
export class NamesService {
    constructor(
        @Inject(SEQUELIZE) private readonly sequelize: Sequelize,
        @Inject(NAMES_MODEL) private readonly names: NamesModel,
        @Inject(TWIN_NAMES_MODEL) private readonly twinNames: TwinNamesModel,
        private readonly sortCollation: SortCollationService,
    ) {}

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

            // `numerology1`/`numerology2` carry every method; the client is
            // sent only the number for the one it asked about.
            const values = rows.map(
                ({ dataValues: { numerology1, numerology2, ...row } }) => ({
                    ...row,
                    nameNumber1: resolveNameNumber(
                        filters,
                        row.name1,
                        numerology1,
                    ),
                    nameNumber2: resolveNameNumber(
                        filters,
                        row.name2,
                        numerology2,
                    ),
                }),
            );

            return [values, count];
        }

        const { rows, count } = await this.names.findAndCountAll({
            where: namesWhere(filters, startsWith, nameNumbers),
            order: this.sortCollation.order(['name']),
            offset,
            limit,
        });

        const values = rows.map(({ dataValues: { numerology, ...row } }) => ({
            ...row,
            nameNumber: resolveNameNumber(filters, row.name, numerology),
        }));

        return [values, count];
    }

    async getFirstLetters(filters: IFilterData): Promise<string[]> {
        const where = filters.gender ? 'WHERE gender = :gender' : '';
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
