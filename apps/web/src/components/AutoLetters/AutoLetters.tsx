import './AutoLetters.scss';

import {
    getBirthDate,
    getLunarMansion,
    getLunarMansionIndex,
    getMoonSign,
    getMoonSignIndex,
    getPadhamIndex,
    getPadhamLettersForName,
    getStartingLettersForName,
    implementedPanjangams,
    locales,
    timezones,
} from '@tbn/shared';
import React, { useEffect, useMemo } from 'react';

import { useDraft, useFilterState } from '../../utils';
import { Button } from '../Button';
import { Combobox } from '../Combobox';

const timezoneOptions = Object.values(
    timezones.reduce<Record<string, (typeof timezones)[number]>>(
        (acc, timezone) => {
            const zone = timezone.utc[0];

            if (!zone) {
                return acc;
            }

            const existing = acc[zone];

            if (!existing || /daylight/i.test(existing.text)) {
                acc[zone] = timezone;
            }

            return acc;
        },
        {},
    ),
);

const zoneChoices = timezoneOptions.map((option) => ({
    value: option.utc[0],
    label: option.text,
}));

type T = Parameters<typeof getLunarMansion>[1];

export const AutoLetters: React.FC = () => {
    const [tob, setTob] = useFilterState('tob');
    const [timezone, setTimezone] = useFilterState('tz');
    const [panjangam, setPanjangam] = useFilterState('panjangam');

    const [dateTimeOfBirth, setDateTimeOfBirth] = useDraft(tob, setTob);

    const astro = useMemo(() => {
        const date = getBirthDate(dateTimeOfBirth, timezone);

        if (!date) {
            return null;
        }

        const moonSignIndex = getMoonSignIndex(date, panjangam);
        const lunarMansionIndex = getLunarMansionIndex(date, panjangam);
        const padhamIndex = getPadhamIndex(date, panjangam);

        return {
            padham: padhamIndex + 1,
            padhamLetters: {
                en: getPadhamLettersForName(lunarMansionIndex, 'en'),
                ta: getPadhamLettersForName(lunarMansionIndex, 'ta'),
            },
            moonSign: {
                en: getMoonSign(moonSignIndex, 'en'),
                ta: getMoonSign(moonSignIndex, 'ta'),
            },
            lunarMansion: {
                en: getLunarMansion(lunarMansionIndex, 'en'),
                ta: getLunarMansion(lunarMansionIndex, 'ta'),
            },
            letters: {
                en: getStartingLettersForName(lunarMansionIndex, 'en'),
                ta: getStartingLettersForName(lunarMansionIndex, 'ta'),
            } as Record<T, string[]>,
        };
    }, [dateTimeOfBirth, timezone, panjangam]);

    useEffect(() => {
        if (!astro) {
            return;
        }

        gtag('event', 'astro', {
            moonSign: astro.moonSign.en,
            lunarMansion: astro.lunarMansion.en,
            padham: astro.padham,
        });
    }, [astro]);

    return (
        <div className='auto-letters'>
            <div className='container input'>
                <label>Date &amp; Time of Birth</label>
                <input
                    type='datetime-local'
                    value={dateTimeOfBirth}
                    onChange={(e) => setDateTimeOfBirth(e.target.value)}
                />

                <label htmlFor='timezone'>Timezone</label>
                <Combobox
                    id='timezone'
                    value={timezone}
                    options={zoneChoices}
                    placeholder='Type a city or an offset'
                    onChange={setTimezone}
                />

                {implementedPanjangams.length > 1 && (
                    <>
                        <label>பஞ்சாங்கம் / Panjangam</label>
                        <div className='choices'>
                            {implementedPanjangams.map((method) => (
                                <Button
                                    key={method}
                                    checked={panjangam === method}
                                    title={locales.en.panjangams[method]}
                                    onCheckedChange={() => setPanjangam(method)}
                                >
                                    {locales.ta.panjangams[method]}
                                </Button>
                            ))}
                        </div>
                    </>
                )}
            </div>
            <div className='container output'>
                <label>ராசி / Moon Sign</label>
                <div>
                    {astro?.moonSign.ta} / {astro?.moonSign.en}
                </div>
                <label>நட்சத்திரம் / Lunar Mansion</label>
                <div>
                    {astro?.lunarMansion.ta} / {astro?.lunarMansion.en}
                </div>
                <label>பாதம் / Padham</label>
                <div>{astro && `${astro.padham} / 4`}</div>
                <label>பெயர் எழுத்து / Letters for Name</label>
                {/* All four, with the birth's own marked. A quarter shown on
                    its own does not say that the mansion offered four and the
                    padham chose between them. */}
                <ol className='padhams'>
                    {astro?.padhamLetters.ta.map((letter, at) => (
                        <li
                            key={at}
                            className={
                                at === astro.padham - 1 ? 'this-one' : undefined
                            }
                            aria-current={
                                at === astro.padham - 1 ? 'true' : undefined
                            }
                        >
                            <span className='at'>{at + 1}</span>
                            <span className='letter'>{letter}</span>
                            <span className='letter'>
                                {astro.padhamLetters.en[at]}
                            </span>
                        </li>
                    ))}
                </ol>
                {astro && (
                    <>
                        <label>பிற வழக்குகள் / Also Used</label>
                        <div className='variants'>
                            <div>{astro.letters.ta.join(', ')}</div>
                            <div>{astro.letters.en.join(', ')}</div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
