import './AutoLetters.scss';

import dayjs from 'dayjs';
import React, { useEffect, useState } from 'react';

import Timezones from '../../assets/timezones.json';
import {
    getDefaultTimezone,
    getLunarMansion,
    getLunarMansionIndex,
    getMoonSign,
    getMoonSignIndex,
    getStartingLettersForName,
    useFilterState,
} from '../../utils';

interface IProps {
    setStartsWith: (letters: string[]) => void;
}

type T = Parameters<typeof getLunarMansion>[1];

export const AutoLetters: React.FC<IProps> = ({ setStartsWith }) => {
    const [dateTimeOfBirth, setDateTimeOfBirth] = useFilterState(
        'tob',
        dayjs().format('YYYY-MM-DDTHH:mm')
    );
    const [timezone, setTimezone] = useFilterState('tz', getDefaultTimezone());

    const [moonSign, setMoonSign] = useState({ en: '', ta: '' });
    const [lunarMansion, setLunarMansion] = useState({ en: '', ta: '' });
    const [letters, setLetters] = useState<Record<T, string[]>>({
        en: [],
        ta: [],
    });

    useEffect(() => {
        const date = dayjs(dateTimeOfBirth, timezone).toDate();

        if (date.toString() !== 'Invalid Date') {
            const moonSignIndex = getMoonSignIndex(date);
            const lunarMansionIndex = getLunarMansionIndex(date);

            const enMoonSign = getMoonSign(moonSignIndex, 'en');
            const taMoonSign = getMoonSign(moonSignIndex, 'ta');
            setMoonSign({
                en: enMoonSign,
                ta: taMoonSign,
            });

            const enLunarMansion = getLunarMansion(lunarMansionIndex, 'en');
            const taLunarMansion = getLunarMansion(lunarMansionIndex, 'ta');
            setLunarMansion({
                en: enLunarMansion,
                ta: taLunarMansion,
            });

            const enLetters = getStartingLettersForName(
                lunarMansionIndex,
                'en'
            );
            const taLetters = getStartingLettersForName(
                lunarMansionIndex,
                'ta'
            );

            setLetters({
                en: enLetters,
                ta: taLetters,
            });

            if (taLetters.length > 0 || enLetters.length > 0) {
                setStartsWith([...enLetters, ...taLetters]);
            }

            gtag('event', 'astro', {
                moonSign: moonSign.en,
                lunarMansion: lunarMansion.en,
            });
        }
    }, [dateTimeOfBirth, timezone]);

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
                    {moonSign.ta} / {moonSign.en}
                </div>
                <label>நட்சத்திரம் / Lunar Mansion</label>
                <div>
                    {lunarMansion.ta} / {lunarMansion.en}
                </div>
                <label>பெயர் எழுத்து / Letters for Name</label>
                <div>
                    <div>{letters.ta.join(', ')}</div>
                    <div>{letters.en.join(', ')}</div>
                </div>
            </div>
        </div>
    );
};
