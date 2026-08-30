import {
    CanActivate,
    ExecutionContext,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';

import { AuthService } from './auth.service.js';
import { FilteredRequest } from './filtered-request.js';

@Injectable()
export class AccessTokenGuard implements CanActivate {
    constructor(private readonly auth: AuthService) {}

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<FilteredRequest>();
        const accessToken = request.cookies?.['accessToken'] as
            string | undefined;

        if (!accessToken) {
            throw new UnauthorizedException({
                success: false,
                message: 'No token provided!',
            });
        }

        request.filters = this.auth.readFilters(accessToken);

        return true;
    }
}
