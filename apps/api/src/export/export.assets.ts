import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'fs';
import { join, resolve } from 'path';
import pdfmake from 'pdfmake';

@Injectable()
export class ExportAssets {
    private readonly assetsDir =
        [join(__dirname, '..', 'assets'), join(process.cwd(), 'assets')].find(
            (path) => existsSync(path),
        ) || './assets';

    constructor() {
        const fontsDir = join(this.assetsDir, 'fonts');

        pdfmake.setFonts({
            Roboto: {
                normal: join(fontsDir, 'Roboto-Regular.ttf'),
                bold: join(fontsDir, 'Roboto-Bold.ttf'),
            },
            Barathi: {
                normal: join(fontsDir, 'TAU-Barathi-Regular.ttf'),
            },
        });

        pdfmake.setLocalAccessPolicy((path) =>
            resolve(path).startsWith(resolve(fontsDir)),
        );
        pdfmake.setUrlAccessPolicy(() => false);
    }

    zodiacIcon = (sign: string): string =>
        `data:image/png;base64,${readFileSync(
            join(this.assetsDir, 'zodiac', `${sign}.png`),
        ).toString('base64')}`;
}
