import { IFilterData } from '@tbn/shared';
import {
    createContext,
    Dispatch,
    SetStateAction,
    useCallback,
    useContext,
} from 'react';
import { useNavigate } from 'react-router-dom';

import { getStateFromParams } from '../Common';

export const FilterStateContext = createContext<IFilterData>({} as IFilterData);

export const useFilterState = <K extends keyof IFilterData>(
    key: K,
): [IFilterData[K], Dispatch<SetStateAction<IFilterData[K]>>] => {
    const navigate = useNavigate();

    const state = useContext(FilterStateContext);

    const setFilterState = useCallback(
        (
            value:
                | IFilterData[K]
                | ((prevState: IFilterData[K]) => IFilterData[K]),
        ) => {
            const params = new URLSearchParams(window.location.search);

            const newValue =
                value instanceof Function
                    ? value(getStateFromParams(params)[key])
                    : value;

            const isEmpty =
                newValue === undefined ||
                newValue === null ||
                newValue === '' ||
                (Array.isArray(newValue) && newValue.length === 0);

            if (isEmpty) {
                params.delete(key);
            } else {
                params.set(key, newValue.toString());
            }

            navigate('?' + params.toString());
        },
        [key, navigate],
    );

    return [state[key], setFilterState];
};
