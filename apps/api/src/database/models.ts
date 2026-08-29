import { IName, ITwinName } from '@tbn/shared';
import { DataTypes, Model, ModelStatic, Sequelize } from 'sequelize';

export type NamesModel = ModelStatic<Model<IName>>;
export type TwinNamesModel = ModelStatic<Model<ITwinName>>;

const table = {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    timestamps: false,
};

const id = {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
};

export const defineNames = (sequelize: Sequelize): NamesModel =>
    sequelize.define<Model<IName>>(
        'Names',
        {
            id,
            gender: DataTypes.STRING,
            religion: DataTypes.STRING,
            firstLetter: { type: DataTypes.STRING, field: 'first_letter' },
            language: DataTypes.STRING,
            name: DataTypes.STRING,
            meaning: DataTypes.STRING,
        },
        { ...table, tableName: 'names' },
    );

export const defineTwinNames = (sequelize: Sequelize): TwinNamesModel =>
    sequelize.define<Model<ITwinName>>(
        'TwinNames',
        {
            id,
            gender: DataTypes.STRING,
            language: DataTypes.STRING,
            name1: DataTypes.STRING,
            meaning1: DataTypes.STRING,
            name2: DataTypes.STRING,
            meaning2: DataTypes.STRING,
        },
        { ...table, tableName: 'twin_names' },
    );
