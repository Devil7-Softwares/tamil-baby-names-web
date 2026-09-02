import { adminAgentsContract } from './adminAgents.js';
import { adminAuthContract } from './adminAuth.js';
import { adminImportContract } from './adminImport.js';
import { adminNamesContract } from './adminNames.js';
import { adminOverviewContract } from './adminOverview.js';

export * from './adminAgents.js';
export * from './adminAuth.js';
export * from './adminImport.js';
export * from './adminNames.js';
export * from './adminOverview.js';
export * from './errors.js';

/**
 * Root API contract, shared by the NestJS server and the admin dashboard.
 * Only the admin area speaks oRPC; the public site's endpoints predate it and
 * stay hand-written in `names/` and `export/`.
 */
export const contract = {
    admin: {
        agents: adminAgentsContract,
        auth: adminAuthContract,
        import: adminImportContract,
        names: adminNamesContract,
        overview: adminOverviewContract,
    },
};
