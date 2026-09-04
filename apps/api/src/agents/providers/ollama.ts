import {
    AgentCallError,
    AgentConfig,
    AgentProvider,
    AgentReply,
    deadlineFor,
    dial,
    endpointOf,
    extraHeaders,
    post,
    text,
} from './provider.js';

interface ChatReply {
    message?: { content?: string; thinking?: string };
    done_reason?: string;
    prompt_eval_count?: number;
    eval_count?: number;
}

/**
 * A model on this machine. No key, and the default endpoint is localhost —
 * which makes it the one provider that can be pointed at 160,000 scraped rows
 * without a bill, and the one worth reaching for on a first pass.
 *
 * `stream: false` because the caller wants one answer, not tokens: Ollama
 * streams by default and would otherwise return newline-delimited JSON that
 * `post` could not parse.
 *
 * A reasoning model answers in two fields, and spends `num_predict` on
 * `thinking` before it writes any `content`. Left alone, qwen3 asked for 16
 * tokens returns an empty answer and a paragraph of deliberation, so `think` is
 * a dial the agent can turn off — which is usually right for judging thousands
 * of rows, and is why an empty answer says which of the two happened.
 */
export const ollama: AgentProvider = {
    id: 'ollama',
    defaultBaseUrl: 'http://127.0.0.1:11434',
    needsKey: false,
    concurrency: 1,

    async complete(config: AgentConfig, request): Promise<AgentReply> {
        const body = (await post(
            endpointOf(config, ollama, '/api/chat'),
            extraHeaders(config.options),
            {
                model: config.model,
                stream: false,
                ...(typeof config.options.think === 'boolean'
                    ? { think: config.options.think }
                    : {}),
                ...(request.schema ? { format: request.schema.json } : {}),
                messages: [
                    { role: 'system', content: request.system },
                    { role: 'user', content: request.prompt },
                ],
                options: {
                    temperature: dial(
                        config.options,
                        'temperature',
                        request.temperature,
                    ),
                    num_predict: request.maxTokens,
                },
                ...(config.options.body as object | undefined),
            },
            deadlineFor(config, request),
        )) as ChatReply;

        const answer = body.message?.content ?? '';

        // Truncated mid-thought reads as "answered nothing", which sends
        // whoever is configuring it looking in the wrong place.
        if (!answer.trim() && body.done_reason === 'length') {
            throw new AgentCallError(
                body.message?.thinking
                    ? 'The model spent its whole token budget thinking and never answered. Raise the token ceiling, or set "think": false in the agent’s options.'
                    : 'The model hit its token ceiling before answering.',
            );
        }

        return {
            text: text(answer, 'The model'),
            usage:
                typeof body.eval_count === 'number'
                    ? {
                          input: body.prompt_eval_count ?? 0,
                          output: body.eval_count,
                      }
                    : null,
        };
    },
};
