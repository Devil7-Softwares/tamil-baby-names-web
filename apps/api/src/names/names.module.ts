import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { NamesBootstrap } from './names.bootstrap.js';
import { NamesController } from './names.controller.js';
import { NamesService } from './names.service.js';
import { NumerologyBackfillService } from './numerology-backfill.service.js';

@Module({
    imports: [AuthModule],
    controllers: [NamesController],
    providers: [NamesBootstrap, NamesService, NumerologyBackfillService],
    exports: [NamesService, NumerologyBackfillService],
})
export class NamesModule {}
