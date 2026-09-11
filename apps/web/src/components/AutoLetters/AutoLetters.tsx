import './AutoLetters.scss';

import {
    getBirthDate,
    getFollowOnLettersForName,
    getLunarMansion,
    getLunarMansionIndex,
    getMoonSign,
    getMoonSignIndex,
    getPadhamIndex,
    getPadhamLettersForName,
    getRelatedLetters,
    getStartingLettersForName,
    implementedPanjangams,
    locales,
    timezones,
} from '@tbn/shared';
import React, { useEffect, useMemo } from 'react';

import { useDraft, useFilterState } from '../../utils';
import { Button } from '../Button';
import { Combobox } from '../Combobox';
import { Help, PANJANGAM_HELP } from '../Help';

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
    const [followOnLetters, setFollowOnLetters] =
        useFilterState('followOnLetters');
    const [relatedLetters, setRelatedLetters] =
        useFilterState('relatedLetters');

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
            followOn: getFollowOnLettersForName(lunarMansionIndex),
        };
    }, [dateTimeOfBirth, timezone, panjangam]);

    // Partners of whatever the search holds, so turning the follow-on letters
    // on brings their partners into this row as well.
    const related = useMemo(
        () =>
            astro
                ? getRelatedLetters([
                      ...astro.letters.ta,
                      ...(followOnLetters ? astro.followOn : []),
                  ])
                : [],
        [astro, followOnLetters],
    );

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
                <label>
                    பிறந்த நாள் &amp; நேரம் / Date &amp; Time of Birth
                </label>
                <input
                    type='datetime-local'
                    value={dateTimeOfBirth}
                    onChange={(e) => setDateTimeOfBirth(e.target.value)}
                />

                <label htmlFor='timezone'>நேர மண்டலம் / Timezone</label>
                <Combobox
                    id='timezone'
                    value={timezone}
                    options={zoneChoices}
                    placeholder='Type a city or an offset'
                    onChange={setTimezone}
                />

                {implementedPanjangams.length > 1 && (
                    <>
                        <label className='with-help'>
                            பஞ்சாங்கம் / Panjangam
                            <Help {...PANJANGAM_HELP} />
                        </label>
                        <div className='choices'>
                            {implementedPanjangams.map((method) => (
                                <Button
                                    key={method}
                                    checked={panjangam === method}
                                    ta={locales.ta.panjangams[method]}
                                    onCheckedChange={() => setPanjangam(method)}
                                >
                                    {locales.en.panjangams[method]}
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
                {astro && astro.followOn.length > 0 && (
                    <>
                        <label>தொடர் எழுத்துக்கள் / Follow-on Letters</label>
                        <div>{astro.followOn.join(', ')}</div>

                        {/* A fallback, as every source uses them: the search
                            stays on the mansion's own letters unless asked. */}
                        <label>தேடலில் / In Search</label>
                        <div className='choices'>
                            <Button
                                checked={!followOnLetters}
                                ta='முதன்மை மட்டும்'
                                onCheckedChange={() =>
                                    setFollowOnLetters(false)
                                }
                            >
                                Main Only
                            </Button>
                            <Button
                                checked={followOnLetters}
                                ta='தொடர் எழுத்தும் சேர்த்து'
                                onCheckedChange={() => setFollowOnLetters(true)}
                            >
                                Include Follow-on
                            </Button>
                        </div>
                    </>
                )}
                {related.length > 0 && (
                    <>
                        <label>இணை எழுத்துக்கள் / Related Letters</label>
                        <div>{related.join(', ')}</div>

                        <label>தேடலில் / In Search</label>
                        <div className='choices'>
                            <Button
                                checked={!relatedLetters}
                                ta='காட்டியவை மட்டும்'
                                onCheckedChange={() => setRelatedLetters(false)}
                            >
                                As Shown
                            </Button>
                            <Button
                                checked={relatedLetters}
                                ta='இணையும் சேர்த்து'
                                onCheckedChange={() => setRelatedLetters(true)}
                            >
                                Include Related
                            </Button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
