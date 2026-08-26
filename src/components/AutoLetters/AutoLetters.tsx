import './AutoLetters.scss';

import dayjs from 'dayjs';
import React, { useEffect, useMemo } from 'react';

import Timezones from '../../assets/timezones.json';
import {
    getLunarMansion,
    getLunarMansionIndex,
    getMoonSign,
    getMoonSignIndex,
    getStartingLettersForName,
    useFilterState,
} from '../../utils';

type T = Parameters<typeof getLunarMansion>[1];

export const AutoLetters: React.FC = () => {
    const [dateTimeOfBirth, setDateTimeOfBirth] = useFilterState('tob');
    const [timezone, setTimezone] = useFilterState('tz');

    const astro = useMemo(() => {
        const date = dayjs(dateTimeOfBirth, timezone).toDate();

        if (date.toString() === 'Invalid Date') {
            return null;
        }

        const moonSignIndex = getMoonSignIndex(date);
        const lunarMansionIndex = getLunarMansionIndex(date);

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
    }, [dateTimeOfBirth, timezone]);

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
                    {Timezones.map((timezone) => (
                        <option key={timezone.value} value={timezone.utc[0]}>
                            {timezone.text}
                        </option>
                    ))}
                </select>
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
