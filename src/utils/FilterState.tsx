import React, {
    Dispatch,
    PropsWithChildren,
    SetStateAction,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
} from 'react';
import { useSearchParams } from 'react-router-dom';

import { IFilterData } from '../interfaces';
import { getDocumentTitleByFilter, getStateFromParams } from './Common';

const FilterStateContext = createContext<IFilterData>({} as IFilterData);

export const FilterStateProvider: React.FC<PropsWithChildren> = ({
    children,
}) => {
    const [searchParams] = useSearchParams();

    const state = useMemo<IFilterData>(
        () => getStateFromParams(searchParams),
        [searchParams]
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

export const useFilterState = <K extends keyof IFilterData>(
    key: K
): [IFilterData[K], Dispatch<SetStateAction<IFilterData[K]>>] => {
    const [_, setSearchParams] = useSearchParams();

    const state = useContext(FilterStateContext);

    const setFilterState = useCallback(
        (
            value:
                | IFilterData[K]
                | ((prevState: IFilterData[K]) => IFilterData[K])
        ) => {
            const newValue =
                value instanceof Function ? value(state[key]) : value;

            setSearchParams((prevParams) => {
                const newParams = new URLSearchParams(prevParams);

                if (newValue) {
                    newParams.set(key, newValue.toString());
                } else {
                    newParams.delete(key);
                }

                return newParams;
            });
        },
        [key, state, setSearchParams]
    );

    return [state[key], setFilterState];
};
