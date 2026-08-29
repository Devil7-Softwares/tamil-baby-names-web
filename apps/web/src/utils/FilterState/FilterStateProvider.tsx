import { IFilterData } from '@tbn/shared';
import React, { PropsWithChildren, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { getDocumentTitleByFilter, getStateFromParams } from '../Common';
import { FilterStateContext } from './FilterStateContext';

export const FilterStateProvider: React.FC<PropsWithChildren> = ({
    children,
}) => {
    const [searchParams] = useSearchParams();

    const state = useMemo<IFilterData>(
        () => getStateFromParams(searchParams),
        [searchParams],
    );

    useEffect(() => {
        document.title = getDocumentTitleByFilter(state);
    }, [state]);

    return (
        <FilterStateContext.Provider value={state}>
            {children}
        </FilterStateContext.Provider>
    );
};
