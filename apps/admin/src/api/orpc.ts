import { createORPCClient } from '@orpc/client';
import type { ContractRouterClient } from '@orpc/contract';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { createTanstackQueryUtils } from '@orpc/tanstack-query';
import { contract } from '@tbn/shared';

const link = new OpenAPILink(contract, {
    url: `${window.location.origin}/api`,
    // The session lives in an httpOnly cookie, which fetch omits by default.
    fetch: (request, init) =>
        globalThis.fetch(request, { ...init, credentials: 'include' }),
});

const client: ContractRouterClient<typeof contract> = createORPCClient(link);

/** TanStack Query bindings for the contract (orpc.admin.auth.me.queryOptions()). */
export const orpc = createTanstackQueryUtils(client);
