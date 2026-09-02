import { Controller, UseGuards } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tbn/shared';

import {
    ReviewRunsService,
    RunRefused,
} from '../../review/review-runs.service.js';
import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { AdminRequest } from '../auth/admin-session.js';
import { AdminReviewService } from './admin-review.service.js';

interface Refusals {
    UNAUTHORIZED: () => Error;
    FORBIDDEN: () => Error;
}

/** A run publishes and rejects at scale, so it is an admin's to start. */
const admin = (context: { request: unknown }, errors: Refusals): void => {
    const actor = (context.request as AdminRequest).adminSession;

    if (!actor) {
        throw errors.UNAUTHORIZED();
    }

    if (actor.role !== 'admin') {
        throw errors.FORBIDDEN();
    }
};

@Controller()
@UseGuards(AdminAuthGuard)
export class AdminReviewController {
    constructor(
        private readonly review: AdminReviewService,
        private readonly runs: ReviewRunsService,
    ) {}

    @Implement(contract.admin.review.overview)
    overview() {
        return implement(contract.admin.review.overview).handler(
            async ({ context, errors }) => {
                admin(context, errors);

                return this.review.overview();
            },
        );
    }

    @Implement(contract.admin.review.start)
    start() {
        return implement(contract.admin.review.start).handler(
            async ({ context, errors, input }) => {
                admin(context, errors);

                try {
                    return await this.runs.start(input.agentId, input.limit, {
                        compareWith: input.compareWith,
                        applied: input.applied,
                    });
                } catch (error) {
                    // Every refusal here is something the person can act on:
                    // turn the agent on, wait for the run, or nothing is left.
                    if (error instanceof RunRefused) {
                        throw errors.BAD_REQUEST({ message: error.message });
                    }

                    throw error;
                }
            },
        );
    }

    @Implement(contract.admin.review.get)
    get() {
        return implement(contract.admin.review.get).handler(
            async ({ context, errors, input }) => {
                admin(context, errors);

                const run = await this.runs.get(input.id);

                if (!run) {
                    throw errors.NOT_FOUND();
                }

                return run;
            },
        );
    }

    @Implement(contract.admin.review.cancel)
    cancel() {
        return implement(contract.admin.review.cancel).handler(
            async ({ context, errors, input }) => {
                admin(context, errors);

                const run = await this.runs.cancel(input.id);

                if (!run) {
                    throw errors.NOT_FOUND();
                }

                return run;
            },
        );
    }
}
