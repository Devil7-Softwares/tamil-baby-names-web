import { Gender, Religion } from '../types';

export interface IFilterData {
    gender?: Gender;
    startsWith?: string[];
    twinNames?: boolean;
    religion?: Religion;
}
