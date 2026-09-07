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
/**
 * The convention ITRANS uses, and the only way to reach the letters English
 * does not distinguish — without it அருண் and கட்டி cannot be typed at all.
 */
const THANGLISH: Array<[string, string, string]> = [
    ['e எ', 'E ஏ', 'dinEsh → தினேஷ்'],
    ['o ஒ', 'O ஓ', 'mOkan → மோகன்'],
    ['a அ', 'A ஆ', 'kumAr → குமார்'],
    ['n ன', 'N ண', 'aruN → அருண்'],
    ['l ல', 'L ள', 'vaLLi → வள்ளி'],
    ['r ர', 'R ற', 'maRam → மறம்'],
    ['t த', 'T ட', 'kaTTi → கட்டி'],
    ['s ச', 'sh ஷ', 'shiva → ஷிவா'],
    ['—', 'zh ழ', 'tamizh → தமிழ்'],
];

const SCRIPT_OF: Record<Numerology, 'ta' | 'en'> = {
    enkanitham: 'ta',
    chaldean: 'en',
    pythagorean: 'en',
};

export const Calculator: React.FC = () => {
    // What was typed, which is not what is shown: Thanglish goes in and Tamil
    // comes out, and the keystrokes have to be kept to read `aa` or `nE` as one
    // thing. Tamil typed on a Tamil keyboard passes through tamilise unchanged,
    // so the same box takes both without a mode to switch.
    const [typed, setTyped] = useState('');
    const [latin, setLatin] = useState('');

    const tamil = useMemo(() => tamilise(typed), [typed]);

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

    const type = (event: React.KeyboardEvent<HTMLInputElement>): void => {
        // Shortcuts are the browser's.
        if (event.ctrlKey || event.metaKey || event.altKey) {
            return;
        }

        if (event.key === 'Backspace') {
            event.preventDefault();
            setTyped((was) => was.slice(0, -1));
        } else if (event.key.length === 1) {
            // One keystroke is one character of what was typed, never of what
            // is shown: `nE` is one ன‌ே and deleting it must take the E, not
            // the vowel sign it grew into.
            event.preventDefault();
            setTyped((was) => was + event.key);
        }
    };

    // Chaldean reads the English box, so it must hold the name as it is spelt
    // and never a guess: only this direction is offered.
    const suggestLatin = (): void => {
        setLatin(romanise(tamil));
        gtag('event', 'calculator', { suggested: 'en' });
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
                        placeholder='அமுதன் — or type amudhan'
                        autoComplete='off'
                        spellCheck={false}
                        onKeyDown={type}
                        onPaste={(e) => {
                            e.preventDefault();
                            setTyped(
                                (was) => was + e.clipboardData.getData('text'),
                            );
                        }}
                        // Whatever the keystrokes did not catch — a phone
                        // keyboard reporting no key, autocorrect, a drag.
                        // Tamil survives tamilise unchanged, so taking the
                        // field's own value as what was typed settles rather
                        // than drifting.
                        onChange={(e) => setTyped(e.target.value)}
                    />
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
                        onClick={suggestLatin}
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

            <details className='thanglish'>
                <summary>
                    No Tamil keyboard? Type the name in English letters and it
                    becomes Tamil as you go.
                </summary>

                <p>
                    Where Tamil has two letters and English one, the capital is
                    the second — so <code>Dineshkumar</code> gives தினெஷ் and{' '}
                    <code>DinEshkumAr</code> தினேஷ்குமார். A capital starting
                    the name is only a capital. An <code>s</code> with no vowel
                    after it is ஸ, so <code>sree</code> is ஸ்ரீ.
                </p>

                <ul>
                    {THANGLISH.map(([small, big, example]) => (
                        <li key={big}>
                            <code>{small}</code>
                            <code>{big}</code>
                            <span>{example}</span>
                        </li>
                    ))}
                </ul>
            </details>

            <p className='caveat'>
                A filled-in spelling is a guess, not a fact — Tamil tells ண, ந
                and ன apart where English writes one <i>n</i>. Check it before
                you trust the number beside it.
            </p>
        </Card>
    );
};
