import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    InternalServerErrorException,
    Logger,
    Post,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    IArrayResponseData,
    IFilterData,
    IName,
    IPaginatedResponseData,
    ITwinName,
    WithFilters,
} from '@tbn/shared';

import { AccessTokenGuard } from '../auth/access-token.guard';
import { Filters } from '../auth/filters.decorator';
import { NamesService } from './names.service';

@Controller()
export class NamesController {
    private readonly logger = new Logger(NamesController.name);

    constructor(private readonly names: NamesService) {}

    @Get('names')
    @UseGuards(AccessTokenGuard)
    async list(
        @Filters() filters: IFilterData,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ): Promise<WithFilters<IPaginatedResponseData<IName | ITwinName>>> {
        const [rows, total] = await this.read(() =>
            this.names.getNamesForFilter(
                filters,
                Number(page) || 1,
                Number(limit) || 25,
            ),
        );

        return {
            success: true,
            message: 'Names fetched successfully!',
            data: rows,
            total,
            filters,
        };
    }

    @Post('letters')
    @HttpCode(HttpStatus.OK)
    async letters(
        @Body() filters: IFilterData,
    ): Promise<IArrayResponseData<string>> {
        return {
            success: true,
            message: 'Names fetched successfully!',
            data: await this.read(() => this.names.getFirstLetters(filters)),
        };
    }

    private async read<T>(query: () => Promise<T>): Promise<T> {
        try {
            return await query();
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
