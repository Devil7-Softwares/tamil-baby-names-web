import { Controller, UseGuards } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tbn/shared';

import { AgentKeyError } from '../../agents/agent-keys.js';
import { AdminAuthGuard } from '../auth/admin-auth.guard.js';
import { AdminRequest } from '../auth/admin-session.js';
import { AdminAgentsService } from './admin-agents.service.js';

/**
 * Admin-only throughout: an agent holds a credential and decides what gets
 * published. A reviewer decides about what is already in front of them.
 */
@Controller()
@UseGuards(AdminAuthGuard)
export class AdminAgentsController {
    constructor(private readonly agents: AdminAgentsService) {}

    @Implement(contract.admin.agents.providers)
    providers() {
        return implement(contract.admin.agents.providers).handler(
            ({ context, errors }) => {
                admin(context, errors);

                return this.agents.providers();
            },
        );
    }

    @Implement(contract.admin.agents.list)
    list() {
        return implement(contract.admin.agents.list).handler(
            async ({ context, errors }) => {
                admin(context, errors);

                return { agents: await this.agents.list() };
            },
        );
    }

    @Implement(contract.admin.agents.create)
    create() {
        return implement(contract.admin.agents.create).handler(
            async ({ context, errors, input }) => {
                admin(context, errors);

                try {
                    return await this.agents.create(input);
                } catch (error) {
                    throw asBadRequest(error, errors);
                }
            },
        );
    }

    @Implement(contract.admin.agents.update)
    update() {
        return implement(contract.admin.agents.update).handler(
            async ({ context, errors, input }) => {
                admin(context, errors);

                let agent;

                try {
                    agent = await this.agents.update(input);
                } catch (error) {
                    throw asBadRequest(error, errors);
                }

                if (!agent) {
                    throw errors.NOT_FOUND();
                }

                return agent;
            },
        );
    }

    @Implement(contract.admin.agents.remove)
    remove() {
        return implement(contract.admin.agents.remove).handler(
            async ({ context, errors, input }) => {
                admin(context, errors);

                const id = await this.agents.remove(input.id);

                if (!id) {
                    throw errors.NOT_FOUND();
                }

                return { id };
            },
        );
    }

    @Implement(contract.admin.agents.check)
    check() {
        return implement(contract.admin.agents.check).handler(
            async ({ context, errors, input }) => {
                admin(context, errors);

                const outcome = await this.agents.check(input.id);

                if (!outcome) {
                    throw errors.NOT_FOUND();
                }

                return outcome;
            },
        );
    }
}

interface Refusals {
    UNAUTHORIZED: () => Error;
    FORBIDDEN: () => Error;
}

/** The same two checks every handler here starts with. */
const admin = (context: { request: unknown }, errors: Refusals): void => {
    const actor = (context.request as AdminRequest).adminSession;

    if (!actor) {
        throw errors.UNAUTHORIZED();
    }

    if (actor.role !== 'admin') {
        throw errors.FORBIDDEN();
    }
};

/**
 * A key that cannot be sealed is a mistake worth naming — `AGENT_KEY_SECRET`
 * is unset or the wrong length — not a 500.
 */
const asBadRequest = (
    error: unknown,
    errors: { BAD_REQUEST: (input: { message: string }) => Error },
): Error =>
    error instanceof AgentKeyError
        ? errors.BAD_REQUEST({ message: error.message })
        : (error as Error);
