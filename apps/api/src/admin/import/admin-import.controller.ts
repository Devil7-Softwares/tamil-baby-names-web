import { Controller, UseGuards } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tbn/shared';

import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { AdminRequest } from '../auth/admin-session.js';
import { AdminImportService } from './admin-import.service.js';

@Controller()
export class AdminImportController {
    constructor(private readonly imports: AdminImportService) {}

    @UseGuards(AdminAuthGuard)
    @Implement(contract.admin.import.run)
    run() {
        return implement(contract.admin.import.run).handler(
            async ({ context, errors, input }) => {
                const actor = (context.request as AdminRequest).adminSession;

                if (!actor) {
                    throw errors.UNAUTHORIZED();
                }

                // Adding names to the catalogue is not a reviewer's job: they
                // decide about what is already in front of them.
                if (actor.role !== 'admin') {
                    throw errors.FORBIDDEN();
                }

                const outcome = await this.imports.run(input);

                if ('unreadable' in outcome) {
                    throw errors.BAD_REQUEST({ message: outcome.unreadable });
                }

                return outcome.report;
            },
        );
    }
}
