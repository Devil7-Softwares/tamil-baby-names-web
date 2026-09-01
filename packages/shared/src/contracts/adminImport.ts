import { oc } from '@orpc/contract';

import {
    ImportReportSchema,
    ImportRequestSchema,
} from '../schemas/ImportSchemas.js';
import { commonErrors } from './errors.js';

export const adminImportContract = {
    run: oc
        .route({
            method: 'POST',
            path: '/admin/import',
            summary: 'Add a source’s names to the review queue',
        })
        .errors({
            BAD_REQUEST: commonErrors.BAD_REQUEST,
            UNAUTHORIZED: commonErrors.UNAUTHORIZED,
            FORBIDDEN: commonErrors.FORBIDDEN,
            SERVICE_UNAVAILABLE: commonErrors.SERVICE_UNAVAILABLE,
        })
        .input(ImportRequestSchema)
        .output(ImportReportSchema),
};
