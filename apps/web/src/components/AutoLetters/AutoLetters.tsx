import './AutoLetters.scss';

import {
    getLunarMansion,
    getLunarMansionIndex,
    getMoonSign,
    getMoonSignIndex,
    getStartingLettersForName,
    implementedPanjangams,
    locales,
    Panjangam,
    timezones,
} from '@tbn/shared';
import React, { useEffect, useMemo } from 'react';

import { useFilterState } from '../../utils';
import { getBirthDate } from '../../utils/Common';

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

type T = Parameters<typeof getLunarMansion>[1];

export const AutoLetters: React.FC = () => {
    const [dateTimeOfBirth, setDateTimeOfBirth] = useFilterState('tob');
    const [timezone, setTimezone] = useFilterState('tz');
    const [panjangam, setPanjangam] = useFilterState('panjangam');

    const astro = useMemo(() => {
        const date = getBirthDate(dateTimeOfBirth, timezone);

        if (!date) {
            return null;
        }

        const moonSignIndex = getMoonSignIndex(date, panjangam);
        const lunarMansionIndex = getLunarMansionIndex(date, panjangam);

        return {
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

                <label>Timezone</label>
                <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                >
                    {timezoneOptions.map((timezone) => (
                        <option key={timezone.utc[0]} value={timezone.utc[0]}>
                            {timezone.text}
                        </option>
                    ))}
                </select>

                {implementedPanjangams.length > 1 && (
                    <>
                        <label>பஞ்சாங்கம் / Panjangam</label>
                        <select
                            value={panjangam}
                            onChange={(e) =>
                                setPanjangam(e.target.value as Panjangam)
                            }
                        >
                            {implementedPanjangams.map((method) => (
                                <option key={method} value={method}>
                                    {locales.ta.panjangams[method]} /{' '}
                                    {locales.en.panjangams[method]}
                                </option>
                            ))}
                        </select>
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
                <label>பெயர் எழுத்து / Letters for Name</label>
                <div>
                    <div>{astro?.letters.ta.join(', ')}</div>
                    <div>{astro?.letters.en.join(', ')}</div>
                </div>
            </div>
        </div>
    );
};
