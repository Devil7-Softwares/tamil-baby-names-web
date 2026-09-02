import { oc } from '@orpc/contract';

import {
    AdminAgentSchema,
    AgentCheckSchema,
    AgentCreateSchema,
    AgentIdSchema,
    AgentListSchema,
    AgentProvidersSchema,
    AgentUpdateSchema,
} from '../schemas/AgentSchemas.js';
import { commonErrors } from './errors.js';

/**
 * Admin-only throughout. An agent holds a credential and decides what gets
 * published, which is not a reviewer's to configure.
 */
export const adminAgentsContract = {
    providers: oc
        .route({
            method: 'GET',
            path: '/admin/agents/providers',
            summary: 'The APIs an agent can be pointed at',
        })
        .errors({
            UNAUTHORIZED: commonErrors.UNAUTHORIZED,
            FORBIDDEN: commonErrors.FORBIDDEN,
        })
        .output(AgentProvidersSchema),

    list: oc
        .route({
            method: 'GET',
            path: '/admin/agents',
            summary: 'The models configured to review the catalogue',
        })
        .errors({
            UNAUTHORIZED: commonErrors.UNAUTHORIZED,
            FORBIDDEN: commonErrors.FORBIDDEN,
            SERVICE_UNAVAILABLE: commonErrors.SERVICE_UNAVAILABLE,
        })
        .output(AgentListSchema),

    create: oc
        .route({
            method: 'POST',
            path: '/admin/agents',
            summary: 'Configure a model',
        })
        .errors({
            BAD_REQUEST: commonErrors.BAD_REQUEST,
            UNAUTHORIZED: commonErrors.UNAUTHORIZED,
            FORBIDDEN: commonErrors.FORBIDDEN,
            SERVICE_UNAVAILABLE: commonErrors.SERVICE_UNAVAILABLE,
        })
        .input(AgentCreateSchema)
        .output(AdminAgentSchema),

    update: oc
        .route({
            method: 'PATCH',
            path: '/admin/agents/{id}',
            summary: 'Change a model’s settings, or replace its key',
        })
        .errors({
            BAD_REQUEST: commonErrors.BAD_REQUEST,
            UNAUTHORIZED: commonErrors.UNAUTHORIZED,
            FORBIDDEN: commonErrors.FORBIDDEN,
            NOT_FOUND: commonErrors.NOT_FOUND,
            SERVICE_UNAVAILABLE: commonErrors.SERVICE_UNAVAILABLE,
        })
        .input(AgentUpdateSchema)
        .output(AdminAgentSchema),

    remove: oc
        .route({
            method: 'DELETE',
            path: '/admin/agents/{id}',
            summary: 'Forget a model that was configured by mistake',
        })
        .errors({
            UNAUTHORIZED: commonErrors.UNAUTHORIZED,
            FORBIDDEN: commonErrors.FORBIDDEN,
            NOT_FOUND: commonErrors.NOT_FOUND,
            SERVICE_UNAVAILABLE: commonErrors.SERVICE_UNAVAILABLE,
        })
        .input(AgentIdSchema)
        .output(AgentIdSchema),

    check: oc
        .route({
            method: 'POST',
            path: '/admin/agents/{id}/check',
            summary: 'Ask the model for one word, to prove it answers',
        })
        .errors({
            UNAUTHORIZED: commonErrors.UNAUTHORIZED,
            FORBIDDEN: commonErrors.FORBIDDEN,
            NOT_FOUND: commonErrors.NOT_FOUND,
            SERVICE_UNAVAILABLE: commonErrors.SERVICE_UNAVAILABLE,
        })
        .input(AgentIdSchema)
        .output(AgentCheckSchema),
};
