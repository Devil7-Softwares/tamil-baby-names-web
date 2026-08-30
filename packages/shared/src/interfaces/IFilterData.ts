import { Gender, Numerology, Panjangam, Religion } from '../types/index.js';

type FilterDataBase = {
    gender?: Gender;
    twinNames?: boolean;
    religion?: Religion;
    tob: string;
    tz: string;
    panjangam: Panjangam;
    numerology: Numerology;
    nameNumbers?: number[];
};

// Every variant declares `startsWith` so that `keyof IFilterData` stays the full
// set of keys; `useFilterState` indexes the union one key at a time and a key
// missing from any variant would drop out of `keyof`.

interface FilterDataStartsWithNone extends FilterDataBase {
    startsWithMode: 'none';
    startsWith?: never;
}

interface FilterDataStartsWithAuto extends FilterDataBase {
    startsWithMode: 'auto';
    startsWith?: never;
}

interface FilterDataStartsWithManual extends FilterDataBase {
    startsWithMode: 'manual';
    startsWith: string[];
}

export type IFilterData =
    | FilterDataStartsWithNone
    | FilterDataStartsWithAuto
    | FilterDataStartsWithManual;
