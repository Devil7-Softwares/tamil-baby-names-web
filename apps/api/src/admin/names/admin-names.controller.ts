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

    @UseGuards(AdminAuthGuard)
    @Implement(contract.admin.names.setStatus)
    setStatus() {
        return implement(contract.admin.names.setStatus).handler(
            async ({ errors, input }) => {
                const updated = await this.names.setStatus(input);

                if (!updated) {
                    throw errors.NOT_FOUND();
                }

                return updated;
            },
        );
    }

    @UseGuards(AdminAuthGuard)
    @Implement(contract.admin.names.setMeaningStatus)
    setMeaningStatus() {
        return implement(contract.admin.names.setMeaningStatus).handler(
            async ({ errors, input }) => {
                const updated = await this.names.setMeaningStatus(input);

                if (!updated) {
                    throw errors.NOT_FOUND();
                }

                return updated;
            },
        );
    }
}
