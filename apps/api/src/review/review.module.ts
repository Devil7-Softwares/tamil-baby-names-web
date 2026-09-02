import { Module } from '@nestjs/common';

import { AgentsModule } from '../agents/agents.module.js';
import { ReviewService } from './review.service.js';
import { ReviewRunsService } from './review-runs.service.js';

/** What to ask the models, as distinct from how to reach them. */
@Module({
    imports: [AgentsModule],
    providers: [ReviewService, ReviewRunsService],
    exports: [ReviewService, ReviewRunsService],
})
export class ReviewModule {}
