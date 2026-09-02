import { Module } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { ORPCModule } from '@orpc/nest';
import { Request } from 'express';

import { AgentsModule } from '../agents/agents.module.js';
import { ReviewModule } from '../review/review.module.js';
import { AdminAgentsController } from './agents/admin-agents.controller.js';
import { AdminAgentsService } from './agents/admin-agents.service.js';
import { AdminAuthController } from './auth/admin-auth.controller.js';
import { AdminAuthGuard } from './auth/admin-auth.guard.js';
import { AdminAuthService } from './auth/admin-auth.service.js';
import { AdminImportController } from './import/admin-import.controller.js';
import { AdminImportService } from './import/admin-import.service.js';
import { AdminNamesController } from './names/admin-names.controller.js';
import { AdminNamesService } from './names/admin-names.service.js';
import { AdminOverviewController } from './overview/admin-overview.controller.js';
import { AdminOverviewService } from './overview/admin-overview.service.js';
import { AdminReviewController } from './review/admin-review.controller.js';
import { AdminReviewService } from './review/admin-review.service.js';
import { AdminBootstrapService } from './users/admin-bootstrap.service.js';
import { UsersService } from './users/users.service.js';

// Gives every oRPC handler the express request, which is how they set and clear
// the session cookie.
declare module '@orpc/nest' {
    interface ORPCGlobalContext {
        request: Request;
    }
}

@Module({
    imports: [
        ORPCModule.forRootAsync({
            useFactory: (request: Request) => ({ context: { request } }),
            inject: [REQUEST],
        }),
        AgentsModule,
        ReviewModule,
    ],
    controllers: [
        AdminAgentsController,
        AdminAuthController,
        AdminImportController,
        AdminNamesController,
        AdminOverviewController,
        AdminReviewController,
    ],
    providers: [
        AdminAgentsService,
        AdminAuthGuard,
        AdminAuthService,
        AdminBootstrapService,
        AdminImportService,
        AdminNamesService,
        AdminOverviewService,
        AdminReviewService,
        UsersService,
    ],
    exports: [AdminAuthGuard, AdminAuthService, UsersService],
})
export class AdminModule {}
