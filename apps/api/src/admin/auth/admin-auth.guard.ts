import {
    CanActivate,
    ExecutionContext,
    Injectable,
    ServiceUnavailableException,
    UnauthorizedException,
} from '@nestjs/common';

import { AdminAuthService } from './admin-auth.service.js';
import { ADMIN_SESSION_COOKIE, AdminRequest } from './admin-session.js';

@Injectable()
export class AdminAuthGuard implements CanActivate {
    constructor(private readonly auth: AdminAuthService) {}

    canActivate(context: ExecutionContext): boolean {
        if (!this.auth.isConfigured) {
            throw new ServiceUnavailableException();
        }

        const request = context.switchToHttp().getRequest<AdminRequest>();
        const token = request.cookies?.[ADMIN_SESSION_COOKIE] as
            string | undefined;

        const session = token ? this.auth.verify(token) : null;

        if (!session) {
            throw new UnauthorizedException();
        }

        request.adminSession = session;

        return true;
    }
}
