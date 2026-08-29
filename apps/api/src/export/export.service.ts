import { Injectable } from '@nestjs/common';
import { IFilterData } from '@tbn/shared';
import pdfmake from 'pdfmake';

import { NamesService } from '../names/names.service';
import { ExportAssets } from './export.assets';
import { buildDocument, DocumentOrigin } from './export.document';

@Injectable()
export class ExportService {
    constructor(
        private readonly names: NamesService,
        private readonly assets: ExportAssets,
    ) {}

    async createPdf(
        filters: IFilterData,
        origin: DocumentOrigin,
    ): Promise<Buffer> {
        const [rows] = await this.names.getNamesForFilter(filters);

        const document = buildDocument(
            filters,
            rows,
            origin,
            this.assets.zodiacIcon,
        );

        return pdfmake.createPdf(document).getBuffer();
    }
}
