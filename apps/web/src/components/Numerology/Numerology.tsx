import './Numerology.scss';

import {
    getBirthNumberFor,
    implementedNumerologies,
    NAME_NUMBERS,
    numerologyLocales,
} from '@tbn/shared';
import React, { useEffect } from 'react';

import { useFilterState } from '../../utils';
import { Button } from '../Button';

export const Numerology: React.FC = () => {
    const [numerology, setNumerology] = useFilterState('numerology');
    const [nameNumbers, setNameNumbers] = useFilterState('nameNumbers');
    const [startsWithMode] = useFilterState('startsWithMode');
    const [tob] = useFilterState('tob');
    const [tz] = useFilterState('tz');

    const selected = nameNumbers || [];

    // Only auto mode asks for a date of birth, so this is the one place the
    // birth number can honestly be shown.
    const birthNumber = getBirthNumberFor(startsWithMode, tob, tz);

    useEffect(() => {
        if (birthNumber !== null) {
            gtag('event', 'numerology', { birthNumber });
        }
    }, [birthNumber]);

    const toggle = (value: number, checked: boolean) => {
        const next = checked
            ? [...selected, value].sort((a, b) => a - b)
            : selected.filter((item) => item !== value);

        gtag('event', 'filters', { filter: 'Name Number', value: next });

        setNameNumbers(next.length ? next : undefined);
    };

    return (
        <div className='numerology'>
            {(implementedNumerologies.length > 1 || birthNumber !== null) && (
                <div className='container'>
                    {implementedNumerologies.length > 1 && (
                        <>
                            <label>எண்கணிதம் / Numerology</label>
                            <div className='choices'>
                                {implementedNumerologies.map((method) => (
                                    <Button
                                        key={method}
                                        checked={numerology === method}
                                        ta={
                                            numerologyLocales.ta.numerologies[
                                                method
                                            ]
                                        }
                                        onCheckedChange={() =>
                                            setNumerology(method)
                                        }
                                    >
                                        {
                                            numerologyLocales.en.numerologies[
                                                method
                                            ]
                                        }
                                    </Button>
                                ))}
                            </div>
                        </>
                    )}

                    {birthNumber !== null && (
                        <>
                            <label>பிறந்த எண் / Birth Number</label>
                            <div className='birth-number'>{birthNumber}</div>
                        </>
                    )}
                </div>
            )}

            <div className='numbers'>
                <Button
                    checked={!selected.length}
                    ta='அனைத்து எண்களும்'
                    onCheckedChange={() => setNameNumbers(undefined)}
                >
                    All
                </Button>
                {NAME_NUMBERS.map((value) => (
                    <Button
                        key={`name-number-${value}`}
                        checked={selected.includes(value)}
                        onCheckedChange={(_e, checked) =>
                            toggle(value, checked)
                        }
                    >
                        {value}
                    </Button>
                ))}
            </div>
        </div>
    );
};
