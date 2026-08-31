import { oc } from '@orpc/contract';

import { AdminOverviewSchema } from '../schemas/AdminOverviewSchemas.js';
import { commonErrors } from './errors.js';

export const adminOverviewContract = {
    get: oc
        .route({
            method: 'GET',
            path: '/admin/overview',
            summary: 'See where the catalogue’s review stands',
        })
        .errors({
            UNAUTHORIZED: commonErrors.UNAUTHORIZED,
            SERVICE_UNAVAILABLE: commonErrors.SERVICE_UNAVAILABLE,
        })
        .output(AdminOverviewSchema),
};
