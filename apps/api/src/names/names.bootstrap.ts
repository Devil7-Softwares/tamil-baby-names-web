import { Injectable, OnApplicationBootstrap } from '@nestjs/common';

import { DatabaseBootstrap } from '../database/database.bootstrap.js';
import { NumerologyBackfillService } from './numerology-backfill.service.js';
import { SortCollationService } from './sort-collation.service.js';

@Injectable()
export class NamesBootstrap implements OnApplicationBootstrap {
    constructor(
        private readonly database: DatabaseBootstrap,
        private readonly numerology: NumerologyBackfillService,
        private readonly sortCollation: SortCollationService,
    ) {}

    onApplicationBootstrap(): void {
        void this.prepare();
    }

    private async prepare(): Promise<void> {
        await this.database.ready;

        await this.numerology.run();
        await this.sortCollation.resolve();
    }
}
