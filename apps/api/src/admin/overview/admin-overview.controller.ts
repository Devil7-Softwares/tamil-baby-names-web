import { Controller, UseGuards } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tbn/shared';

import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { AdminOverviewService } from './admin-overview.service.js';

@Controller()
export class AdminOverviewController {
    constructor(private readonly overview: AdminOverviewService) {}

    @UseGuards(AdminAuthGuard)
    @Implement(contract.admin.overview.get)
    get() {
        return implement(contract.admin.overview.get).handler(() =>
            this.overview.get(),
        );
    }
}
