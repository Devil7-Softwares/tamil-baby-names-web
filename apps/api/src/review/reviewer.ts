import {
    CONFIDENT_ENOUGH,
    NameStatus,
    ReviewOutcome,
    ReviewSubject,
    ReviewVerdict,
    ReviewVerdictSchema,
} from '@tbn/shared';
import { Op, Sequelize, Transaction } from 'sequelize';

import {
    IAgent,
    IMeaning,
    MeaningsModel,
    NamesModel,
    NamesRow,
    SourcesModel,
    VerificationDraft,
    VerificationsModel,
} from '../database/models.js';

export interface ReviewModels {
    sequelize: Sequelize;
    names: NamesModel;
    meanings: MeaningsModel;
    sources: SourcesModel;
    verifications: VerificationsModel;
}

/** A cluster with everything the review needs, gathered once. */
export interface Candidate {
    clusterId: number;
    name: string;
    gender: string;
    religion: string | null;
    language: string | null;
    rows: NamesRow[];
    readings: IMeaning[];
    /** Source slugs by id, so a reading can be shown with where it came from. */
    sources: Map<number, string>;
}

/**
 * An agent writes under a source of its own, so a reading it invented is
 * traceable to the model that wrote it and can be found again later.
 */
export const agentSourceSlug = (agent: IAgent): string => `agent:${agent.slug}`;

const sourceFor = async (
    { sources }: ReviewModels,
    agent: IAgent,
    transaction: Transaction,
): Promise<number> => {
    const [row] = await sources.findOrCreate({
        where: { slug: agentSourceSlug(agent) },
        defaults: {
            slug: agentSourceSlug(agent),
            kind: 'agent',
            title: `${agent.name} (${agent.model})`,
            trust: 0,
        },
        transaction,
    });

    return row.dataValues.id;
};

/**
 * The cluster as the model is shown it. Only candidates are offered for
 * judgement, but a published reading is listed so the model can see what it
 * would be displacing rather than proposing into a vacuum.
 */
export const subjectOf = (candidate: Candidate): ReviewSubject => ({
    name: candidate.name,
    gender: candidate.gender,
    religion: candidate.religion,
    language: candidate.language,
    readings: candidate.readings.map((reading, index) => ({
        at: index + 1,
        text: reading.text,
        source: reading.sourceId
            ? (candidate.sources.get(reading.sourceId) ?? null)
            : null,
        published: reading.status === 'published',
    })),
});

/** A model's answer, or what was wrong with the one that could not be read. */
export type Parsed = { verdict: ReviewVerdict } | { unreadable: string };

/**
 * Providers hold a model to the schema where they can, but a small one still
 * wraps its answer in a code fence or a sentence. Reading the outermost object
 * out of the text costs little and saves a run from failing on punctuation.
 */
export const parseVerdict = (text: string): Parsed => {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');

    if (start < 0 || end < start) {
        return { unreadable: 'The model did not answer with JSON.' };
    }

    let raw: unknown;

    try {
        raw = JSON.parse(text.slice(start, end + 1)) as unknown;
    } catch {
        return { unreadable: 'The model’s JSON could not be parsed.' };
    }

    const parsed = ReviewVerdictSchema.safeParse(raw);

    return parsed.success
        ? { verdict: parsed.data }
        : {
              unreadable: parsed.error.issues
                  .map(({ path, message }) => `${path.join('.')}: ${message}`)
                  .join('; '),
          };
};

export interface VerdictOptions {
    /** The run it belongs to, stamped on every row so the run is re-askable. */
    runId?: number | null;
    /**
     * False records what the verdict *would* have done and changes nothing.
     * The ledger rows are written with `considered` and the status they already
     * had, so a second model can be asked the same question from the same
     * starting state — which is the only way the answers compare.
     */
    applied?: boolean;
}

/**
 * Applies one verdict, in one transaction.
 *
 * Two rules the model does not get a say in.
 *
 * **It only ever moves candidates.** A reading or a row a person published is
 * left where it is; the one exception is displacement, which is the same rule
 * the review queue already follows — publishing a reading sends the incumbent
 * back to the pool rather than rejecting it, because that is a consequence of
 * the promotion and not a judgement on the text.
 *
 * **A reading it writes is a candidate.** A model that invents a meaning has
 * proposed something, not decided it, and the queue is where proposals go.
 */
export const applyVerdict = async (
    models: ReviewModels,
    agent: IAgent,
    candidate: Candidate,
    verdict: ReviewVerdict,
    { runId = null, applied = true }: VerdictOptions = {},
): Promise<ReviewOutcome> => {
    const outcome: ReviewOutcome = {
        clusterId: candidate.clusterId,
        name: candidate.name,
        confidence: verdict.confidence,
        note: verdict.note,
        published: 0,
        rejected: 0,
        added: 0,
        dropped: 0,
        abstained: false,
    };

    if (verdict.confidence < CONFIDENT_ENOUGH) {
        await abstain(models, agent, candidate, verdict, runId);

        return { ...outcome, abstained: true };
    }

    return models.sequelize.transaction(async (transaction) => {
        const ledger: VerificationDraft[] = [];
        const stamp = {
            agentId: agent.id,
            confidence: verdict.confidence,
            note: verdict.note,
            runId,
        };

        // A run that only records still builds the whole ledger — the decision
        // is the same one — and then declines to act on it.
        const settle = async (
            model: Movable,
            key: 'nameId' | 'meaningId',
        ): Promise<void> => {
            if (applied) {
                await move(model, key, ledger, transaction);
            }
        };

        const at = (index: number): IMeaning | undefined =>
            candidate.readings[index - 1];

        if (verdict.rejectName) {
            // The whole entry is not a name. Its readings go with it: they are
            // readings *of* something that should not be in the catalogue.
            for (const row of candidate.rows) {
                if (row.status === 'candidate') {
                    ledger.push({
                        nameId: row.id,
                        fromStatus: row.status,
                        toStatus: 'rejected',
                        ...stamp,
                    });
                    outcome.dropped += 1;
                }
            }

            for (const reading of candidate.readings) {
                if (reading.status === 'candidate') {
                    ledger.push({
                        meaningId: reading.id,
                        fromStatus: reading.status,
                        toStatus: 'rejected',
                        ...stamp,
                    });
                    outcome.rejected += 1;
                }
            }

            await settle(models.names as Movable, 'nameId');
            await settle(models.meanings as Movable, 'meaningId');
            await record(models, considered(ledger, applied), transaction);

            return outcome;
        }

        for (const index of new Set(verdict.reject)) {
            const reading = at(index);

            if (reading && reading.status === 'candidate') {
                ledger.push({
                    meaningId: reading.id,
                    fromStatus: reading.status,
                    toStatus: 'rejected',
                    ...stamp,
                });
                outcome.rejected += 1;
            }
        }

        const chosen =
            verdict.publish === null ? undefined : at(verdict.publish);

        // Choosing the reading the catalogue already publishes is agreement,
        // and worth recording as such: it is the second opinion the ledger
        // exists to hold, and it stops this counting as "did not decide".
        if (chosen && chosen.status === 'published') {
            ledger.push({
                meaningId: chosen.id,
                fromStatus: 'published',
                toStatus: 'published',
                ...stamp,
            });
        }

        if (chosen && chosen.status === 'candidate') {
            // Before the promotion, not after: `meanings_published_cluster_idx`
            // is unique and not deferrable.
            for (const reading of candidate.readings) {
                if (
                    reading.id !== chosen.id &&
                    reading.status === 'published'
                ) {
                    ledger.push({
                        meaningId: reading.id,
                        fromStatus: 'published',
                        toStatus: 'candidate',
                        reason: 'displacement',
                        ...stamp,
                    });
                }
            }

            ledger.push({
                meaningId: chosen.id,
                fromStatus: chosen.status,
                toStatus: 'published',
                ...stamp,
            });
            outcome.published += 1;
        }

        await settle(models.meanings as Movable, 'meaningId');

        const added = verdict.add?.trim();

        if (added && !candidate.readings.some(({ text }) => text === added)) {
            outcome.added += 1;
        }

        if (applied && outcome.added) {
            await models.meanings.create(
                {
                    nameId: candidate.rows[0].id,
                    text: (added as string).normalize('NFC'),
                    sourceId: await sourceFor(models, agent, transaction),
                    status: 'candidate',
                },
                { transaction },
            );
        }

        await record(models, considered(ledger, applied), transaction);

        // A verdict whose only act was proposing a reading moves nothing, so it
        // builds no ledger entry. When the run also writes nothing there is
        // then no trace it was ever asked — the cluster drops out of the run's
        // own clusters, and a re-ask silently loses it.
        if (!ledger.length && outcome.added && !applied) {
            await record(
                models,
                [
                    {
                        nameId: candidate.rows[0].id,
                        fromStatus: candidate.rows[0].status,
                        toStatus: candidate.rows[0].status,
                        reason: 'considered',
                        agentId: agent.id,
                        confidence: verdict.confidence,
                        note: verdict.note,
                        runId,
                    },
                ],
                transaction,
            );
        }

        if (!ledger.length && !outcome.added) {
            await abstain(
                models,
                agent,
                candidate,
                verdict,
                runId,
                transaction,
            );

            return { ...outcome, abstained: true };
        }

        return outcome;
    });
};

/**
 * Records that the agent looked and did not decide. Without this a second run
 * asks the same question of the same 160,000 rows, and a person has no way to
 * find what the model found hard.
 */
const abstain = async (
    models: ReviewModels,
    agent: IAgent,
    candidate: Candidate,
    verdict: ReviewVerdict,
    runId: number | null,
    transaction?: Transaction,
): Promise<void> => {
    const subject = candidate.rows[0];

    await record(
        models,
        [
            {
                nameId: subject.id,
                fromStatus: subject.status,
                toStatus: subject.status,
                reason: 'abstained',
                agentId: agent.id,
                confidence: verdict.confidence,
                note: verdict.note,
                runId,
            },
        ],
        transaction,
    );
};

/**
 * The ledger as a run that writes nothing should record it: every entry left
 * where it was, and `considered` in place of what it would have been. Returned
 * unchanged for a run that does write.
 */
const considered = (
    ledger: VerificationDraft[],
    applied: boolean,
): VerificationDraft[] =>
    applied
        ? ledger
        : ledger.map((entry) => ({
              ...entry,
              toStatus: entry.fromStatus,
              reason: 'considered' as const,
          }));

/**
 * The narrow slice of a model this needs. `names` and `meanings` have
 * different generics and only their status is being moved.
 */
interface Movable {
    update(
        values: { status: NameStatus },
        options: {
            where: { id: { [Op.in]: number[] } };
            transaction: Transaction;
        },
    ): Promise<unknown>;
}

/** Applies the ledger's own statements to the rows they are about. */
const move = async (
    model: Movable,
    key: 'nameId' | 'meaningId',
    ledger: VerificationDraft[],
    transaction: Transaction,
): Promise<void> => {
    // Demotions before promotions. `meanings_published_cluster_idx` is unique
    // and not deferrable, so the incumbent has to be out of the way in an
    // earlier statement than the one that promotes its replacement.
    for (const status of ['rejected', 'candidate', 'published'] as const) {
        const ids = ledger
            .filter(
                (entry) =>
                    entry.toStatus === status &&
                    entry.fromStatus !== status &&
                    entry.reason !== 'abstained' &&
                    typeof entry[key] === 'number',
            )
            .map((entry) => entry[key] as number);

        if (ids.length) {
            await model.update(
                { status },
                { where: { id: { [Op.in]: ids } }, transaction },
            );
        }
    }
};

const record = async (
    { verifications }: ReviewModels,
    entries: VerificationDraft[],
    transaction?: Transaction,
): Promise<void> => {
    if (entries.length) {
        await verifications.bulkCreate(entries, { transaction });
    }
};
