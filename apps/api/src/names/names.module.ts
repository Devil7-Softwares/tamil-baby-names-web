import { Module } from '@nestjs/common';

import { NamesBootstrap } from './names.bootstrap';
import { NumerologyColumnsService } from './numerology-columns.service';
import { SortCollationService } from './sort-collation.service';

@Module({
    providers: [NamesBootstrap, NumerologyColumnsService, SortCollationService],
    exports: [NumerologyColumnsService, SortCollationService],
})
export class NamesModule {}
