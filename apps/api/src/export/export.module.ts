import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { NamesModule } from '../names/names.module.js';
import { ExportAssets } from './export.assets.js';
import { ExportController } from './export.controller.js';
import { ExportService } from './export.service.js';

@Module({
    imports: [AuthModule, NamesModule],
    controllers: [ExportController],
    providers: [ExportAssets, ExportService],
})
export class ExportModule {}
