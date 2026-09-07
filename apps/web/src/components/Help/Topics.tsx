import React from 'react';

/**
 * Written from what is said about these rather than from the code - the 1935
 * endorsement, the seven-hour drift, which name each numerology wants. Only the
 * 248 vakyas and the worked example come from what this site computes.
 */

export const PANJANGAM_HELP = {
    title: { ta: 'பஞ்சாங்கம்', en: 'Panjangam' },

    ta: (
        <>
            <p>
                தமிழ் பாரம்பரியத்தில் கோள்களின் நிலைகளைக் கணக்கிட இரண்டு
                வெவ்வேறு பஞ்சாங்க முறைகள் பயன்படுத்தப்படுகின்றன - இவை இரண்டும்
                எப்போதும் ஒரே முடிவைத் தருவதில்லை.
            </p>

            <dl>
                <dt>
                    <strong>வாக்கிய பஞ்சாங்கம்</strong>
                </dt>
                <dd>
                    பாரம்பரியமான, சூத்திரங்களை அடிப்படையாகக் கொண்ட முறை. தலைமுறை
                    தலைமுறையாக மனப்பாடம் செய்து கடத்தப்பட்ட 248 பழமையான
                    வாக்கியங்களைக் கொண்டு இது கணக்கிடப்படுகிறது. காலத்திற்கு
                    ஏற்ப வானியல் மாற்றங்களை இதில் புதுப்பிக்காததால், உண்மையான
                    கோள்களின் நிலைகளிலிருந்து இதன் கணக்கீடு சற்று
                    விலகியிருக்கிறது. இருப்பினும், வழிபாட்டு மரபைப் பேணுவதற்காக
                    பெரும்பாலான தமிழ்நாட்டுத் திருக்கோயில்களும் (
                    <em>பாம்பு பஞ்சாங்கம்</em> உட்பட) இம்முறையையே
                    பின்பற்றுகின்றன.
                </dd>

                <dt>
                    <strong>திருக்கணித பஞ்சாங்கம்</strong>
                </dt>
                <dd>
                    நவீன, வானியல் அவதானிப்புகளை அடிப்படையாகக் கொண்ட முறை.
                    சந்திரனும் பிற கோள்களும் குறிப்பிட்ட கணத்தில் உண்மையில் எந்த
                    இடத்தில் இருக்கின்றன என்பதைத் துல்லியமாகக் கணக்கிடுகிறது.
                    1935-இல் காஞ்சி மடத்தின் ஒப்புதலைப் பெற்ற இம்முறை,
                    இந்தியாவின் அதிகாரப்பூர்வ தேசிய பஞ்சாங்கத்திற்கும்
                    அடிப்படையாக உள்ளது.
                </dd>
            </dl>

            <p>
                சந்திரனின் இயக்கத்தைக் கணக்கிடும் முறையில் உள்ள வேறுபாட்டால்,
                வாக்கிய பஞ்சாங்கத்திற்கும் திருக்கணித பஞ்சாங்கத்திற்கும் இடையே
                சில மணி நேரங்கள் வரை நேர வித்தியாசம் ஏற்படக்கூடும். இந்த
                வேறுபாடு அமாவாசை மற்றும் பௌர்ணமி நாட்களில் குறைவாகவும்,
                இடைப்பட்ட நாட்களில் அதிகமாகவும் இருக்கும்.
            </p>

            <p>
                ஒரு நட்சத்திரம் முடிந்து அடுத்த நட்சத்திரம் தொடங்கும் எல்லை
                நேரங்களில் குழந்தை பிறக்கும்போது மட்டுமே இந்த நேர வேறுபாடு
                முக்கியத்துவம் பெறுகிறது. அப்போது இரண்டு பஞ்சாங்கங்களும்
                வெவ்வேறு ஜென்ம நட்சத்திரங்களைக் காட்டக்கூடும் - இதனால்
                குழந்தைக்குப் பெயர் வைப்பதற்கான எழுத்துக்களும், ஜாதகக்
                கணிப்புகளும் மாற வாய்ப்புள்ளது.
            </p>

            <p className='pick'>
                <strong>எதைத்தேர்ந்தெடுப்பது?</strong> உங்கள் குடும்பத்திலோ
                அல்லது குடும்பக் கோயிலிலோ பரம்பரையாக எந்த பஞ்சாங்கம்
                பின்பற்றப்படுகிறதோ அதையே தொடரலாம். அப்படி எந்த வழக்கமும் இல்லாத
                பட்சத்தில், துல்லியமான வானியல் கணக்கீட்டைக் கொண்டிருக்கும்{' '}
                <strong>திருக்கணித பஞ்சாங்கத்தைத்</strong> தேர்ந்தெடுக்கலாம்.
            </p>
        </>
    ),

    en: (
        <>
            <p>
                Tamil tradition relies on two distinct almanac systems (
                <em>Panchangams</em>) to calculate planetary positions-and they
                don't always agree.
            </p>

            <dl>
                <dt>
                    <strong>Vakkiyam</strong>
                </dt>
                <dd>
                    The traditional, formula-based system. It uses 248 ancient
                    astronomical verses memorized and passed down for centuries.
                    Because it relies on fixed historical formulas rather than
                    ongoing physical observation, its planetary calculations
                    have gradually drifted from actual positions over time.
                    Despite this, most traditional Tamil temples (and popular
                    calendars like the <em>Pambu Panchangam</em>) follow
                    Vakkiyam to maintain ritual continuity.
                </dd>

                <dt>
                    <strong>Thirukanitham</strong>
                </dt>
                <dd>
                    The modern, observation-based system. It calculates the
                    exact, real-time physical position of the Moon and planets
                    using precise mathematical astronomy. Formally endorsed by
                    the Kanchi Matha in 1935, Thirukanitham forms the basis of
                    India's official national calendar (Rashtriya Panchang) and
                    is widely used by astrologers today.
                </dd>
            </dl>

            <p>
                Because of how the two systems calculate planetary speeds, time
                readings between Vakkiyam and Thirukanitham can differ by
                several hours. The discrepancy is smallest around a New Moon or
                Full Moon and widest during the quarters in between.
            </p>

            <p>
                This time gap mainly affects individuals born near a boundary
                hour-when the Moon transitions from one star (<em>Nakshatra</em>
                ) to the next. Depending on which almanac you consult, your
                child could be assigned a different birth star, which changes
                the recommended initial letters for naming them, as well as
                their natal horoscope chart.
            </p>

            <p className='pick'>
                <strong>Which one should you pick?</strong> Follow whichever
                system your family priest or lineage traditionally uses. If your
                family does not have an established preference, choose{' '}
                <strong>Thirukanitham</strong> for its astronomical accuracy.
            </p>
        </>
    ),
};

export const NUMEROLOGY_HELP = {
    title: { ta: 'எண்கணிதம்', en: 'Numerology' },

    ta: (
        <>
            <p>
                ஒரு பெயரின் எண் கணித மதிப்பைத் தீர்மானிக்க மூன்று முக்கிய
                முறைகள் பயன்படுத்தப்படுகின்றன. இதில் முக்கியமாகப் புரிந்து கொள்ள
                வேண்டியது என்னவென்றால்,{' '}
                <strong>
                    இவை மூன்றுமே ஒரே பெயரை ஒரே விதமாகக் கணிப்பதில்லை.
                </strong>
            </p>

            <dl>
                <dt>
                    <strong>தமிழ் எண்கணிதம்</strong>
                </dt>
                <dd>
                    இது <strong>தமிழ் எழுத்து வடிவை</strong> அடிப்படையாகக்
                    கொண்டு, ஒவ்வொரு எழுத்தின் ஒலி அமைப்பையும் (உயிர், மெய்,
                    உயிர்மெய்) தனித்தனியாகப் பிரித்துத் தொகையைக் கணக்கிடுகிறது.
                    உதாரணத்திற்கு, <em>முத்துக்கமலம்</em> என்ற பெயர்
                    ம்+உ+த்+த்+உ+க்+க்+அ+ம்+அ+ல்+அ+ம் எனப் பிரிக்கப்பட்டு, அதன்
                    கூட்டுத்தொகை 53 ஆக வந்து, இறுதியில் 8 (5 + 3) என்ற எண்ணாகச்
                    சுருங்குகிறது.
                </dd>

                <dt>
                    <strong>கல்தீய முறை (Chaldean Numerology)</strong>
                </dt>
                <dd>
                    இது <strong>ஆங்கில எழுத்துக்கூட்டலை (Spelling)</strong>{' '}
                    அடிப்படையாகக் கொண்டு, ஒவ்வொரு எழுத்தின் ஒலி அதிர்வுக்கு ஏற்ப
                    எண்களை ஒதுக்குகிறது. பண்டைய பாபிலோனியாவில் தோன்றிய இம்முறை 1
                    முதல் 8 வரையிலான எண்களை மட்டுமே பயன்படுத்துகிறது; 9 என்ற எண்
                    புனிதமானதாகக் கருதப்படுவதால் அது எந்த எழுத்துக்கும்
                    வழங்கப்படுவதில்லை. இந்திய எண் கணித நிபுணர்களால் அதிகம்
                    பயன்படுத்தப்படும் இம்முறை, மக்கள் உங்களை அன்றாடம் அழைக்கும்
                    நடைமுறைப் பெயருக்குப் பொருந்தும்.
                </dd>

                <dt>
                    <strong>பித்தகோரஸ் முறை (Pythagorean Numerology)</strong>
                </dt>
                <dd>
                    இதுவும் <strong>ஆங்கில எழுத்துக்கூட்டலையே</strong>{' '}
                    பயன்படுத்துகிறது, ஆனால் A முதல் Z வரையிலான எழுத்துக்களுக்கு
                    வரிசையாக 1 முதல் 9 வரை எண்களை ஒதுக்குகிறது. கிரேக்கத்தில்
                    தோன்றிய இம்முறை மேலைநாடுகளில் பரவலாகப் பயன்படுத்தப்படுகிறது.
                    பிறப்புச் சான்றிதழ் மற்றும் அதிகாரப்பூர்வ ஆவணங்களில் உள்ள
                    முழுப் பெயரைக் கணக்கிட இம்முறை ஏற்றது.
                </dd>
            </dl>

            <p>
                நீங்கள் உங்கள் பெயரை எந்த மொழியில் எழுதுகிறீர்கள் என்பதே எந்த
                எண்கணித முறையைப் பயன்படுத்த வேண்டும் என்பதைத் தீர்மானிக்கிறது.
                பல நிபுணர்கள் ஒன்றுக்கும் மேற்பட்ட முறைகளில் கணக்கிட்டு, அவை
                ஒன்றுக்கொன்று ஒத்துப் போகிறதா என்றும் பார்ப்பதுண்டு.
            </p>

            <p className='pick'>
                <strong>எதைத் தேர்ந்தெடுக்க வேண்டும்?</strong> பெயர்
                முதன்மையாகத் தமிழில் எழுதப்படும் என்றால்{' '}
                <strong>தமிழ் எண்கணித முறையைப்</strong> பயன்படுத்தலாம்.
                ஆங்கிலத்தில் எழுதப்படும் பெயர்களுக்கு, இந்தியாவில் நடைமுறையில்
                இருக்கும் <strong>கல்தீய முறையே</strong> சிறந்த தேர்வாகும்.
            </p>
        </>
    ),

    en: (
        <>
            <p>
                There are three major systems used to calculate the numerical
                value of a name. The most important rule to understand is that{' '}
                <strong>
                    they do not evaluate a name using the same language or
                    rules.
                </strong>
            </p>

            <dl>
                <dt>
                    <strong>Tamil Numerology (Enkanitham)</strong>
                </dt>
                <dd>
                    Calculates values using the <strong>Tamil script</strong>,
                    breaking a name down sound-by-sound (phonemes) rather than
                    simple letter counts. For example, <em>முத்துக்கமலம்</em> is
                    decomposed into its individual phonetic components
                    (ம்+உ+த்+த்+உ+க்+க்+அ+ம்+அ+ல்+அ+ம்), totaling 53, which
                    reduces to a root number of 8 (5 + 3).
                </dd>

                <dt>
                    <strong>Chaldean Numerology</strong>
                </dt>
                <dd>
                    Calculates values using the{' '}
                    <strong>English spelling</strong> based on the sound
                    vibrations of each letter. Originating in ancient Babylon,
                    it uses a 1-to-8 number scale-the number 9 is omitted from
                    letter assignments because it is considered a sacred, holy
                    number. It is the most popular system among Indian
                    numerologists and is designed for the name you are commonly
                    called in daily life.
                </dd>

                <dt>
                    <strong>Pythagorean Numerology</strong>
                </dt>
                <dd>
                    Calculates values using the{' '}
                    <strong>English spelling</strong> based on sequential
                    alphabetical order (A through Z assigned strictly from 1 to
                    9). Developed in ancient Greece, it is the standard system
                    in Western numerology and is designed for your full legal
                    name as recorded on official documents.
                </dd>
            </dl>

            <p>
                The script you write your name in determines which numerology
                system applies. Many practitioners consult multiple systems to
                see if their core values align harmoniously.
            </p>

            <p className='pick'>
                <strong>Which one should you pick?</strong> Use{' '}
                <strong>Enkanitham</strong> if the name will primarily be
                written and spoken in Tamil. If the name is written in English,{' '}
                <strong>Chaldean</strong> is the standard choice in India for
                practical everyday use.
            </p>
        </>
    ),
};
