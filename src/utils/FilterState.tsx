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

import { IFilterState } from '../interfaces';
import { getDocumentTitleByFilter, getStateFromParams } from './Common';

const FilterStateContext = createContext<IFilterState>({} as IFilterState);

export const FilterStateProvider: React.FC<PropsWithChildren> = ({
    children,
}) => {
    const [searchParams] = useSearchParams();

    const state = useMemo<IFilterState>(
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

export const useFilterState = <K extends keyof IFilterState>(
    key: K,
    initialValue: IFilterState[K]
): [IFilterState[K], Dispatch<SetStateAction<IFilterState[K]>>] => {
    const [_, setSearchParams] = useSearchParams();

    const state = useContext(FilterStateContext);

    const setFilterState = useCallback(
        (
            value:
                | IFilterState[K]
                | ((prevState: IFilterState[K]) => IFilterState[K])
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

    return [state[key] ?? initialValue, setFilterState];
};
