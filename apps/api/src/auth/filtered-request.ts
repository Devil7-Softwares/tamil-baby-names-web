import { IFilterData } from '@tbn/shared';
import { Request } from 'express';

export interface FilteredRequest extends Request {
    filters?: IFilterData;
}
