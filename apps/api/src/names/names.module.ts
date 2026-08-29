import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { NamesBootstrap } from './names.bootstrap';
import { NamesController } from './names.controller';
import { NamesService } from './names.service';
import { NumerologyColumnsService } from './numerology-columns.service';
import { SortCollationService } from './sort-collation.service';

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
