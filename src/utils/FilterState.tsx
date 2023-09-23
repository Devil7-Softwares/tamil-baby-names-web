import React, {
    Dispatch,
    PropsWithChildren,
    SetStateAction,
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from 'react';
import { IFilterState } from '../interfaces';
import { useSearchParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { getDefaultTimezone } from './Common';

const FilterStateContext = createContext<IFilterState>({} as IFilterState);

export const FilterStateProvider: React.FC<PropsWithChildren> = ({
    children,
}) => {
    const [searchParams] = useSearchParams();

    const state = useMemo<IFilterState>(
        () => ({
            gender:
                (searchParams.get('gender') as IFilterState['gender']) ||
                undefined,
            startsWith:
                (searchParams
                    .get('startsWith')
                    ?.split(',') as IFilterState['startsWith']) || undefined,
            twinNames: searchParams.get('twinNames') === 'true',
            religion:
                (searchParams.get('religion') as IFilterState['religion']) ||
                undefined,
            startsWithMode:
                (searchParams.get(
                    'startsWithMode'
                ) as IFilterState['startsWithMode']) || 'none',
            tob: searchParams.get('tob') || dayjs().format('YYYY-MM-DDTHH:mm'),
            tz: searchParams.get('tz') || getDefaultTimezone(),
        }),
        [searchParams]
    );

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
