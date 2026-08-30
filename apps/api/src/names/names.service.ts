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
    applyNameNumbers,
    nameNumberAttributes,
    nameNumberWhere,
    namesWhere,
    resolveNameNumber,
    twinNamesWhere,
    wantedNumbers,
} from './names.query.js';
import { NumerologyColumnsService } from './numerology-columns.service.js';
import { SortCollationService } from './sort-collation.service.js';

@Injectable()
export class NamesService {
    constructor(
        @Inject(SEQUELIZE) private readonly sequelize: Sequelize,
        @Inject(NAMES_MODEL) private readonly names: NamesModel,
        @Inject(TWIN_NAMES_MODEL) private readonly twinNames: TwinNamesModel,
        private readonly numerologyColumns: NumerologyColumnsService,
        private readonly sortCollation: SortCollationService,
    ) {}

    async getNamesForFilter(
        filters: IFilterData,
        page?: number,
        limit?: number,
    ): Promise<[IName[] | ITwinName[], number]> {
        const startsWith = getStartingLettersForFilter(filters);
        const wanted = wantedNumbers(filters);
        const ready = this.numerologyColumns.isReady;

        // With the columns in place the filter is just another predicate, so
        // the query keeps its own LIMIT; without them it has to read every
        // match.
        const inSql = wanted.length > 0 && ready;
        const inMemory = wanted.length > 0 && !ready;

        const nameNumbers = inSql ? nameNumberWhere(filters, wanted) : null;
        const paged = inMemory ? undefined : { page, limit };

        const offset =
            paged?.page && paged.limit
                ? (paged.page - 1) * paged.limit
                : undefined;

        if (filters.twinNames) {
            const { rows, count } = await this.twinNames.findAndCountAll({
                where: twinNamesWhere(filters, startsWith, nameNumbers),
                attributes: nameNumberAttributes(filters, ready),
                order: this.sortCollation.order(['name1', 'name2']),
                offset,
                limit: paged?.limit,
            });

            const values = rows.map(({ dataValues: row }) => ({
                ...row,
                nameNumber1: resolveNameNumber(
                    filters,
                    row.name1,
                    row.nameNumber1,
                ),
                nameNumber2: resolveNameNumber(
                    filters,
                    row.name2,
                    row.nameNumber2,
                ),
            }));

            return inMemory
                ? applyNameNumbers(filters, values, count, page, limit)
                : [values, count];
        }

        const { rows, count } = await this.names.findAndCountAll({
            where: namesWhere(filters, startsWith, nameNumbers),
            attributes: nameNumberAttributes(filters, ready),
            order: this.sortCollation.order(['name']),
            offset,
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
