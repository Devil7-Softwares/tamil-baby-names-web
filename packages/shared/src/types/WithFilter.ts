import { IFilterData } from '../interfaces/index.js';

export type WithFilters<T> = T & {
    filters: IFilterData;
};
