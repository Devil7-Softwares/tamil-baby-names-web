import {
    IName,
    ITwinName,
    NAME_STATUSES,
    NameNumerology,
    NameStatus,
    USER_ROLES,
    UserRole,
    VERIFICATION_REASONS,
    VerificationReason,
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
    clusterId: number | null;
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

/**
 * The rows a reviewer decides about together: one spelling, one gender, however
 * many times the import filed it.
 */
export interface ICluster {
    id: number;
    name: string;
    gender: string;
    sortKey: string;
    createdAt: Date;
    updatedAt: Date;
}

export type ClusterDraft = Pick<ICluster, 'name' | 'gender' | 'sortKey'>;

export interface ISource {
    id: number;
    slug: string;
    kind: string;
    title: string | null;
    version: string | null;
    checksum: string | null;
    trust: number;
    scannedAt: Date | null;
    metadata: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
}

export type SourceDraft = Pick<ISource, 'slug' | 'kind'> &
    Partial<
        Pick<
            ISource,
            | 'title'
            | 'version'
            | 'checksum'
            | 'trust'
            | 'scannedAt'
            | 'metadata'
        >
    >;

/**
 * One review decision, kept after the fact. The subject is a catalogue row or a
 * reading, as an exclusive arc rather than a table/id pair, so both sides keep
 * real referential integrity.
 */
export interface IVerification {
    id: number;
    nameId: number | null;
    meaningId: number | null;
    fromStatus: NameStatus;
    toStatus: NameStatus;
    reason: VerificationReason;
    actorId: number | null;
    createdAt: Date;
}

export type VerificationDraft = Pick<IVerification, 'fromStatus' | 'toStatus'> &
    Partial<Pick<IVerification, 'nameId' | 'meaningId' | 'reason' | 'actorId'>>;

export type NamesModel = ModelStatic<Model<NamesRow>>;
export type TwinNamesModel = ModelStatic<Model<TwinNamesRow>>;
export type MeaningsModel = ModelStatic<Model<IMeaning, MeaningDraft>>;
export type ClustersModel = ModelStatic<Model<ICluster, ClusterDraft>>;
export type SourcesModel = ModelStatic<Model<ISource, SourceDraft>>;
export type VerificationsModel = ModelStatic<
    Model<IVerification, VerificationDraft>
>;
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
            clusterId: { type: DataTypes.INTEGER, field: 'cluster_id' },
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

export const defineClusters = (sequelize: Sequelize): ClustersModel =>
    sequelize.define<Model<ICluster, ClusterDraft>>(
        'Clusters',
        {
            id,
            name: { type: DataTypes.STRING, allowNull: false },
            gender: { type: DataTypes.STRING, allowNull: false },
            sortKey: {
                type: DataTypes.TEXT,
                field: 'sort_key',
                allowNull: false,
            },
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        {
            ...table,
            tableName: 'clusters',
            timestamps: true,
            underscored: true,
        },
    );

export const defineSources = (sequelize: Sequelize): SourcesModel =>
    sequelize.define<Model<ISource, SourceDraft>>(
        'Sources',
        {
            id,
            slug: { type: DataTypes.STRING, allowNull: false, unique: true },
            kind: { type: DataTypes.STRING, allowNull: false },
            title: DataTypes.STRING,
            version: DataTypes.STRING,
            checksum: DataTypes.CHAR(64),
            trust: {
                type: DataTypes.SMALLINT,
                allowNull: false,
                defaultValue: 50,
            },
            scannedAt: { type: DataTypes.DATE, field: 'scanned_at' },
            metadata: DataTypes.JSONB,
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        {
            ...table,
            tableName: 'sources',
            timestamps: true,
            underscored: true,
        },
    );

export const defineVerifications = (sequelize: Sequelize): VerificationsModel =>
    sequelize.define<Model<IVerification, VerificationDraft>>(
        'Verifications',
        {
            id,
            nameId: { type: DataTypes.INTEGER, field: 'name_id' },
            meaningId: { type: DataTypes.INTEGER, field: 'meaning_id' },
            fromStatus: {
                type: DataTypes.ENUM(...NAME_STATUSES),
                field: 'from_status',
                allowNull: false,
            },
            toStatus: {
                type: DataTypes.ENUM(...NAME_STATUSES),
                field: 'to_status',
                allowNull: false,
            },
            reason: {
                type: DataTypes.ENUM(...VERIFICATION_REASONS),
                allowNull: false,
                defaultValue: 'decision',
            },
            actorId: { type: DataTypes.INTEGER, field: 'actor_id' },
            createdAt: DataTypes.DATE,
        },
        {
            ...table,
            tableName: 'verifications',
            // Written once and never revised, so there is nothing an
            // `updated_at` could say that `created_at` does not.
            timestamps: true,
            updatedAt: false,
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
