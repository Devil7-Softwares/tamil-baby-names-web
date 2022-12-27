import './AutoLetters.scss';
import React, { useEffect, useState } from 'react';
import Timezones from '../../assets/timezones.json';
import dayjs from 'dayjs';
import {
    getLunarMansion,
    getLunarMansionIndex,
    getMoonSign,
    getMoonSignIndex,
    getStartingLettersForName,
} from '../../utils';

interface IProps {
    setStartsWith: (letters: string[]) => void;
}

function getDefaultTimezone(): string {
    const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (currentTimezone) {
        const matchingTimezone = Timezones.find((timezone) =>
            timezone.utc.includes(currentTimezone)
        );

        if (matchingTimezone) {
            return matchingTimezone.utc[0];
        }
    }
    return '';
}

type T = Parameters<typeof getLunarMansion>[1];

export const AutoLetters: React.FC<IProps> = ({ setStartsWith }) => {
    const [dateTimeOfBirth, setDateTimeOfBirth] = useState(
        dayjs().format('YYYY-MM-DDTHH:mm')
    );
    const [timezone, setTimezone] = useState(getDefaultTimezone());

    const [moonSignIndex, setMoonSignIndex] = useState(0);
    const [lunarMansionIndex, setLunarMansionIndex] = useState(0);

    const [letters, setLetters] = useState<Record<T, string[]>>({
        en: [],
        ta: [],
    });

    useEffect(() => {
        const date = dayjs(dateTimeOfBirth, timezone).toDate();

        if (date.toString() !== 'Invalid Date') {
            setMoonSignIndex(getMoonSignIndex(date));
            setLunarMansionIndex(getLunarMansionIndex(date));
        }
    }, [dateTimeOfBirth, timezone]);

    useEffect(() => {
        const en = getStartingLettersForName(lunarMansionIndex, 'en');
        const ta = getStartingLettersForName(lunarMansionIndex, 'ta');

        setLetters({
            en,
            ta,
        });

        if (ta.length > 0 || en.length > 0) {
            setStartsWith([...en, ...ta]);
        }
    }, [lunarMansionIndex]);

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
                    {getMoonSign(moonSignIndex, 'ta')} /{' '}
                    {getMoonSign(moonSignIndex, 'en')}
                </div>
                <label>நட்சத்திரம் / Lunar Mansion</label>
                <div>
                    {getLunarMansion(lunarMansionIndex, 'ta')} /{' '}
                    {getLunarMansion(lunarMansionIndex, 'en')}
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
