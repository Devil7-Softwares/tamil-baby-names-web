import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { IFilterData } from '@tbn/shared';

import { FilteredRequest } from './filtered-request.js';

export const Filters = createParamDecorator(
    (_data: unknown, context: ExecutionContext): IFilterData => {
        const request = context.switchToHttp().getRequest<FilteredRequest>();

        return (request.filters ?? {}) as IFilterData;
    },
);
