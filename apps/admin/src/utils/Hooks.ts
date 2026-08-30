import { useCallback, useEffect, useState } from 'react';

/**
 * useState backed by localStorage. Reads and writes are guarded because a
 * browser with site data blocked throws on access rather than returning null.
 */
export const usePersistedState = <T extends string>(
    key: string,
    fallback: T,
): [T, (value: T) => void] => {
    const [value, setValue] = useState<T>(() => {
        try {
            return (localStorage.getItem(key) as T | null) ?? fallback;
        } catch {
            return fallback;
        }
    });

    const persist = useCallback(
        (next: T) => {
            setValue(next);

            try {
                localStorage.setItem(key, next);
            } catch {
                // A non-persisted preference is better than a crash.
            }
        },
        [key],
    );

    return [value, persist];
};

/**
 * Trails `value` by `delay`, so typing in a filter does not put a request on
 * the wire for every keystroke.
 */
export const useDebounced = <T>(value: T, delay = 300): T => {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);

        return () => clearTimeout(timer);
    }, [value, delay]);

    return debounced;
};
