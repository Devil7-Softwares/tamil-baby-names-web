import { NameStatus, ReviewVerdict } from '@tbn/shared';
import { Op, Sequelize } from 'sequelize';
import { describe, expect, it } from 'vitest';

import {
    IAgent,
    IMeaning,
    MeaningsModel,
    NamesModel,
    NamesRow,
    SourcesModel,
    VerificationDraft,
    VerificationsModel,
} from '../src/database/models.js';
import {
    applyVerdict,
    Candidate,
    parseVerdict,
    ReviewModels,
    subjectOf,
} from '../src/review/reviewer.js';

const agent: IAgent = {
    id: 7,
    slug: 'local-qwen3',
    name: 'Local qwen3',
    provider: 'ollama',
    baseUrl: null,
    model: 'qwen3:8b',
    keyCiphertext: null,
    keyIv: null,
    keyTag: null,
    options: {},
    enabled: true,
    createdAt: new Date(0),
    updatedAt: new Date(0),
};

const row = (id: number, status: NameStatus = 'candidate'): NamesRow =>
    ({
        id,
        clusterId: 9,
        name: 'அமுதன்',
        gender: 'boy',
        status,
        religionId: 1,
        languageId: 4,
        sourceId: 1,
        notes: null,
    }) as unknown as NamesRow;

const reading = (
    id: number,
    text: string,
    status: NameStatus = 'candidate',
): IMeaning =>
    ({
        id,
        nameId: 1,
        clusterId: 9,
        text,
        status,
        sourceId: 1,
    }) as unknown as IMeaning;

const candidate = (over: Partial<Candidate> = {}): Candidate => ({
    clusterId: 9,
    name: 'அமுதன்',
    gender: 'boy',
    religion: 'இந்து',
    language: 'தமிழ்',
    rows: [row(1)],
    readings: [reading(10, 'இனிமையானவர்'), reading(11, 'மருத்துவர்')],
    sources: new Map([[1, 'nithra.babyname']]),
    ...over,
});

const verdict = (over: Partial<ReviewVerdict> = {}): ReviewVerdict => ({
    publish: 1,
    reject: [],
    rejectName: false,
    add: null,
    confidence: 90,
    note: 'From அமுதம், nectar.',
    ...over,
});

/** Records what was written, and the order the statuses were applied in. */
const build = () => {
    const ledger: VerificationDraft[] = [];
    const moves: Array<{ what: string; status: string; ids: number[] }> = [];
    const created: Array<Record<string, unknown>> = [];

    const mover = (what: string) => ({
        update: async (
            values: { status: string },
            options: { where: { id: { [Op.in]: number[] } } },
        ) => {
            moves.push({
                what,
                status: values.status,
                ids: options.where.id[Op.in],
            });

            return [1];
        },
        create: async (draft: Record<string, unknown>) => {
            created.push(draft);

            return { dataValues: { ...draft, id: 99 } };
        },
    });

    const models: ReviewModels = {
        sequelize: {
            transaction: async (run: (t: unknown) => unknown) => run({}),
        } as unknown as Sequelize,
        names: mover('names') as unknown as NamesModel,
        meanings: mover('meanings') as unknown as MeaningsModel,
        sources: {
            findOrCreate: async () => [{ dataValues: { id: 42 } }, true],
        } as unknown as SourcesModel,
        verifications: {
            bulkCreate: async (entries: VerificationDraft[]) => {
                ledger.push(...entries);

                return [];
            },
        } as unknown as VerificationsModel,
    };

    return { models, ledger, moves, created };
};

describe('reading a verdict', () => {
    it('takes JSON wrapped in whatever the model said around it', () => {
        const parsed = parseVerdict(
            'Sure! ```json\n{"publish":1,"reject":[2],"rejectName":false,' +
                '"add":null,"confidence":80,"note":"ok"}\n``` Hope that helps.',
        );

        expect(parsed).toEqual({
            verdict: {
                publish: 1,
                reject: [2],
                rejectName: false,
                add: null,
                confidence: 80,
                note: 'ok',
            },
        });
    });

    it('names what was wrong rather than throwing', () => {
        expect(parseVerdict('I am not sure.')).toEqual({
            unreadable: 'The model did not answer with JSON.',
        });
        expect(parseVerdict('{ nope }')).toHaveProperty('unreadable');
        expect(parseVerdict('{"publish":1,"confidence":900}')).toHaveProperty(
            'unreadable',
        );
    });
});

describe('what the model is shown', () => {
    it('numbers the readings from one and says which is live', () => {
        expect(
            subjectOf(
                candidate({
                    readings: [
                        reading(10, 'இனிமையானவர்', 'published'),
                        reading(11, 'மருத்துவர்'),
                    ],
                }),
            ).readings,
        ).toEqual([
            {
                at: 1,
                text: 'இனிமையானவர்',
                source: 'nithra.babyname',
                published: true,
            },
            {
                at: 2,
                text: 'மருத்துவர்',
                source: 'nithra.babyname',
                published: false,
            },
        ]);
    });
});

describe('applying a verdict', () => {
    it('publishes the reading it chose and rejects the ones it named', async () => {
        const { models, ledger, moves } = build();

        const outcome = await applyVerdict(
            models,
            agent,
            candidate(),
            verdict({ publish: 1, reject: [2] }),
        );

        expect(outcome).toMatchObject({
            published: 1,
            rejected: 1,
            abstained: false,
        });
        expect(moves).toEqual([
            { what: 'meanings', status: 'rejected', ids: [11] },
            { what: 'meanings', status: 'published', ids: [10] },
        ]);
        expect(ledger).toHaveLength(2);
        expect(ledger.every((entry) => entry.agentId === 7)).toBe(true);
        expect(ledger.every((entry) => entry.confidence === 90)).toBe(true);
    });

    // Every verdict has to be findable by whoever does the second pass, so the
    // model's own words go on each row it caused.
    it('stamps the note on every row it wrote', async () => {
        const { models, ledger } = build();

        await applyVerdict(
            models,
            agent,
            candidate(),
            verdict({ reject: [2] }),
        );

        expect(
            ledger.every((entry) => entry.note === 'From அமுதம், nectar.'),
        ).toBe(true);
    });

    it('leaves a published reading alone unless it is displacing it', async () => {
        const { models, moves } = build();

        await applyVerdict(
            models,
            agent,
            candidate({
                readings: [
                    reading(10, 'இனிமையானவர்', 'published'),
                    reading(11, 'மருத்துவர்'),
                ],
            }),
            verdict({ publish: 2, reject: [] }),
        );

        // Demotion first: the unique index on a cluster's published reading is
        // not deferrable.
        expect(moves).toEqual([
            { what: 'meanings', status: 'candidate', ids: [10] },
            { what: 'meanings', status: 'published', ids: [11] },
        ]);
    });

    it('will not reject a reading a person published', async () => {
        const { models, moves } = build();

        const outcome = await applyVerdict(
            models,
            agent,
            candidate({
                readings: [reading(10, 'இனிமையானவர்', 'published')],
            }),
            verdict({ publish: null, reject: [1] }),
        );

        expect(outcome.rejected).toBe(0);
        expect(moves).toEqual([]);
    });

    it('records agreement with what is already published', async () => {
        const { models, ledger, moves } = build();

        const outcome = await applyVerdict(
            models,
            agent,
            candidate({
                readings: [reading(10, 'இனிமையானவர்', 'published')],
            }),
            verdict({ publish: 1 }),
        );

        expect(moves).toEqual([]);
        expect(outcome.abstained).toBe(false);
        expect(ledger).toEqual([
            expect.objectContaining({
                meaningId: 10,
                fromStatus: 'published',
                toStatus: 'published',
                agentId: 7,
            }),
        ]);
    });

    it('writes its own reading as a candidate, under its own source', async () => {
        const { models, created } = build();

        const outcome = await applyVerdict(
            models,
            agent,
            candidate(),
            verdict({ publish: null, reject: [1, 2], add: 'அமுதம் போன்றவர்' }),
        );

        expect(outcome.added).toBe(1);
        expect(created).toEqual([
            {
                nameId: 1,
                text: 'அமுதம் போன்றவர்',
                sourceId: 42,
                status: 'candidate',
            },
        ]);
    });

    it('does not write a reading the cluster already has', async () => {
        const { models, created } = build();

        await applyVerdict(
            models,
            agent,
            candidate(),
            verdict({ add: 'இனிமையானவர்' }),
        );

        expect(created).toEqual([]);
    });

    it('drops the rows and readings of something that is not a name', async () => {
        const { models, moves, ledger } = build();

        const outcome = await applyVerdict(
            models,
            agent,
            candidate({ rows: [row(1), row(2)] }),
            verdict({ rejectName: true, publish: null }),
        );

        expect(outcome).toMatchObject({ dropped: 2, rejected: 2 });
        expect(moves).toEqual([
            { what: 'names', status: 'rejected', ids: [1, 2] },
            { what: 'meanings', status: 'rejected', ids: [10, 11] },
        ]);
        expect(ledger).toHaveLength(4);
    });
});

describe('a run that is told to change nothing', () => {
    // The whole point: two models cannot be compared if the first one's answer
    // has already changed the rows the second one is shown.
    it('records what it would have done and moves nothing', async () => {
        const { models, ledger, moves } = build();

        const outcome = await applyVerdict(
            models,
            agent,
            candidate(),
            verdict({ publish: 1, reject: [2] }),
            { applied: false, runId: 4 },
        );

        expect(outcome).toMatchObject({ published: 1, rejected: 1 });
        expect(moves).toEqual([]);
        expect(ledger).toHaveLength(2);
        expect(ledger.every((entry) => entry.reason === 'considered')).toBe(
            true,
        );
        // The status it *would* have reached is kept: without it "would have
        // rejected reading 2" is indistinguishable from "looked at reading 2",
        // and two models cannot be compared on what they would actually do.
        expect(ledger).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    meaningId: 11,
                    fromStatus: 'candidate',
                    toStatus: 'rejected',
                }),
                expect.objectContaining({
                    meaningId: 10,
                    fromStatus: 'candidate',
                    toStatus: 'published',
                }),
            ]),
        );
        expect(ledger.every((entry) => entry.runId === 4)).toBe(true);
    });

    it('counts a reading it would have written without writing it', async () => {
        const { models, created } = build();

        const outcome = await applyVerdict(
            models,
            agent,
            candidate(),
            verdict({ publish: null, reject: [], add: 'ஒரு புதிய பொருள்' }),
            { applied: false },
        );

        expect(outcome.added).toBe(1);
        expect(created).toEqual([]);
    });

    // Found by running it: Claude answered "none of these, here is a better
    // one" on two clusters, and both vanished from the run's own clusters.
    it('leaves a trace when all it would do is propose a reading', async () => {
        const { models, ledger } = build();

        await applyVerdict(
            models,
            agent,
            candidate(),
            verdict({ publish: null, reject: [], add: 'ஒரு புதிய பொருள்' }),
            { applied: false, runId: 5 },
        );

        expect(ledger).toHaveLength(1);
        expect(ledger[0]).toMatchObject({
            nameId: 1,
            reason: 'considered',
            runId: 5,
            fromStatus: 'candidate',
            toStatus: 'candidate',
        });
    });

    it('stamps the run on a verdict it did apply', async () => {
        const { models, ledger } = build();

        await applyVerdict(
            models,
            agent,
            candidate(),
            verdict({ reject: [2] }),
            { runId: 9 },
        );

        expect(ledger.every((entry) => entry.runId === 9)).toBe(true);
        expect(ledger.every((entry) => entry.reason !== 'considered')).toBe(
            true,
        );
    });
});

describe('a model that is not sure', () => {
    it('changes nothing and says it looked', async () => {
        const { models, ledger, moves } = build();

        const outcome = await applyVerdict(
            models,
            agent,
            candidate(),
            verdict({ confidence: 40, note: 'I do not know this name.' }),
        );

        expect(outcome.abstained).toBe(true);
        expect(moves).toEqual([]);
        expect(ledger).toEqual([
            {
                nameId: 1,
                fromStatus: 'candidate',
                toStatus: 'candidate',
                reason: 'abstained',
                agentId: 7,
                confidence: 40,
                note: 'I do not know this name.',
                runId: null,
            },
        ]);
    });

    // A confident verdict that names nothing real is still a verdict, and has
    // to be recorded or the next run asks the same question again.
    it('records a confident verdict that turned out to change nothing', async () => {
        const { models, ledger, moves } = build();

        const outcome = await applyVerdict(
            models,
            agent,
            candidate(),
            verdict({ publish: 99, reject: [98] }),
        );

        // Sure, and nothing to do — the opposite of abstaining, and counted
        // apart from it. Together they made the queue call a model unsure that
        // had never once been unsure.
        expect(outcome).toMatchObject({ abstained: false, unchanged: true });
        expect(moves).toEqual([]);
        expect(ledger).toEqual([
            expect.objectContaining({ reason: 'unchanged', confidence: 90 }),
        ]);
    });
});
