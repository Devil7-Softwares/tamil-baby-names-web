import { Injectable, OnApplicationBootstrap } from '@nestjs/common';

import { DatabaseBootstrap } from '../database/database.bootstrap.js';
import { NumerologyColumnsService } from './numerology-columns.service.js';
import { SortCollationService } from './sort-collation.service.js';

@Injectable()
export class NamesBootstrap implements OnApplicationBootstrap {
    constructor(
        private readonly database: DatabaseBootstrap,
        private readonly numerologyColumns: NumerologyColumnsService,
        private readonly sortCollation: SortCollationService,
    ) {}

    onApplicationBootstrap(): void {
        void this.prepare();
    }

    private async prepare(): Promise<void> {
        await this.database.ready;

        await this.numerologyColumns.prepare();
        await this.sortCollation.resolve();
    }
}
