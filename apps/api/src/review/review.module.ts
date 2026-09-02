import { Module } from '@nestjs/common';

import { AgentsModule } from '../agents/agents.module.js';
import { ReviewService } from './review.service.js';

/** What to ask the models, as distinct from how to reach them. */
@Module({
    imports: [AgentsModule],
    providers: [ReviewService],
    exports: [ReviewService],
})
export class ReviewModule {}
