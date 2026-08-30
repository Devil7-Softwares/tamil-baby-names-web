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
export interface NamesRow extends IName {
    numerology: NameNumerology | null;
    sourceId: number | null;
    status: NameStatus;
}

export interface TwinNamesRow extends ITwinName {
    numerology1: NameNumerology | null;
    numerology2: NameNumerology | null;
    sourceId: number | null;
    status: NameStatus;
}

export type NamesModel = ModelStatic<Model<NamesRow>>;
export type TwinNamesModel = ModelStatic<Model<TwinNamesRow>>;
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
            meaning: DataTypes.STRING,
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
            meaning1: DataTypes.STRING,
            name2: DataTypes.STRING,
            meaning2: DataTypes.STRING,
            numerology1: DataTypes.JSONB,
            numerology2: DataTypes.JSONB,
            sourceId: { type: DataTypes.INTEGER, field: 'source_id' },
            status,
        },
        { ...table, tableName: 'twin_names' },
    );

// The only table this project owns outright, so unlike `names` it carries the
// timestamps Sequelize manages.
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
