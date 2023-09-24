import dayjs from 'dayjs';

import { IFilterState } from '../interfaces';
import { getDefaultTimezone } from './Timezone';
import { getLunarMansion, getLunarMansionIndex } from './astro';

const sentenseCase = (str: string) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};

export const getStateFromParams = (params: URLSearchParams) => {
    return {
        gender: (params.get('gender') as IFilterState['gender']) || undefined,
        startsWith:
            (params
                .get('startsWith')
                ?.split(',') as IFilterState['startsWith']) || undefined,
        twinNames: params.get('twinNames') === 'true',
        religion:
            (params.get('religion') as IFilterState['religion']) || undefined,
        startsWithMode:
            (params.get('startsWithMode') as IFilterState['startsWithMode']) ||
            'none',
        tob: params.get('tob') || dayjs().format('YYYY-MM-DDTHH:mm'),
        tz: params.get('tz') || getDefaultTimezone(),
    };
};

export const getDocumentTitleByFilter = (filter: IFilterState) => {
    let documentTitle = [];

    if (filter.twinNames) {
        if (filter.gender) {
            if (filter.religion) {
                documentTitle.push(
                    `Twin Names for ${sentenseCase(
                        filter.religion
                    )} ${sentenseCase(filter.gender)}s`
                );
            } else {
                documentTitle.push(
                    `Twin Names for ${sentenseCase(filter.gender)}s`
                );
            }
        } else if (filter.religion) {
            documentTitle.push(`${sentenseCase(filter.religion)} Names`);
        } else {
            documentTitle.push('Twin Names');
        }
    } else {
        if (filter.gender) {
            if (filter.religion) {
                documentTitle.push(
                    `${sentenseCase(filter.religion)} ${sentenseCase(
                        filter.gender
                    )} Names`
                );
            } else {
                documentTitle.push(`${sentenseCase(filter.gender)} Names`);
            }
        } else if (filter.religion) {
            documentTitle.push(`${sentenseCase(filter.religion)} Names`);
        }
    }

    if (
        filter.startsWithMode === 'manual' &&
        filter.startsWith &&
        filter.startsWith.length > 0
    ) {
        documentTitle.push(`Starting with ${filter.startsWith}`);
    } else if (filter.startsWithMode === 'auto' && filter.tob && filter.tz) {
        const date = dayjs(filter.tob, filter.tz);

        if (date.isValid()) {
            const lunarMansionIndex = getLunarMansionIndex(date.toDate());
            const lunarMansion = getLunarMansion(lunarMansionIndex, 'en');

            documentTitle.push(`For ${lunarMansion} Nakshatra`);
        }
    }

    documentTitle.push('Tamil Baby Names');

    return documentTitle.join(' | ');
};
