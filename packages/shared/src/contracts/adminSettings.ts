import { oc } from '@orpc/contract';

import { SiteSettingsSchema } from '../schemas/SiteSettingsSchemas.js';
import { commonErrors } from './errors.js';

/**
 * Any signed-in reviewer can see what the site is serving; only an admin
 * changes it.
 */
export const adminSettingsContract = {
    get: oc
        .route({
            method: 'GET',
            path: '/admin/settings',
            summary: 'What the public site is set to serve',
        })
        .errors({
            UNAUTHORIZED: commonErrors.UNAUTHORIZED,
            SERVICE_UNAVAILABLE: commonErrors.SERVICE_UNAVAILABLE,
        })
        .output(SiteSettingsSchema),

    update: oc
        .route({
            method: 'PATCH',
            path: '/admin/settings',
            summary: 'Change what the public site serves',
        })
        .errors({
            UNAUTHORIZED: commonErrors.UNAUTHORIZED,
            FORBIDDEN: commonErrors.FORBIDDEN,
            SERVICE_UNAVAILABLE: commonErrors.SERVICE_UNAVAILABLE,
        })
        .input(SiteSettingsSchema)
        .output(SiteSettingsSchema),
};
