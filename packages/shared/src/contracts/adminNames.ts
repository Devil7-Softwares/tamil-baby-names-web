import { oc } from '@orpc/contract';

import {
    AdminClustersPageSchema,
    AdminMeaningsUpdateSchema,
    AdminNamesQuerySchema,
    AdminStatusUpdateSchema,
} from '../schemas/AdminNameSchemas.js';
import { commonErrors } from './errors.js';

export const adminNamesContract = {
    list: oc
        .route({
            method: 'GET',
            path: '/admin/names',
            summary: 'Browse the catalogue a cluster at a time',
        })
        .errors({
            UNAUTHORIZED: commonErrors.UNAUTHORIZED,
            SERVICE_UNAVAILABLE: commonErrors.SERVICE_UNAVAILABLE,
        })
        .input(AdminNamesQuerySchema)
        .output(AdminClustersPageSchema),

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
