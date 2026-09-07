import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A field the URL owns, held locally while it is being typed into.
 *
 * Every change writes the filters to the query string and navigates, and the
 * re-render that follows carries a value that arrives a tick late. React writes
 * that stale value back into the DOM, and a `datetime-local` loses the digit it
 * was holding half way through a segment: typing 29 into the day gives 09,
 * because the 2 is thrown away before the 9 lands.
 *
 * So the field reads from here, which updates in the same tick, and the URL is
 * written as well rather than instead. A value that changes anywhere else — a
 * shared link, the back button, another control — is still adopted; the only
 * one ignored is this field's own, coming back around.
 */
export const useDraft = <T>(
    value: T,
    commit: (next: T) => void,
): [T, (next: T) => void] => {
    const [draft, setDraft] = useState(value);
    const own = useRef(value);

    useEffect(() => {
        if (value !== own.current) {
            own.current = value;
            setDraft(value);
        }
    }, [value]);

    const set = useCallback(
        (next: T) => {
            own.current = next;
            setDraft(next);
            commit(next);
        },
        [commit],
    );

    return [draft, set];
};
