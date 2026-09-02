import { createHash } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { ImportFileSchema, ImportReport, ImportRequest } from '@tbn/shared';
import { Sequelize } from 'sequelize';

import {
    ATTESTATIONS_MODEL,
    CLUSTERS_MODEL,
    LANGUAGES_MODEL,
    MEANINGS_MODEL,
    NAMES_MODEL,
    RELIGIONS_MODEL,
    SEQUELIZE,
    SOURCES_MODEL,
} from '../../database/database.constants.js';
import { importNames } from '../../database/importer.js';
import {
    AttestationsModel,
    ClustersModel,
    LookupModel,
    MeaningsModel,
    NamesModel,
    SourcesModel,
} from '../../database/models.js';

/**
 * A batch that could be read, or what was wrong with the one that could not.
 * A file the dashboard cannot parse is a mistake worth naming, not a 500.
 */
export type ImportOutcome = { report: ImportReport } | { unreadable: string };

/**
 * The dashboard's side of the importer. The work itself is
 * `database/importer.ts`, which the command line runs the same way — this only
 * turns a file's text into a batch and records what the bytes hashed to.
 */
@Injectable()
export class AdminImportService {
    constructor(
        @Inject(SEQUELIZE) private readonly sequelize: Sequelize,
        @Inject(NAMES_MODEL) private readonly names: NamesModel,
        @Inject(MEANINGS_MODEL) private readonly meanings: MeaningsModel,
        @Inject(CLUSTERS_MODEL) private readonly clusters: ClustersModel,
        @Inject(SOURCES_MODEL) private readonly sources: SourcesModel,
        @Inject(ATTESTATIONS_MODEL)
        private readonly attestations: AttestationsModel,
        @Inject(RELIGIONS_MODEL) private readonly religions: LookupModel,
        @Inject(LANGUAGES_MODEL) private readonly languages: LookupModel,
    ) {}

    async run({ content, dryRun }: ImportRequest): Promise<ImportOutcome> {
        let raw: unknown;

        try {
            raw = JSON.parse(content);
        } catch {
            return { unreadable: 'The file is not valid JSON.' };
        }

        const parsed = ImportFileSchema.safeParse(raw);

        if (!parsed.success) {
            return {
                unreadable: parsed.error.issues
                    .map(
                        ({ path, message }) =>
                            `${path.join('.') || 'file'}: ${message}`,
                    )
                    .join('; '),
            };
        }

        const report = await importNames(
            {
                sequelize: this.sequelize,
                names: this.names,
                meanings: this.meanings,
                clusters: this.clusters,
                sources: this.sources,
                attestations: this.attestations,
                religions: this.religions,
                languages: this.languages,
            },
            parsed.data,
            {
                checksum: createHash('sha256').update(content).digest('hex'),
                dryRun,
            },
        );

        return { report };
    }
}
