import { Inject, Injectable } from '@nestjs/common';

import { LANGUAGES_MODEL, RELIGIONS_MODEL } from './database.constants.js';
import { ILookup, LookupModel } from './models.js';

export interface CatalogueLabels {
    religions: Map<number, string>;
    languages: Map<number, string>;
}

/**
 * Turns the ids a catalogue row points at back into the names it used to
 * repeat as text. Two tables of three rows each, so they are read rather than
 * joined: the queries that need them already page over something else.
 */
@Injectable()
export class LookupsService {
    constructor(
        @Inject(RELIGIONS_MODEL) private readonly religions: LookupModel,
        @Inject(LANGUAGES_MODEL) private readonly languages: LookupModel,
    ) {}

    async labels(): Promise<CatalogueLabels> {
        const [religions, languages] = await Promise.all([
            this.namesById(this.religions),
            this.namesById(this.languages),
        ]);

        return { religions, languages };
    }

    private async namesById(model: LookupModel): Promise<Map<number, string>> {
        const rows = (await model.findAll({
            attributes: ['id', 'name'],
            raw: true,
        })) as unknown as Array<Pick<ILookup, 'id' | 'name'>>;

        return new Map(rows.map(({ id, name }) => [id, name]));
    }
}
