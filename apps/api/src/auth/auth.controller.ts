import {
    BadRequestException,
    Body,
    Controller,
    Headers,
    HttpCode,
    HttpStatus,
    Post,
    Res,
} from '@nestjs/common';
import { IFilterData, IResponseData } from '@tbn/shared';
import { Response } from 'express';

import { AuthService } from './auth.service';

@Controller('generate')
export class AuthController {
    constructor(private readonly auth: AuthService) {}

    @Post()
    @HttpCode(HttpStatus.OK)
    async generate(
        @Headers('token') token: string | undefined,
        @Body() filters: IFilterData,
        @Res({ passthrough: true }) response: Response,
    ): Promise<IResponseData> {
        if (!token) {
            throw new BadRequestException({
                success: false,
                message: 'Invalid request!',
            });
        }

        if (!(await this.auth.verifyCaptcha(token))) {
            throw new BadRequestException({
                success: false,
                message: 'CAPTCHA verification failed!',
            });
        }

        response.cookie('accessToken', this.auth.sign(filters));

        return {
            success: true,
            message: 'Access token generated successfully!',
        };
    }
}
