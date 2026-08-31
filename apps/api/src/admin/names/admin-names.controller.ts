import { Controller, UseGuards } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tbn/shared';

import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { AdminRequest } from '../auth/admin-session.js';
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
            async ({ context, errors, input }) => {
                // The session, never the input: who decided is not something a
                // request gets to claim.
                const actor = (context.request as AdminRequest).adminSession;

                if (!actor) {
                    throw errors.UNAUTHORIZED();
                }

                const updated = await this.names.setStatus(input, actor.sub);

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
            async ({ context, errors, input }) => {
                const actor = (context.request as AdminRequest).adminSession;

                if (!actor) {
                    throw errors.UNAUTHORIZED();
                }

                const updated = await this.names.setMeaningStatus(
                    input,
                    actor.sub,
                );

                if (!updated) {
                    throw errors.NOT_FOUND();
                }

                return updated;
            },
        );
    }
}
