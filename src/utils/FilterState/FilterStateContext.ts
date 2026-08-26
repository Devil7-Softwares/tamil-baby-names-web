import {
    createContext,
    Dispatch,
    SetStateAction,
    useCallback,
    useContext,
} from 'react';
import { useSearchParams } from 'react-router-dom';

import { IFilterData } from '../../interfaces';

export const FilterStateContext = createContext<IFilterData>({} as IFilterData);

export const useFilterState = <K extends keyof IFilterData>(
    key: K,
): [IFilterData[K], Dispatch<SetStateAction<IFilterData[K]>>] => {
    const [_, setSearchParams] = useSearchParams();

    const state = useContext(FilterStateContext);

    const setFilterState = useCallback(
        (
            value:
                | IFilterData[K]
                | ((prevState: IFilterData[K]) => IFilterData[K]),
        ) => {
            const newValue =
                value instanceof Function ? value(state[key]) : value;

            const isEmpty =
                newValue === undefined ||
                newValue === null ||
                newValue === '' ||
                (Array.isArray(newValue) && newValue.length === 0);

            setSearchParams((prevParams) => {
                const newParams = new URLSearchParams(prevParams);

                if (isEmpty) {
                    newParams.delete(key);
                } else {
                    newParams.set(key, newValue.toString());
                }

                return newParams;
            });
        },
        [key, state, setSearchParams],
    );

    return [state[key], setFilterState];
};
