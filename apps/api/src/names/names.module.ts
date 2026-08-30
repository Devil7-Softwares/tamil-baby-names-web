import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { NamesBootstrap } from './names.bootstrap.js';
import { NamesController } from './names.controller.js';
import { NamesService } from './names.service.js';
import { NumerologyColumnsService } from './numerology-columns.service.js';
import { SortCollationService } from './sort-collation.service.js';

@Module({
    imports: [AuthModule],
    controllers: [NamesController],
    providers: [
        NamesBootstrap,
        NamesService,
        NumerologyColumnsService,
        SortCollationService,
    ],
    exports: [NamesService, NumerologyColumnsService, SortCollationService],
})
export class NamesModule {}
