import { Controller, UseGuards } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tbn/shared';

import { SiteSettingsService } from '../../database/site-settings.service.js';
import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { AdminRequest } from '../auth/admin-session.js';

@Controller()
@UseGuards(AdminAuthGuard)
export class AdminSettingsController {
    constructor(private readonly settings: SiteSettingsService) {}

    @Implement(contract.admin.settings.get)
    get() {
        return implement(contract.admin.settings.get).handler(() =>
            this.settings.get(),
        );
    }

    @Implement(contract.admin.settings.update)
    update() {
        return implement(contract.admin.settings.update).handler(
            ({ context, errors, input }) => {
                const actor = (context.request as AdminRequest).adminSession;

                if (!actor) {
                    throw errors.UNAUTHORIZED();
                }

                if (actor.role !== 'admin') {
                    throw errors.FORBIDDEN();
                }

                return this.settings.update(input, actor.sub);
            },
        );
    }
}
