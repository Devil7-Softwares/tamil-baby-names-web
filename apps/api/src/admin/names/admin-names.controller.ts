import { Controller, UseGuards } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tbn/shared';

import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { AdminNamesService } from './admin-names.service.js';

@Controller()
export class AdminNamesController {
    constructor(private readonly names: AdminNamesService) {}

    @UseGuards(AdminAuthGuard)
    @Implement(contract.admin.names.list)
    list() {
        return implement(contract.admin.names.list).handler(({ input }) =>
            this.names.list(input),
        );
    }
}
