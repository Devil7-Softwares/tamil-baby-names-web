import { FindOptions } from 'sequelize';

export interface KnownName {
    name: string;
    gender: string;
}

/** The one call this needs of the clusters model. */
export interface ClusterReader {
    findAll(options: FindOptions): Promise<unknown[]>;
}

/**
 * Every spelling the catalogue holds, under each gender it holds it — the pair
 * a cluster is keyed on, and so the pair an import would collapse into one.
 *
 * Whatever the review status: a rejected name is still one the catalogue has
 * decided about, and offering it again would only bring it back to the queue.
 * Nothing but the spelling and the gender leaves, because nothing else is
 * needed to say whether a name is new.
 */
export const knownNames = async (
    clusters: ClusterReader,
): Promise<KnownName[]> => {
    const rows = await clusters.findAll({
        attributes: ['name', 'gender'],
        order: [
            ['sortKey', 'ASC'],
            ['gender', 'ASC'],
        ],
        raw: true,
    });

    return rows.map((row) => {
        const { name, gender } = row as unknown as KnownName;

        return { name, gender };
    });
};
