import Anthropic from '@anthropic-ai/sdk';

import {
    AgentCallError,
    AgentConfig,
    AgentProvider,
    AgentReply,
    AgentRequest,
    deadlineFor,
    expired,
    extraHeaders,
    text,
} from './provider.js';

/**
 * Claude, through the official SDK rather than raw HTTP: it carries the API
 * version header, retries what is worth retrying and raises typed errors, none
 * of which is worth reimplementing here.
 *
 * Two things this deliberately does not send.
 *
 * `temperature` is **rejected** by the current models — Opus 5, Sonnet 5 and the
 * 4.7 family return 400 for it — so the agent's temperature dial is ignored
 * here. Depth is asked for with `effort` instead, which is what replaced it.
 *
 * `thinking` is left alone. It is adaptive by default on Opus 5, which is the
 * right setting for judging a reading, and spelling it out would only go stale.
 */
export const anthropic: AgentProvider = {
    id: 'anthropic',
    defaultBaseUrl: 'https://api.anthropic.com',
    needsKey: true,

    async complete(config: AgentConfig, request): Promise<AgentReply> {
        if (!config.apiKey) {
            throw new AgentCallError('This agent has no API key.');
        }

        const client = new Anthropic({
            apiKey: config.apiKey,
            ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
            defaultHeaders: extraHeaders(config.options),
        });

        const deadline = deadlineFor(config, request);

        try {
            const response = await client.messages.create(
                {
                    model: config.model,
                    max_tokens: request.maxTokens,
                    system: request.system,
                    messages: [{ role: 'user', content: request.prompt }],
                    ...outputConfig(config, request),
                },
                { signal: deadline.signal },
            );

            // A refusal is an answer, not a transport failure: it arrives 200
            // with no usable text, and a run should record it and move on.
            if (response.stop_reason === 'refusal') {
                throw new AgentCallError(
                    `Claude declined this one: ${response.stop_details?.explanation ?? 'no reason given'}`,
                    400,
                );
            }

            return {
                text: text(
                    response.content
                        .filter((block) => block.type === 'text')
                        .map((block) => block.text)
                        .join(''),
                    'Claude',
                ),
                usage: {
                    input: response.usage.input_tokens,
                    output: response.usage.output_tokens,
                },
            };
        } catch (error) {
            if (error instanceof AgentCallError) {
                throw error;
            }

            if (deadline.expired()) {
                throw new AgentCallError(expired('Claude', deadline.ms));
            }

            if (error instanceof Anthropic.APIError) {
                throw new AgentCallError(
                    `Claude answered ${error.status ?? 'nothing'}: ${error.message}`,
                    error.status ?? null,
                );
            }

            throw new AgentCallError(
                `Could not reach Claude: ${(error as Error).message}`,
            );
        }
    },
};

/** `low` … `max`, the dial that replaced temperature on these models. */
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const;

type Effort = (typeof EFFORTS)[number];

const isEffort = (value: unknown): value is Effort =>
    typeof value === 'string' && (EFFORTS as readonly string[]).includes(value);

const effortOf = ({ effort }: Record<string, unknown>): { effort?: Effort } =>
    isEffort(effort) ? { effort } : {};

/**
 * One `output_config`, and only where there is something to put in it.
 *
 * Two spreads replaced each other, so an agent asking for effort lost its
 * schema without saying so. An empty one is left out entirely: not every model
 * takes every dial — Haiku refuses `effort` — and a bare `{}` is a request to
 * be refused for no reason.
 */
const outputConfig = (
    config: AgentConfig,
    request: AgentRequest,
): { output_config?: Record<string, unknown> } => {
    const output_config = {
        ...(request.schema
            ? {
                  format: {
                      type: 'json_schema' as const,
                      schema: request.schema.json,
                  },
              }
            : {}),
        ...effortOf(config.options),
    };

    return Object.keys(output_config).length ? { output_config } : {};
};
