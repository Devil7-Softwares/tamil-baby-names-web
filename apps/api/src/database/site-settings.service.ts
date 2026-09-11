import { Inject, Injectable } from '@nestjs/common';
import { SiteSettings } from '@tbn/shared';

import { SITE_SETTINGS_MODEL } from './database.constants.js';
import { SiteSettingsModel } from './models.js';

/** The row the migration seeds; the table's check allows no other. */
const ROW = 1;

@Injectable()
export class SiteSettingsService {
    constructor(
        @Inject(SITE_SETTINGS_MODEL)
        private readonly settings: SiteSettingsModel,
    ) {}

    /** Read on every request, so a flip reaches the site without a restart. */
    async get(): Promise<SiteSettings> {
        const row = await this.settings.findByPk(ROW);

        return { showUnreviewed: row?.dataValues.showUnreviewed ?? false };
    }

    async update(
        changes: SiteSettings,
        actorId: number,
    ): Promise<SiteSettings> {
        await this.settings.upsert({
            id: ROW,
            ...changes,
            updatedBy: actorId,
            updatedAt: new Date(),
        });

        return this.get();
    }
}
