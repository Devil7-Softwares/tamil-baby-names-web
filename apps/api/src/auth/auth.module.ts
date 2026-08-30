import { Module } from '@nestjs/common';

import { AccessTokenGuard } from './access-token.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({
    controllers: [AuthController],
    providers: [AuthService, AccessTokenGuard],
    exports: [AuthService, AccessTokenGuard],
})
export class AuthModule {}
