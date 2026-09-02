import { oc } from '@orpc/contract';

import {
    AdminReviewRunSchema,
    ReviewOverviewSchema,
    ReviewRunIdSchema,
    ReviewStartSchema,
} from '../schemas/ReviewRunSchemas.js';
import { commonErrors } from './errors.js';

/**
 * Admin-only. A run publishes and rejects at scale, which is a bigger act than
 * anything a reviewer does one row at a time.
 */
export const adminReviewContract = {
    overview: oc
        .route({
            method: 'GET',
            path: '/admin/review',
            summary: 'The agents that can review, and the runs so far',
        })
        .errors({
            UNAUTHORIZED: commonErrors.UNAUTHORIZED,
            FORBIDDEN: commonErrors.FORBIDDEN,
            SERVICE_UNAVAILABLE: commonErrors.SERVICE_UNAVAILABLE,
        })
        .output(ReviewOverviewSchema),

    start: oc
        .route({
            method: 'POST',
            path: '/admin/review/runs',
            summary: 'Set an agent going over the queue',
        })
        .errors({
            BAD_REQUEST: commonErrors.BAD_REQUEST,
            UNAUTHORIZED: commonErrors.UNAUTHORIZED,
            FORBIDDEN: commonErrors.FORBIDDEN,
            SERVICE_UNAVAILABLE: commonErrors.SERVICE_UNAVAILABLE,
        })
        .input(ReviewStartSchema)
        .output(AdminReviewRunSchema),

    get: oc
        .route({
            method: 'GET',
            path: '/admin/review/runs/{id}',
            summary: 'How far a run has got',
        })
        .errors({
            UNAUTHORIZED: commonErrors.UNAUTHORIZED,
            FORBIDDEN: commonErrors.FORBIDDEN,
            NOT_FOUND: commonErrors.NOT_FOUND,
        })
        .input(ReviewRunIdSchema)
        .output(AdminReviewRunSchema),

    cancel: oc
        .route({
            method: 'POST',
            path: '/admin/review/runs/{id}/cancel',
            summary: 'Stop a run. What it has decided stays decided',
        })
        .errors({
            UNAUTHORIZED: commonErrors.UNAUTHORIZED,
            FORBIDDEN: commonErrors.FORBIDDEN,
            NOT_FOUND: commonErrors.NOT_FOUND,
        })
        .input(ReviewRunIdSchema)
        .output(AdminReviewRunSchema),
};
