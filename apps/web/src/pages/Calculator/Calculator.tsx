import './Calculator.scss';

import {
    getNameNumber,
    implementedNumerologies,
    Numerology,
    numerologyLocales,
    romanise,
    tamilise,
} from '@tbn/shared';
import React, { useMemo, useState } from 'react';

import { Card } from '../../components';

/**
 * Each method reads one script and refuses the other: Enkanitham is Tamil,
 * Chaldean and Pythagorean are Latin. One spelling therefore only ever gets you
 * one of the three numbers, which is why both boxes are here rather than a
 * single one with a language switch.
 */
const SCRIPT_OF: Record<Numerology, 'ta' | 'en'> = {
    enkanitham: 'ta',
    chaldean: 'en',
    pythagorean: 'en',
};

export const Calculator: React.FC = () => {
    const [tamil, setTamil] = useState('');
    const [latin, setLatin] = useState('');

    const results = useMemo(
        () =>
            implementedNumerologies.map((method) => ({
                method,
                script: SCRIPT_OF[method],
                value: getNameNumber(
                    SCRIPT_OF[method] === 'ta' ? tamil : latin,
                    method,
                ),
            })),
        [tamil, latin],
    );

    // Into the box rather than into the score: Chaldean would otherwise be
    // reading a guess at the spelling instead of the name.
    const suggest = (into: 'ta' | 'en') => () => {
        if (into === 'ta') {
            setTamil(tamilise(latin));
        } else {
            setLatin(romanise(tamil));
        }

        gtag('event', 'calculator', { suggested: into });
    };

    return (
        <Card className='calculator'>
            <h2>எண்கணிதம் / Numerology Calculator</h2>

            <p className='lead'>
                A name in Tamil is read by Enkanitham; one in English letters by
                Chaldean and Pythagorean. Fill in both to see all three.
            </p>

            <div className='container'>
                <label htmlFor='tamil'>தமிழ் / Tamil</label>
                <div className='entry'>
                    <input
                        id='tamil'
                        value={tamil}
                        placeholder='அமுதன்'
                        autoComplete='off'
                        onChange={(e) => setTamil(e.target.value)}
                    />
                    <button
                        type='button'
                        disabled={!latin.trim()}
                        title='Suggest a Tamil spelling from the English'
                        onClick={suggest('ta')}
                    >
                        ← from English
                    </button>
                </div>

                <label htmlFor='latin'>ஆங்கிலம் / English</label>
                <div className='entry'>
                    <input
                        id='latin'
                        value={latin}
                        placeholder='Amudhan'
                        autoComplete='off'
                        onChange={(e) => setLatin(e.target.value)}
                    />
                    <button
                        type='button'
                        disabled={!tamil.trim()}
                        title='Suggest an English spelling from the Tamil'
                        onClick={suggest('en')}
                    >
                        ← from Tamil
                    </button>
                </div>
            </div>

            <div className='results'>
                {results.map(({ method, script, value }) => (
                    <div
                        key={method}
                        className={value ? 'result' : 'result empty'}
                    >
                        <div className='name'>
                            {numerologyLocales.ta.numerologies[method]}
                            <span className='en'>
                                {numerologyLocales.en.numerologies[method]}
                            </span>
                        </div>

                        <div className='number'>
                            {value ? value.number : '—'}
                        </div>

                        <div className='total'>
                            {value
                                ? `total ${value.total}`
                                : `needs the ${
                                      script === 'ta' ? 'Tamil' : 'English'
                                  } spelling`}
                        </div>
                    </div>
                ))}
            </div>

            <p className='caveat'>
                A filled-in spelling is a guess, not a fact — Tamil tells ண, ந
                and ன apart where English writes one <i>n</i>. Check it before
                you trust the number beside it.
            </p>
        </Card>
    );
};
