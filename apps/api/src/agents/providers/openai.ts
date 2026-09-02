import {
    AgentCallError,
    AgentConfig,
    AgentProvider,
    AgentReply,
    dial,
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
 * The chat-completions shape, which is the closest thing this field has to a
 * lingua franca: OpenAI's own endpoint, every gateway that fronts several
 * models, and most self-hosted servers all answer to it. The `base_url` on the
 * agent is what picks between them.
 *
 * The system prompt is a message here rather than its own field, which is the
 * only real difference from Claude's shape.
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
            {
                model: config.model,
                max_tokens: request.maxTokens,
                temperature: dial(
                    config.options,
                    'temperature',
                    request.temperature,
                ),
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
            },
            request.signal,
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
