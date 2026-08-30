import {
    Controller,
    Get,
    InternalServerErrorException,
    Logger,
    Query,
    Req,
    StreamableFile,
    UseGuards,
} from '@nestjs/common';
import { IFilterData } from '@tbn/shared';
import { Request } from 'express';

import { AccessTokenGuard } from '../auth/access-token.guard.js';
import { Filters } from '../auth/filters.decorator.js';
import { ExportService } from './export.service.js';

@Controller('export')
export class ExportController {
    private readonly logger = new Logger(ExportController.name);

    constructor(private readonly sheet: ExportService) {}

    @Get()
    @UseGuards(AccessTokenGuard)
    async download(
        @Filters() filters: IFilterData,
        @Req() request: Request,
        @Query('inline') inline?: string,
    ): Promise<StreamableFile> {
        try {
            const pdf = await this.sheet.createPdf(filters, {
                host: request.hostname,
                link: `${request.protocol}://${request.get('host')}/`,
            });

            return new StreamableFile(pdf, {
                type: 'application/pdf',
                disposition:
                    inline === 'true'
                        ? 'inline'
                        : 'attachment; filename=BabyNames.pdf',
            });
        } catch (error) {
            this.logger.error(
                'Failed to establish database connection!',
                error,
            );

            throw new InternalServerErrorException({
                success: false,
                message: 'Database connection failed!',
            });
        }
    }
}
