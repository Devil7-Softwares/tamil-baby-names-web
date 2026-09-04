import { Inject, Injectable } from '@nestjs/common';
import { ReviewAgent, ReviewOverview } from '@tbn/shared';

import { AGENTS_MODEL } from '../../database/database.constants.js';
import { AgentsModel } from '../../database/models.js';
import { ReviewService } from '../../review/review.service.js';
import { ReviewRunsService } from '../../review/review-runs.service.js';

/** How many past runs the page shows. */
const RECENT = 20;

@Injectable()
export class AdminReviewService {
    constructor(
        @Inject(AGENTS_MODEL) private readonly agents: AgentsModel,
        private readonly review: ReviewService,
        private readonly runs: ReviewRunsService,
    ) {}

    /**
     * Each agent with how much of the queue it has left, so "review the queue"
     * has a number attached before anything is started. Counted per agent
     * because the queue is per agent: what one has already answered on, another
     * has not.
     */
    async overview(): Promise<ReviewOverview> {
        const rows = await this.agents.findAll({ order: ['id'] });

        const agents: ReviewAgent[] = await Promise.all(
            rows.map(async ({ dataValues }) => ({
                id: dataValues.id,
                name: dataValues.name,
                slug: dataValues.slug,
                model: dataValues.model,
                enabled: dataValues.enabled,
                pending: await this.review.pending(dataValues.id),
                unwritten: await this.review.pending(dataValues.id, true),
            })),
        );

        return { agents, runs: await this.runs.list(RECENT) };
    }
}
