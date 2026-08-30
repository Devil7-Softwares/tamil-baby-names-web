import { oc } from '@orpc/contract';

import {
    AdminNamesPageSchema,
    AdminNamesQuerySchema,
} from '../schemas/AdminNameSchemas.js';
import { commonErrors } from './errors.js';

export const adminNamesContract = {
    list: oc
        .route({
            method: 'GET',
            path: '/admin/names',
            summary: 'Browse the catalogue, whatever a row’s status',
        })
        .errors({
            UNAUTHORIZED: commonErrors.UNAUTHORIZED,
            SERVICE_UNAVAILABLE: commonErrors.SERVICE_UNAVAILABLE,
        })
        .input(AdminNamesQuerySchema)
        .output(AdminNamesPageSchema),
};
