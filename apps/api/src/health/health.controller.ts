import { Controller, Get } from '@nestjs/common';

import { DatabaseBootstrap } from '../database/database.bootstrap.js';

@Controller('health')
export class HealthController {
    constructor(private readonly database: DatabaseBootstrap) {}

    /**
     * Reports the database rather than failing on it: the clients and the PDF
     * fonts are served from this process too, and a container restart would
     * take those down over a dependency that reconnects on its own.
     */
    @Get()
    check(): { status: string; database: string } {
        return {
            status: 'ok',
            database: this.database.isConnected ? 'up' : 'down',
        };
    }
}
