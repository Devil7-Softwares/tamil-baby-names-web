import { Numerology } from '@tbn/shared';

export type NumerologySuffix = '' | '1' | '2';

export const numerologyColumn = (
    numerology: Numerology,
    suffix: NumerologySuffix,
): string => {
    if (!/^[a-z]+$/.test(numerology)) {
        throw new Error(`Unsafe numerology name: ${numerology}`);
    }

    return `${numerology}_number${suffix}`;
};
