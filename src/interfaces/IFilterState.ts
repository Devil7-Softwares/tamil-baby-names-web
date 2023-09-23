import { IFilterData } from './IFilterData';

export interface IFilterState extends IFilterData {
    startsWithMode: 'none' | 'auto' | 'manual';
    tob: string;
    tz: string;
}
