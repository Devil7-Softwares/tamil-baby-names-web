import { REVIEW_VERDICT_JSON_SCHEMA } from '@tbn/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    AgentCallError,
    AgentConfig,
    isProviderId,
    providerOf,
    providerSummaries,
    requireProvider,
} from '../src/agents/providers/index.js';
import { ollama } from '../src/agents/providers/ollama.js';
import { openai } from '../src/agents/providers/openai.js';

interface Sent {
    url: string;
    headers: Record<string, string>;
    body: Record<string, unknown>;
}

/** Answers every call with one payload and records what was asked. */
const stubFetch = (payload: unknown, status = 200) => {
    const sent: Sent[] = [];

    vi.stubGlobal(
        'fetch',
        async (url: string, init: RequestInit): Promise<Response> => {
            sent.push({
                url,
                headers: init.headers as Record<string, string>,
                body: JSON.parse(init.body as string) as Record<
                    string,
                    unknown
                >,
            });

            return new Response(JSON.stringify(payload), { status });
        },
    );

    return sent;
};

const config = (over: Partial<AgentConfig> = {}): AgentConfig => ({
    provider: 'openai',
    baseUrl: null,
    model: 'a-model',
    apiKey: 'a-key',
    options: {},
    ...over,
});

const ask = {
    system: 'be brief',
    prompt: 'a name',
    maxTokens: 64,
    temperature: 0,
};

afterEach(() => vi.unstubAllGlobals());

describe('the registry', () => {
    it('answers for every provider it names', () => {
        expect(providerSummaries().map(({ id }) => id)).toEqual([
            'anthropic',
            'openai',
            'ollama',
        ]);
    });

    it('says which providers want a key', () => {
        const needs = Object.fromEntries(
            providerSummaries().map(({ id, needsKey }) => [id, needsKey]),
        );

        expect(needs).toEqual({
            anthropic: true,
            openai: true,
            ollama: false,
        });
    });

    it('does not invent a provider it has no file for', () => {
        expect(providerOf('gemini')).toBeNull();
        expect(isProviderId('gemini')).toBe(false);
        expect(() => requireProvider('gemini')).toThrow(/No provider/);
    });
});

describe('the verdict schema every provider is held to', () => {
    // Claude answers 400 for these on an integer, and nothing is lost by
    // leaving them out: the reply is parsed with the zod schema, which still
    // enforces every bound.
    it('carries no numeric ranges a provider would refuse', () => {
        const found: string[] = [];
        const walk = (node: unknown): void => {
            if (Array.isArray(node)) {
                node.forEach(walk);
            } else if (node && typeof node === 'object') {
                for (const [key, value] of Object.entries(node)) {
                    if (
                        ['minimum', 'maximum'].includes(
                            key.replace(/^exclusive/, '').toLowerCase(),
                        )
                    ) {
                        found.push(key);
                    }

                    walk(value);
                }
            }
        };

        walk(REVIEW_VERDICT_JSON_SCHEMA);

        expect(found).toEqual([]);
        // Still a schema, not something the stripping hollowed out.
        expect(REVIEW_VERDICT_JSON_SCHEMA).toMatchObject({
            type: 'object',
            required: [
                'publish',
                'reject',
                'rejectName',
                'add',
                'confidence',
                'note',
            ],
        });
    });
});

describe('the OpenAI-compatible provider', () => {
    it('sends the system prompt as a message and reads the choice back', async () => {
        const sent = stubFetch({
            choices: [{ message: { content: 'a reading' } }],
            usage: { prompt_tokens: 11, completion_tokens: 3 },
        });

        const reply = await openai.complete(config(), ask);

        expect(reply).toEqual({
            text: 'a reading',
            usage: { input: 11, output: 3 },
        });
        expect(sent[0].url).toBe('https://api.openai.com/v1/chat/completions');
        expect(sent[0].headers.authorization).toBe('Bearer a-key');
        expect(sent[0].body.messages).toEqual([
            { role: 'system', content: 'be brief' },
            { role: 'user', content: 'a name' },
        ]);
    });

    // The whole point of "OpenAI-compatible": a gateway, a proxy or a local
    // server answers the same shape at another address.
    it('goes to the gateway the agent names, without a doubled slash', async () => {
        const sent = stubFetch({ choices: [{ message: { content: 'ok' } }] });

        await openai.complete(
            config({ baseUrl: 'https://gateway.example/v1/' }),
            ask,
        );

        expect(sent[0].url).toBe('https://gateway.example/v1/chat/completions');
    });

    it('passes the agent’s own dials and headers through', async () => {
        const sent = stubFetch({ choices: [{ message: { content: 'ok' } }] });

        await openai.complete(
            config({
                options: {
                    temperature: 0.7,
                    headers: { 'x-tenant': 'tbn', 'x-bad': 3 },
                },
            }),
            ask,
        );

        expect(sent[0].body.temperature).toBe(0.7);
        expect(sent[0].headers['x-tenant']).toBe('tbn');
        expect(sent[0].headers['x-bad']).toBeUndefined();
    });

    // Every current OpenAI model is a reasoning model, and those reject both
    // `max_tokens` and a temperature they were not asked for.
    it('asks for a completion ceiling by its current name, and no temperature', async () => {
        const sent = stubFetch({ choices: [{ message: { content: 'ok' } }] });

        await openai.complete(config(), ask);

        expect(sent[0].body.max_completion_tokens).toBe(64);
        expect(sent[0].body).not.toHaveProperty('max_tokens');
        expect(sent[0].body).not.toHaveProperty('temperature');
    });

    // A self-hosted server that only knows the old spelling, reachable without
    // a code change.
    it('lets a null in the agent’s body drop a field', async () => {
        const sent = stubFetch({ choices: [{ message: { content: 'ok' } }] });

        await openai.complete(
            config({
                options: {
                    body: { max_completion_tokens: null, max_tokens: 800 },
                },
            }),
            ask,
        );

        expect(sent[0].body).not.toHaveProperty('max_completion_tokens');
        expect(sent[0].body.max_tokens).toBe(800);
    });

    it('keeps the provider’s own words when it refuses', async () => {
        stubFetch({ error: { message: 'model not found' } }, 404);

        await expect(openai.complete(config(), ask)).rejects.toThrow(
            /404.*model not found/,
        );
    });

    it('calls an empty answer a failure rather than parsing it', async () => {
        stubFetch({ choices: [{ message: { content: '' } }] });

        await expect(openai.complete(config(), ask)).rejects.toThrow(/no text/);
    });
});

describe('the Ollama provider', () => {
    it('asks localhost for one answer rather than a stream', async () => {
        const sent = stubFetch({
            message: { content: 'a reading' },
            prompt_eval_count: 9,
            eval_count: 4,
        });

        const reply = await ollama.complete(
            config({ provider: 'ollama', apiKey: null }),
            ask,
        );

        expect(reply).toEqual({
            text: 'a reading',
            usage: { input: 9, output: 4 },
        });
        expect(sent[0].url).toBe('http://127.0.0.1:11434/api/chat');
        expect(sent[0].body.stream).toBe(false);
        expect(sent[0].headers.authorization).toBeUndefined();
    });

    // Found against a real qwen3: a reasoning model writes its deliberation to
    // `thinking` and spends the whole ceiling before `content` gets a word, so
    // an empty answer has to say which of the two happened.
    it('says the budget went on thinking rather than "answered nothing"', async () => {
        stubFetch({
            message: { content: '', thinking: 'Okay, the user wants…' },
            done_reason: 'length',
        });

        await expect(
            ollama.complete(config({ provider: 'ollama', apiKey: null }), ask),
        ).rejects.toThrow(/thinking.*think.*false/s);
    });

    it('turns thinking off when the agent asks it to', async () => {
        const sent = stubFetch({ message: { content: 'ready' } });

        await ollama.complete(
            config({
                provider: 'ollama',
                apiKey: null,
                options: { think: false },
            }),
            ask,
        );

        expect(sent[0].body.think).toBe(false);
    });

    it('leaves thinking alone when the agent says nothing about it', async () => {
        const sent = stubFetch({ message: { content: 'ready' } });

        await ollama.complete(
            config({ provider: 'ollama', apiKey: null }),
            ask,
        );

        expect('think' in sent[0].body).toBe(false);
    });

    it('carries the token ceiling under the name Ollama uses', async () => {
        const sent = stubFetch({ message: { content: 'ok' } });

        await ollama.complete(
            config({ provider: 'ollama', apiKey: null }),
            ask,
        );

        expect(sent[0].body.options).toEqual({
            temperature: 0,
            num_predict: 64,
        });
    });
});

describe('a provider that cannot be reached', () => {
    it('says so rather than leaking the fetch error', async () => {
        vi.stubGlobal('fetch', async () => {
            throw new Error('ECONNREFUSED');
        });

        const error = await ollama
            .complete(config({ provider: 'ollama', apiKey: null }), ask)
            .catch((thrown: unknown) => thrown);

        expect(error).toBeInstanceOf(AgentCallError);
        expect((error as AgentCallError).message).toMatch(/Could not reach/);
        // Nothing to retry against a refused connection is still worth a retry:
        // a local model that is starting up refuses for a second.
        expect((error as AgentCallError).retryable).toBe(true);
    });

    it('knows a 400 will never come good', async () => {
        stubFetch({ error: 'bad request' }, 400);

        const error = await openai
            .complete(config(), ask)
            .catch((thrown: unknown) => thrown);

        expect((error as AgentCallError).retryable).toBe(false);
    });

    it('retries a rate limit and a server fault', async () => {
        for (const status of [429, 503]) {
            stubFetch({ error: 'later' }, status);

            const error = await openai
                .complete(config(), ask)
                .catch((thrown: unknown) => thrown);

            expect((error as AgentCallError).retryable).toBe(true);
        }
    });
});
