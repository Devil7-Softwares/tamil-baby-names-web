import { oc } from '@orpc/contract';

import {
    AdminMeaningsUpdateSchema,
    AdminNamesPageSchema,
    AdminNamesQuerySchema,
    AdminStatusUpdateSchema,
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

    setStatus: oc
        .route({
            method: 'PATCH',
            path: '/admin/names/{id}/status',
            summary: 'Publish, shelve or reject a catalogue row',
        })
        .errors({
            UNAUTHORIZED: commonErrors.UNAUTHORIZED,
            NOT_FOUND: commonErrors.NOT_FOUND,
            SERVICE_UNAVAILABLE: commonErrors.SERVICE_UNAVAILABLE,
        })
        .input(AdminStatusUpdateSchema)
        .output(AdminStatusUpdateSchema),

    setMeaningStatus: oc
        .route({
            method: 'PATCH',
            path: '/admin/meanings/{id}/status',
            summary: 'Publish, shelve or reject one reading of a name',
        })
        .errors({
            UNAUTHORIZED: commonErrors.UNAUTHORIZED,
            NOT_FOUND: commonErrors.NOT_FOUND,
            SERVICE_UNAVAILABLE: commonErrors.SERVICE_UNAVAILABLE,
        })
        .input(AdminStatusUpdateSchema)
        .output(AdminMeaningsUpdateSchema),
};
