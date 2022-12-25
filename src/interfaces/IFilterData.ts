import { Gender } from '../types';

export interface IFilterData {
    gender?: Gender;
    startsWith?: string[];
    twinNames?: boolean;
}
