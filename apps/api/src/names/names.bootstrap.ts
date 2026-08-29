import { Injectable, OnApplicationBootstrap } from '@nestjs/common';

import { DatabaseBootstrap } from '../database/database.bootstrap';
import { NumerologyColumnsService } from './numerology-columns.service';
import { SortCollationService } from './sort-collation.service';

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
        if (!(await this.database.ready)) {
            return;
        }

        await this.numerologyColumns.prepare();
        await this.sortCollation.resolve();
    }
}
