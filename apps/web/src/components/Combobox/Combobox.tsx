import './Combobox.scss';

import clsx from 'clsx';
import React, { useMemo, useRef, useState } from 'react';

export interface ComboboxOption {
    value: string;
    label: string;
}

interface IProps {
    id?: string;
    value: string;
    options: ComboboxOption[];
    placeholder?: string;
    onChange: (value: string) => void;
}

/**
 * A list too long to scroll, filtered by typing.
 *
 * The list is rendered here rather than left to `datalist`, which iOS has
 * never made work: it draws the popup away from the field it belongs to and
 * reads labels differently from every other browser, so a phone was left with
 * a plain text box and 102 zones it could not see.
 */
export const Combobox: React.FC<IProps> = ({
    id,
    value,
    options,
    placeholder,
    onChange,
}) => {
    const [search, setSearch] = useState<string | null>(null);
    const [at, setAt] = useState(0);
    const field = useRef<HTMLInputElement>(null);

    const selected = options.find((option) => option.value === value);

    const shown = useMemo(() => {
        if (search === null) {
            return options;
        }

        const term = search.trim().toLowerCase();

        return term
            ? options.filter((option) =>
                  option.label.toLowerCase().includes(term),
              )
            : options;
    }, [options, search]);

    const open = search !== null;

    const choose = (option: ComboboxOption): void => {
        onChange(option.value);
        setSearch(null);
        field.current?.blur();
    };

    const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
        if (event.key === 'Escape') {
            setSearch(null);

            return;
        }

        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();

            if (!open) {
                setSearch('');
                setAt(0);

                return;
            }

            const step = event.key === 'ArrowDown' ? 1 : -1;

            setAt((was) => {
                const next = was + step;

                return next < 0 ? shown.length - 1 : next % shown.length;
            });

            return;
        }

        if (event.key === 'Enter' && open && shown[at]) {
            event.preventDefault();
            choose(shown[at]);
        }
    };

    return (
        <div className={clsx('combobox', open && 'open')}>
            <input
                id={id}
                ref={field}
                type='text'
                role='combobox'
                aria-expanded={open}
                aria-autocomplete='list'
                autoComplete='off'
                placeholder={placeholder}
                value={search ?? selected?.label ?? ''}
                onChange={(e) => {
                    setSearch(e.target.value);
                    setAt(0);
                }}
                onFocus={(e) => {
                    setSearch('');
                    setAt(
                        Math.max(0, shown.indexOf(selected as ComboboxOption)),
                    );
                    e.target.select();
                }}
                // Leaving a half-written search behind would read as a choice
                // that had been made.
                onBlur={() => setSearch(null)}
                onKeyDown={onKeyDown}
            />

            {open && (
                <ul
                    role='listbox'
                    // The press has to reach the option rather than blurring
                    // the field out from under it and closing the list first.
                    onMouseDown={(e) => e.preventDefault()}
                >
                    {shown.map((option, index) => (
                        <li
                            key={option.value}
                            role='option'
                            aria-selected={option.value === value}
                            className={clsx(index === at && 'at')}
                            onMouseEnter={() => setAt(index)}
                            onClick={() => choose(option)}
                        >
                            {option.label}
                        </li>
                    ))}

                    {!shown.length && <li className='none'>No match</li>}
                </ul>
            )}
        </div>
    );
};
