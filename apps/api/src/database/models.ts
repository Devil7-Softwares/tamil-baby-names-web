import { IName, ITwinName, USER_ROLES, UserRole } from '@tbn/shared';
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

export type NamesModel = ModelStatic<Model<IName>>;
export type TwinNamesModel = ModelStatic<Model<ITwinName>>;
export type AdminUsersModel = ModelStatic<Model<IAdminUser, AdminUserDraft>>;

const table = {
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
