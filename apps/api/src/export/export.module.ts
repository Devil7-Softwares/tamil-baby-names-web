import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { NamesModule } from '../names/names.module';
import { ExportAssets } from './export.assets';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
    imports: [AuthModule, NamesModule],
    controllers: [ExportController],
    providers: [ExportAssets, ExportService],
})
export class ExportModule {}
