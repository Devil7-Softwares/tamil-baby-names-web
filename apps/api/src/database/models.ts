import {
    AgentProviderId,
    IName,
    ITwinName,
    NAME_STATUSES,
    NameNumerology,
    NameStatus,
    REVIEW_RUN_STATUSES,
    ReviewRunStatus,
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
export interface NamesRow extends Omit<
    IName,
    'meaning' | 'religion' | 'language'
> {
    numerology: NameNumerology | null;
    sourceId: number | null;
    clusterId: number | null;
    // Null where the source that brought the row filed it under nothing. The
    // public shape keeps them required: a row reaches the site published, and
    // by then a reviewer has decided.
    religion: string | null;
    language: string | null;
    religionId: number | null;
    languageId: number | null;
    /** What a reviewer needs to know about the row that no column says. */
    notes: string | null;
    status: NameStatus;
}

/** A catalogue row before the database gives it an id — what an import writes. */
export type NameDraft = Omit<NamesRow, 'id'>;

export interface TwinNamesRow extends Omit<ITwinName, 'meaning1' | 'meaning2'> {
    numerology1: NameNumerology | null;
    numerology2: NameNumerology | null;
    sourceId: number | null;
    languageId: number | null;
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
    /** The name's cluster, kept in step by a trigger. Never written by hand. */
    clusterId: number | null;
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

/**
 * A religion or a language, named once. The slug is what a request filters on
 * and the name is the Tamil the catalogue shows.
 */
export interface ILookup {
    id: number;
    slug: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
}

export type LookupDraft = Pick<ILookup, 'slug' | 'name'>;

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
    /** The person who decided. Null for an agent, and for the 0011 sweep. */
    actorId: number | null;
    /** The agent that decided. Never set together with `actorId`. */
    agentId: number | null;
    /** The agent's own 0–100. Null for a person, who does not hedge a verdict. */
    confidence: number | null;
    /** The agent's one line of why, which is what a second pass reads. */
    note: string | null;
    /** The run that wrote it, which is how a run's clusters are re-asked. */
    runId: number | null;
    /**
     * The reading the verdict would have written, where it proposed one. The
     * only record of it on a run that wrote nothing, and what makes two models
     * comparable on a name that has no reading yet.
     */
    proposed: string | null;
    createdAt: Date;
}

export type VerificationDraft = Pick<IVerification, 'fromStatus' | 'toStatus'> &
    Partial<
        Pick<
            IVerification,
            | 'nameId'
            | 'meaningId'
            | 'reason'
            | 'actorId'
            | 'agentId'
            | 'confidence'
            | 'note'
            | 'runId'
            | 'proposed'
        >
    >;

/**
 * Where in a source a row or a reading was found. The subject is the same
 * exclusive arc the ledger uses, and `locator` is free text because sources
 * have nothing in common: a URL, a page, a record id.
 */
export interface IAttestation {
    id: number;
    nameId: number | null;
    meaningId: number | null;
    sourceId: number;
    locator: string;
    /** The source's own words, where there are any worth quoting. */
    excerpt: string | null;
    createdAt: Date;
}

export type AttestationDraft = Pick<IAttestation, 'sourceId' | 'locator'> &
    Partial<Pick<IAttestation, 'nameId' | 'meaningId' | 'excerpt'>>;

/**
 * A configured model endpoint. The three key columns are one sealed value and
 * are null together; `agents/agent-keys.ts` is the only thing that reads them.
 */
export interface IAgent {
    id: number;
    slug: string;
    name: string;
    provider: AgentProviderId;
    baseUrl: string | null;
    model: string;
    keyCiphertext: Buffer | null;
    keyIv: Buffer | null;
    keyTag: Buffer | null;
    options: Record<string, unknown>;
    /** Requests in flight at once. Null defers to the provider's own figure. */
    concurrency: number | null;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export type AgentDraft = Pick<IAgent, 'slug' | 'name' | 'provider' | 'model'> &
    Partial<
        Pick<
            IAgent,
            | 'baseUrl'
            | 'keyCiphertext'
            | 'keyIv'
            | 'keyTag'
            | 'options'
            | 'enabled'
        >
    >;

export type NamesModel = ModelStatic<Model<NamesRow, NameDraft>>;
export type TwinNamesModel = ModelStatic<Model<TwinNamesRow>>;
export type MeaningsModel = ModelStatic<Model<IMeaning, MeaningDraft>>;
export type ClustersModel = ModelStatic<Model<ICluster, ClusterDraft>>;
export type LookupModel = ModelStatic<Model<ILookup, LookupDraft>>;
export type SourcesModel = ModelStatic<Model<ISource, SourceDraft>>;
export type VerificationsModel = ModelStatic<
    Model<IVerification, VerificationDraft>
>;
export type AttestationsModel = ModelStatic<
    Model<IAttestation, AttestationDraft>
>;
/** One run of an agent over the queue, and the counts as it goes. */
export interface IReviewRun {
    id: number;
    agentId: number;
    status: ReviewRunStatus;
    /** The batch size asked for; `total` is what the queue actually held. */
    requested: number;
    total: number;
    reviewed: number;
    /** It would not decide — below the confidence bar. */
    abstained: number;
    /** It was sure, and the catalogue was already right. */
    unchanged: number;
    published: number;
    rejected: number;
    added: number;
    dropped: number;
    failed: number;
    error: string | null;
    /** The run whose clusters this one re-asked, or null for the queue's own. */
    compareWith: number | null;
    /** False for a run that records what it would have done and writes nothing. */
    applied: boolean;
    /** Clusters per request. 1 is one at a time, which is how all the
     * calibration behind the model comparison was measured. */
    batch: number;
    startedAt: Date;
    finishedAt: Date | null;
}

export type ReviewRunDraft = Pick<IReviewRun, 'agentId' | 'requested'> &
    Partial<Omit<IReviewRun, 'id' | 'agentId' | 'requested'>>;

export type AdminUsersModel = ModelStatic<Model<IAdminUser, AdminUserDraft>>;
export type AgentsModel = ModelStatic<Model<IAgent, AgentDraft>>;
export type ReviewRunsModel = ModelStatic<Model<IReviewRun, ReviewRunDraft>>;

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
    sequelize.define<Model<NamesRow, NameDraft>>(
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
            religionId: { type: DataTypes.INTEGER, field: 'religion_id' },
            languageId: { type: DataTypes.INTEGER, field: 'language_id' },
            notes: DataTypes.TEXT,
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
            languageId: { type: DataTypes.INTEGER, field: 'language_id' },
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
            clusterId: { type: DataTypes.INTEGER, field: 'cluster_id' },
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

/** The two lookups are the same table twice, so they are defined once. */
const defineLookup =
    (modelName: string, tableName: string) =>
    (sequelize: Sequelize): LookupModel =>
        sequelize.define<Model<ILookup, LookupDraft>>(
            modelName,
            {
                id,
                slug: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    unique: true,
                },
                name: {
                    type: DataTypes.STRING,
                    allowNull: false,
                    unique: true,
                },
                createdAt: DataTypes.DATE,
                updatedAt: DataTypes.DATE,
            },
            { ...table, tableName, timestamps: true, underscored: true },
        );

export const defineReligions = defineLookup('Religions', 'religions');

export const defineLanguages = defineLookup('Languages', 'languages');

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
            agentId: { type: DataTypes.INTEGER, field: 'agent_id' },
            confidence: DataTypes.SMALLINT,
            note: DataTypes.TEXT,
            runId: { type: DataTypes.INTEGER, field: 'run_id' },
            proposed: DataTypes.TEXT,
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

export const defineAttestations = (sequelize: Sequelize): AttestationsModel =>
    sequelize.define<Model<IAttestation, AttestationDraft>>(
        'Attestations',
        {
            id,
            nameId: { type: DataTypes.INTEGER, field: 'name_id' },
            meaningId: { type: DataTypes.INTEGER, field: 'meaning_id' },
            sourceId: {
                type: DataTypes.INTEGER,
                field: 'source_id',
                allowNull: false,
            },
            locator: { type: DataTypes.TEXT, allowNull: false },
            excerpt: DataTypes.TEXT,
            createdAt: DataTypes.DATE,
        },
        {
            ...table,
            tableName: 'attestations',
            // Written once and never revised, as the ledger is.
            timestamps: true,
            updatedAt: false,
            underscored: true,
        },
    );

export const defineAgents = (sequelize: Sequelize): AgentsModel =>
    sequelize.define<Model<IAgent, AgentDraft>>(
        'Agents',
        {
            id,
            slug: { type: DataTypes.TEXT, allowNull: false, unique: true },
            name: { type: DataTypes.TEXT, allowNull: false },
            provider: { type: DataTypes.TEXT, allowNull: false },
            baseUrl: { type: DataTypes.TEXT, field: 'base_url' },
            model: { type: DataTypes.TEXT, allowNull: false },
            keyCiphertext: { type: DataTypes.BLOB, field: 'key_ciphertext' },
            keyIv: { type: DataTypes.BLOB, field: 'key_iv' },
            keyTag: { type: DataTypes.BLOB, field: 'key_tag' },
            concurrency: DataTypes.INTEGER,
            options: {
                type: DataTypes.JSONB,
                allowNull: false,
                defaultValue: {},
            },
            enabled: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            createdAt: DataTypes.DATE,
            updatedAt: DataTypes.DATE,
        },
        {
            ...table,
            tableName: 'agents',
            timestamps: true,
            underscored: true,
        },
    );

/**
 * A fresh object each time, never one shared between columns: Sequelize writes
 * `field` and `fieldName` into the definition it is given, so seven attributes
 * sharing one literal all end up naming the last column to be defined.
 */
const counter = () => ({
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
});

export const defineReviewRuns = (sequelize: Sequelize): ReviewRunsModel =>
    sequelize.define<Model<IReviewRun, ReviewRunDraft>>(
        'ReviewRuns',
        {
            id,
            agentId: {
                type: DataTypes.INTEGER,
                field: 'agent_id',
                allowNull: false,
            },
            status: {
                type: DataTypes.ENUM(...REVIEW_RUN_STATUSES),
                allowNull: false,
                defaultValue: 'running',
            },
            requested: { type: DataTypes.INTEGER, allowNull: false },
            total: counter(),
            reviewed: counter(),
            abstained: counter(),
            unchanged: counter(),
            published: counter(),
            rejected: counter(),
            added: counter(),
            dropped: counter(),
            failed: counter(),
            error: DataTypes.TEXT,
            compareWith: { type: DataTypes.INTEGER, field: 'compare_with' },
            applied: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            batch: {
                type: DataTypes.INTEGER,
                allowNull: false,
                defaultValue: 1,
            },
            startedAt: { type: DataTypes.DATE, field: 'started_at' },
            finishedAt: { type: DataTypes.DATE, field: 'finished_at' },
        },
        {
            ...table,
            tableName: 'review_runs',
            timestamps: false,
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
