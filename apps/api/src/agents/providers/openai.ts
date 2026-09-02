import {
    AgentCallError,
    AgentConfig,
    AgentProvider,
    AgentReply,
    deadlineFor,
    endpointOf,
    extraHeaders,
    post,
    text,
} from './provider.js';

interface ChatReply {
    choices?: Array<{ message?: { content?: string | null } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/**
 * The request with every null field taken out, which is how `options.body`
 * removes one rather than only adding.
 */
const without = (body: Record<string, unknown>): Record<string, unknown> =>
    Object.fromEntries(
        Object.entries(body).filter(([, value]) => value !== null),
    );

/**
 * The chat-completions shape, which is the closest thing this field has to a
 * lingua franca: OpenAI's own endpoint, Gemini's compatibility endpoint, every
 * gateway that fronts several models, and most self-hosted servers all answer
 * to it. The `base_url` on the agent is what picks between them.
 *
 * The system prompt is a message here rather than its own field, which is the
 * only real difference from Claude's shape.
 *
 * Two things this sends differently from the obvious.
 *
 * **`max_completion_tokens`, not `max_tokens`.** OpenAI deprecated the latter
 * and its reasoning models reject it outright — which today is all of them — so
 * sending it fails the whole GPT-5 family. Gemini silently ignores parameters
 * it does not know, and self-hosted servers vary, which is what `body` below is
 * for.
 *
 * **`temperature` only when the agent asks for one.** Reasoning models reject
 * it the way Claude's do. A server that wants one is told through the options.
 *
 * `options.body` is merged last and a **null in it drops the field**, so a
 * server that only knows the old spelling is reachable without a code change:
 * `{ "body": { "max_completion_tokens": null, "max_tokens": 800 } }`.
 */
export const openai: AgentProvider = {
    id: 'openai',
    defaultBaseUrl: 'https://api.openai.com/v1',
    needsKey: true,

    async complete(config: AgentConfig, request): Promise<AgentReply> {
        if (!config.apiKey) {
            throw new AgentCallError('This agent has no API key.');
        }

        const body = (await post(
            endpointOf(config, openai, '/chat/completions'),
            {
                authorization: `Bearer ${config.apiKey}`,
                ...extraHeaders(config.options),
            },
            without({
                model: config.model,
                max_completion_tokens: request.maxTokens,
                ...(typeof config.options.temperature === 'number'
                    ? { temperature: config.options.temperature }
                    : {}),
                messages: [
                    { role: 'system', content: request.system },
                    { role: 'user', content: request.prompt },
                ],
                ...(request.schema
                    ? {
                          response_format: {
                              type: 'json_schema',
                              json_schema: {
                                  name: request.schema.name,
                                  schema: request.schema.json,
                                  strict: true,
                              },
                          },
                      }
                    : {}),
                ...(config.options.body as object | undefined),
            }),
            deadlineFor(config, request),
        )) as ChatReply;

        return {
            text: text(body.choices?.[0]?.message?.content ?? '', 'The model'),
            usage: body.usage
                ? {
                      input: body.usage.prompt_tokens ?? 0,
                      output: body.usage.completion_tokens ?? 0,
                  }
                : null,
        };
    },
};
