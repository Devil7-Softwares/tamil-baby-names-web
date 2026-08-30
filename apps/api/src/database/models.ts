import {
    IName,
    ITwinName,
    NAME_STATUSES,
    NameNumerology,
    NameStatus,
    USER_ROLES,
    UserRole,
} from '@tbn/shared';
import { DataTypes, Model, ModelStatic, Sequelize } from 'sequelize';

export interface IAdminUser {
    id: number;
    email: string;
    passwordHash: string;
    name: string;
    role: UserRole;
    createdAt: Date;
    updatedAt: Date;
}

export type AdminUserDraft = Omit<IAdminUser, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * The stored numerology, which the model owns rather than the queries: the old
 * per-method columns were added at runtime and never declared here, so
 * typescript could not see the columns the queries sorted on.
 */
export interface NamesRow extends Omit<IName, 'meaning'> {
    numerology: NameNumerology | null;
    sourceId: number | null;
    status: NameStatus;
}

export interface TwinNamesRow extends Omit<ITwinName, 'meaning1' | 'meaning2'> {
    numerology1: NameNumerology | null;
    numerology2: NameNumerology | null;
    sourceId: number | null;
    status: NameStatus;
}

/**
 * One reading of one name, from one source. `nameId` and `twinNameId` are an
 * exclusive arc: exactly one is set, and `slot` says which side of a twin pair
 * the reading belongs to.
 */
export interface IMeaning {
    id: number;
    nameId: number | null;
    twinNameId: number | null;
    slot: number;
    text: string;
    sourceId: number | null;
    status: NameStatus;
    createdAt: Date;
    updatedAt: Date;
}

export type MeaningDraft = Pick<IMeaning, 'text'> &
    Partial<
        Pick<IMeaning, 'nameId' | 'twinNameId' | 'slot' | 'sourceId' | 'status'>
    >;

export type NamesModel = ModelStatic<Model<NamesRow>>;
export type TwinNamesModel = ModelStatic<Model<TwinNamesRow>>;
export type MeaningsModel = ModelStatic<Model<IMeaning, MeaningDraft>>;
export type AdminUsersModel = ModelStatic<Model<IAdminUser, AdminUserDraft>>;

const table = {
    timestamps: false,
};

const status = {
    type: DataTypes.ENUM(...NAME_STATUSES),
    allowNull: false,
    defaultValue: 'candidate',
};

const id = {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
};

export const defineNames = (sequelize: Sequelize): NamesModel =>
    sequelize.define<Model<NamesRow>>(
        'Names',
        {
            id,
            gender: DataTypes.STRING,
            religion: DataTypes.STRING,
            firstLetter: { type: DataTypes.STRING, field: 'first_letter' },
            language: DataTypes.STRING,
            name: DataTypes.STRING,
            numerology: DataTypes.JSONB,
            sourceId: { type: DataTypes.INTEGER, field: 'source_id' },
            status,
        },
        { ...table, tableName: 'names' },
    );

export const defineTwinNames = (sequelize: Sequelize): TwinNamesModel =>
    sequelize.define<Model<TwinNamesRow>>(
        'TwinNames',
        {
            id,
            gender: DataTypes.STRING,
            language: DataTypes.STRING,
            name1: DataTypes.STRING,
            name2: DataTypes.STRING,
            numerology1: DataTypes.JSONB,
            numerology2: DataTypes.JSONB,
            sourceId: { type: DataTypes.INTEGER, field: 'source_id' },
            status,
        },
        { ...table, tableName: 'twin_names' },
    );

export const defineMeanings = (sequelize: Sequelize): MeaningsModel =>
    sequelize.define<Model<IMeaning, MeaningDraft>>(
        'Meanings',
        {
            id,
            nameId: { type: DataTypes.INTEGER, field: 'name_id' },
            twinNameId: { type: DataTypes.INTEGER, field: 'twin_name_id' },
            slot: {
                type: DataTypes.SMALLINT,
                allowNull: false,
                defaultValue: 1,
            },
            text: { type: DataTypes.TEXT, allowNull: false },
            sourceId: { type: DataTypes.INTEGER, field: 'source_id' },
            status,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        {
            ...table,
            tableName: 'meanings',
            timestamps: true,
            underscored: true,
        },
    );

export const defineAdminUsers = (sequelize: Sequelize): AdminUsersModel =>
    sequelize.define<Model<IAdminUser, AdminUserDraft>>(
        'AdminUsers',
        {
            id,
            email: { type: DataTypes.STRING, allowNull: false, unique: true },
            passwordHash: {
                type: DataTypes.STRING,
                field: 'password_hash',
                allowNull: false,
            },
            name: { type: DataTypes.STRING, allowNull: false },
            role: {
                type: DataTypes.ENUM(...USER_ROLES),
                allowNull: false,
                defaultValue: 'reviewer',
            },
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        {
            ...table,
            tableName: 'admin_users',
            timestamps: true,
            underscored: true,
        },
    );
