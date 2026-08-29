import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IFilterData } from '@tbn/shared';
import axios from 'axios';
import jwt, { TokenExpiredError } from 'jsonwebtoken';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);
    private readonly secret: string;

    constructor(private readonly config: ConfigService) {
        this.secret = config.getOrThrow<string>('JWT_SECRET');
    }

    async verifyCaptcha(token: string): Promise<boolean> {
        const secret = this.config.get<string>('RECAPTCHA_SECRET_KEY');

        try {
            const response = await axios.post(
                `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${token}`,
            );

            if (!response.data.success) {
                this.logger.error(
                    'Recaptcha verification failed!',
                    response.data,
                );
                return false;
            }

            return true;
        } catch (error) {
            this.logger.error('Recaptcha verification failed!', error);
            return false;
        }
    }

    sign(filters: IFilterData): string {
        return jwt.sign(filters, this.secret, { expiresIn: '1h' });
    }

    readFilters(accessToken: string): IFilterData {
        let payload: Record<string, unknown>;

        try {
            payload = jwt.verify(accessToken, this.secret) as Record<
                string,
                unknown
            >;
        } catch (error) {
            throw new UnauthorizedException({
                success: false,
                message:
                    error instanceof TokenExpiredError
                        ? 'Token expired!'
                        : 'Invalid token!',
            });
        }

        delete payload.exp;
        delete payload.iat;

        return payload as unknown as IFilterData;
    }
}
