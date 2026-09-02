import { Module } from '@nestjs/common';

import { AgentsService } from './agents.service.js';

/**
 * The models the catalogue can ask. Nothing here decides what to ask them —
 * that is the reviewer's side, and it depends on this rather than the reverse.
 */
@Module({
    providers: [AgentsService],
    exports: [AgentsService],
})
export class AgentsModule {}
