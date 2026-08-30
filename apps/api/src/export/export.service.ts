import { Injectable } from '@nestjs/common';
import { IFilterData } from '@tbn/shared';
import pdfmake from 'pdfmake';

import { NamesService } from '../names/names.service.js';
import { ExportAssets } from './export.assets.js';
import { buildDocument, DocumentOrigin } from './export.document.js';

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
