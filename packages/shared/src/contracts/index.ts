import { adminAuthContract } from './adminAuth.js';
import { adminNamesContract } from './adminNames.js';

export * from './adminAuth.js';
export * from './adminNames.js';
export * from './errors.js';

/**
 * Root API contract, shared by the NestJS server and the admin dashboard.
 * Only the admin area speaks oRPC; the public site's endpoints predate it and
 * stay hand-written in `names/` and `export/`.
 */
export const contract = {
    admin: {
        auth: adminAuthContract,
        names: adminNamesContract,
    },
};
