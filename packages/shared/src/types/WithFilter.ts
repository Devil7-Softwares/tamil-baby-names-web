import { IFilterData } from '../interfaces';

export type WithFilters<T> = T & {
    filters: IFilterData;
};
