import { Op, QueryTypes, Sequelize } from 'sequelize';

import { MeaningsModel, NamesModel, SourcesModel } from './models.js';

/** Marks every reading the fixture wrote, so undoing it is exact. */
export const FIXTURE_SOURCE = 'dev-fixture';

/** How many duplicated clusters get a reviewer's worth of disagreement. */
export const DEFAULT_CLUSTERS = 25;

export interface FixtureModels {
    sequelize: Sequelize;
    names: NamesModel;
    meanings: MeaningsModel;
    sources: SourcesModel;
}

export interface FixtureReport {
    clusters: number;
    readings: number;
}

export interface FixtureRemoval {
    readings: number;
    /** Rows whose own reading had been displaced by a fixture one. */
    republished: number;
}

/**
 * Gives each row of a duplicated cluster the readings its siblings carry, as
 * candidates.
 *
 * The catalogue disagrees with itself already — அகாத் is அழிப்பவர் on one row and
 * மருத்துவர் on the other — but each row holds only its own reading, so a
 * reviewer is never asked to choose. This makes the disagreement explicit
 * without inventing a word: every text it writes is already in the catalogue.
 *
 * A cluster whose rows agree produces nothing, which is right — there is
 * nothing there to decide.
 */
export const seedReviewFixture = async (
    { sequelize, names, meanings, sources }: FixtureModels,
    clusterLimit: number = DEFAULT_CLUSTERS,
): Promise<FixtureReport> => {
    const [source] = await sources.findOrCreate({
        where: { slug: FIXTURE_SOURCE },
        defaults: {
            slug: FIXTURE_SOURCE,
            kind: 'fixture',
            title: 'Development review fixture',
            trust: 0,
        },
    });

    const clusterIds = (
        await sequelize.query<{ cluster_id: number }>(
            `SELECT "cluster_id" FROM "names"
             WHERE "cluster_id" IS NOT NULL
             GROUP BY "cluster_id" HAVING count(*) > 1
             ORDER BY "cluster_id" LIMIT :clusterLimit`,
            { type: QueryTypes.SELECT, replacements: { clusterLimit } },
        )
    ).map((row) => row.cluster_id);

    if (!clusterIds.length) {
        return { clusters: 0, readings: 0 };
    }

    const rows = (
        await names.findAll({ where: { clusterId: { [Op.in]: clusterIds } } })
    ).map(({ dataValues }) => dataValues);

    const readings = (
        await meanings.findAll({
            where: { nameId: { [Op.in]: rows.map(({ id }) => id) } },
        })
    ).map(({ dataValues }) => dataValues);

    const drafts = [];

    for (const clusterId of clusterIds) {
        const members = rows.filter((row) => row.clusterId === clusterId);
        const here = readings.filter(({ nameId }) =>
            members.some((row) => row.id === nameId),
        );
        const texts = new Set(here.map(({ text }) => text));

        for (const member of members) {
            const already = new Set(
                here
                    .filter(({ nameId }) => nameId === member.id)
                    .map(({ text }) => text),
            );

            for (const text of texts) {
                if (!already.has(text)) {
                    drafts.push({
                        nameId: member.id,
                        text,
                        sourceId: source.dataValues.id,
                        status: 'candidate' as const,
                    });
                }
            }
        }
    }

    await meanings.bulkCreate(drafts);

    return { clusters: clusterIds.length, readings: drafts.length };
};

/**
 * Removes every reading the fixture wrote. A name left with none published —
 * because a reviewer published a fixture reading, which demoted the import's —
 * gets its own reading back, the oldest being the one that was there first.
 */
export const undoReviewFixture = async ({
    meanings,
    sources,
}: FixtureModels): Promise<FixtureRemoval> => {
    const source = await sources.findOne({
        where: { slug: FIXTURE_SOURCE },
    });

    if (!source) {
        return { readings: 0, republished: 0 };
    }

    const sourceId = source.dataValues.id;

    const removed = (await meanings.findAll({ where: { sourceId } })).map(
        ({ dataValues }) => dataValues,
    );

    await meanings.destroy({ where: { sourceId } });
    await sources.destroy({ where: { id: sourceId } });

    const touched = [
        ...new Set(
            removed
                .map(({ nameId }) => nameId)
                .filter((id): id is number => id !== null),
        ),
    ];

    let republished = 0;

    for (const nameId of touched) {
        const left = (
            await meanings.findAll({
                where: { nameId },
                order: [['id', 'ASC']],
            })
        ).map(({ dataValues }) => dataValues);

        if (left.length && !left.some(({ status }) => status === 'published')) {
            await meanings.update(
                { status: 'published' },
                { where: { id: left[0].id } },
            );

            republished++;
        }
    }

    // A catalogue row a reviewer set to candidate or rejected stays there: that
    // was their decision, not the fixture's.
    return { readings: removed.length, republished };
};
