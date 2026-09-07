export const locales = {
    en: {
        moonSigns: [
            'Aries',
            'Taurus',
            'Gemini',
            'Cancer',
            'Leo',
            'Virgo',
            'Libra',
            'Scorpio',
            'Sagittarius',
            'Capricorn',
            'Aquarius',
            'Pisces',
        ],
        lunarMansions: [
            'Aswini',
            'Bharani',
            'Karthigai',
            'Rogini',
            'Mirugasirsham',
            'Thiruvadhirai',
            'Punarpoosam',
            'Poosam',
            'Aayilyam',
            'Magam',
            'Pooram',
            'Uthram',
            'Hastham',
            'Chithirai',
            'Swaathi',
            'Visakam',
            'Anusham',
            'Kettai',
            'Moolam',
            'Pooradam',
            'Uthradam',
            'Thiruvonam',
            'Avittam',
            'Sadhayam',
            'Pooratadhi',
            'Uthratadhi',
            'Revathi',
        ],
        /**
         * The syllable each quarter of a mansion gives a name, in the order
         * the quarters run.
         *
         * A separate table from `namingLettersByLunarMansions` rather than a
         * slice of it: that one is a bag of every spelling a mansion is
         * associated with, canonical and variant together, and eleven of its
         * twenty-seven entries happen to hold exactly the four padhams while
         * the rest are padded out with alternates in no particular order.
         * Those eleven are what this was checked against, and they agree
         * exactly - see `astro.test.ts`, which fails if the two ever diverge.
         */
        namingLettersByPadham: [
            ['CHU', 'CHEY', 'CHO', 'LA'], // Aswini
            ['LI', 'LU', 'LEY', 'LO'], // Bharani
            ['A', 'EE', 'U', 'E'], // Karthigai
            ['O', 'VA', 'VI', 'VU'], // Rogini
            ['VAY', 'VO', 'KAA', 'KI'], // Mirugasirsham
            ['KU', 'GHA', 'NGA', 'CHHA'], // Thiruvadhirai
            ['KAY', 'KO', 'HAA', 'HEE'], // Punarpoosam
            ['HU', 'HAY', 'HO', 'DA'], // Poosam
            ['DEE', 'DOO', 'DAY', 'DO'], // Aayilyam
            ['MA', 'MI', 'MU', 'MAY'], // Magam
            ['MO', 'TA', 'TI', 'TU'], // Pooram
            ['TAY', 'TO', 'PA', 'PI'], // Uthram
            ['PU', 'SHA', 'NA', 'TA'], // Hastham
            ['PAY', 'PO', 'RAA', 'REE'], // Chithirai
            ['RU', 'RAY', 'RO', 'THA'], // Swaathi
            ['THEE', 'THOO', 'THAY', 'THO'], // Visakam
            ['NA', 'NEE', 'NOO', 'NAY'], // Anusham
            ['NO', 'YA', 'YEE', 'YU'], // Kettai
            ['YAY', 'YO', 'BAA', 'BEE'], // Moolam
            ['BU', 'DHA', 'PHA', 'DA'], // Pooradam
            ['BAY', 'BO', 'JAA', 'JEE'], // Uthradam
            ['JU', 'JAY', 'JO', 'KHA'], // Thiruvonam
            ['GA', 'GEE', 'GU', 'GAY'], // Avittam
            ['GO', 'SA', 'SEE', 'SU'], // Sadhayam
            ['SAY', 'SO', 'DAA', 'DEE'], // Pooratadhi
            ['DU', 'THA', 'JHA', 'GNA'], // Uthratadhi
            ['DE', 'DO', 'CHAA', 'CHEE'], // Revathi
        ],
        namingLettersByLunarMansions: [
            ['CHU', 'CHEY', 'CHO', 'LA', 'CHE', 'SU', 'SHU', 'SE', 'SO'],
            ['LI', 'LU', 'LEY', 'LO', 'LEE', 'LE'],
            ['AO', 'EE', 'UO', 'A', 'E', 'U', 'EA'],
            ['O', 'VA', 'VEE', 'VOO', 'VI', 'VU'],
            ['VAY', 'VO', 'KE', 'WE', 'WO', 'KA', 'KI', 'VE', 'KE'],
            [
                'KOO',
                'GHAA',
                'JNA',
                'CHA',
                'KU',
                'GHA',
                'ING',
                'JHA',
                'KA',
                'SA',
                'SHA',
            ],
            ['KAY', 'KO', 'HAA', 'HEE', 'KE', 'HA', 'HI', 'GO'],
            ['HOO', 'HAY', 'HO', 'DAA', 'HU', 'HE', 'DA', 'HI'],
            [
                'DEE',
                'DOO',
                'DAY',
                'DO',
                'DE',
                'DU',
                'DI',
                'TI',
                'TU',
                'TO',
                'TE',
            ],
            ['MA', 'ME', 'MI', 'MOO', 'MAY', 'MU'],
            ['MO', 'TA', 'TE', 'TO', 'TI', 'TU', 'DA', 'DI', 'DU'],
            ['TAY', 'TO', 'TE', 'PA', 'PI', 'PE', 'DE', 'DO'],
            ['PU', 'SHAA', 'NAA', 'THA', 'SHA', 'NA'],
            ['PAY', 'PO', 'RAA', 'REE', 'PE', 'RA', 'RE'],
            ['RU', 'RAY', 'RO', 'TAA', 'RE'],
            ['THEE', 'THOO', 'TAHY', 'THO', 'TEE', 'TUE', 'TEAA', 'TOO'],
            ['NA', 'NEE', 'NOO', 'NAY', 'NE', 'NU'],
            ['NO', 'YAA', 'YEE', 'YOO', 'YA', 'YI', 'UU'],
            ['YAY', 'YO', 'BAA', 'BEE', 'YE', 'BA', 'BE'],
            ['BU', 'DHAA', 'BHA', 'DHA', 'BA', 'DAA'],
            ['BAY', 'BO', 'JAA', 'JEE', 'BE', 'JA', 'JI'],
            ['JU', 'JAY', 'JO', 'GHA', 'JE', 'SHA'],
            ['GAA', 'GEE', 'GOO', 'GAY', 'GA', 'GI', 'GU', 'GE'],
            ['GO', 'SAA', 'SEE', 'SOO', 'SA', 'SI', 'SU'],
            ['SAY', 'SO', 'DAA', 'DEE', 'SE', 'DA', 'DI'],
            ['DHU', 'THA', 'SA', 'GHEE', 'DU', 'JHA', 'JNA'],
            ['DE', 'DO', 'CHAA', 'CHEE', 'CHA', 'CHI'],
        ],
        panjangams: {
            thirukanitha: 'Thirukanitha',
            vakkiya: 'Vakkiya',
        },
    },
    ta: {
        moonSigns: [
            'மேஷம்',
            'ரிஷபம்',
            'மிதுனம்',
            'கடகம்',
            'சிம்மம்',
            'கன்னி',
            'துலாம்',
            'விருச்சிகம்',
            'தனுசு',
            'மகரம்',
            'கும்பம்',
            'மீனம்',
        ],
        lunarMansions: [
            'அசுவினி',
            'பரணி',
            'கிருத்திகை',
            'ரோகினி',
            'மிருகசீரீடம்',
            'திருவாதிரை',
            'புனர்பூசம்',
            'பூசம்',
            'ஆயில்யம்',
            'மகம்',
            'பூரம்',
            'உத்திரம்',
            'அஸ்தம்',
            'சித்திரை',
            'சுவாதி',
            'விசாகம்',
            'அனுசம்',
            'கேட்டை',
            'மூலம்',
            'பூராடம்',
            'உத்திராடம்',
            'திருவோணம்',
            'அவிட்டம்',
            'சதயம்',
            'பூரட்டாதி',
            'உத்திரட்டாதி',
            'ரேவதி',
        ],
        /**
         * The syllable each quarter of a mansion gives a name, in the order
         * the quarters run.
         *
         * A separate table from `namingLettersByLunarMansions` rather than a
         * slice of it: that one is a bag of every spelling a mansion is
         * associated with, canonical and variant together, and eleven of its
         * twenty-seven entries happen to hold exactly the four padhams while
         * the rest are padded out with alternates in no particular order.
         * Those eleven are what this was checked against, and they agree
         * exactly - see `astro.test.ts`, which fails if the two ever diverge.
         */
        namingLettersByPadham: [
            ['சு', 'செ', 'சோ', 'ல'], // Aswini
            ['லி', 'லு', 'லே', 'லோ'], // Bharani
            ['அ', 'இ', 'உ', 'எ'], // Karthigai
            ['ஒ', 'வ', 'வி', 'வு'], // Rogini
            ['வே', 'வோ', 'கா', 'கி'], // Mirugasirsham
            ['கு', 'க', 'ங', 'ச்சா'], // Thiruvadhirai
            ['கே', 'கோ', 'ஹ', 'ஹி'], // Punarpoosam
            ['ஹு', 'ஹே', 'ஹோ', 'ட'], // Poosam
            ['டி', 'டு', 'டே', 'டோ'], // Aayilyam
            ['ம', 'மி', 'மு', 'மே'], // Magam
            ['மோ', 'ட', 'டி', 'டு'], // Pooram
            ['டே', 'டோ', 'ப', 'பி'], // Uthram
            ['பு', 'ஷ', 'ண', 'ட'], // Hastham
            ['பே', 'போ', 'ர', 'ரி'], // Chithirai
            ['ரு', 'ரே', 'ரோ', 'த'], // Swaathi
            ['தி', 'து', 'தே', 'தோ'], // Visakam
            ['ந', 'நி', 'நு', 'நே'], // Anusham
            ['நோ', 'ய', 'யி', 'யு'], // Kettai
            ['யே', 'யோ', 'ப', 'பி'], // Moolam
            ['பூ', 'த', 'ப', 'ட'], // Pooradam
            ['பே', 'போ', 'ஜ', 'ஜி'], // Uthradam
            ['ஜூ', 'ஜே', 'ஜோ', 'கா'], // Thiruvonam
            ['க', 'கி', 'கு', 'கே'], // Avittam
            ['கோ', 'ஸ', 'ஸி', 'சூ'], // Sadhayam
            ['ஸே', 'ஸோ', 'தா', 'தீ'], // Pooratadhi
            ['து', 'ச', 'ஸ்ரீ', 'ஞ'], // Uthratadhi
            ['தே', 'தோ', 'ச', 'சி'], // Revathi
        ],
        namingLettersByLunarMansions: [
            ['சு', 'செ', 'சே', 'சொ', 'சோ', 'ல', 'லா'],
            ['லி', 'லீ', 'லு', 'லே', 'லோ', 'லூ'],
            ['அ', 'ஆ', 'இ', 'ஈ', 'உ', 'எ', 'ஏ', 'ஊ', 'ஏ'],
            ['ஒ', 'ஓ', 'வ', 'வா', 'வி', 'வீ', 'வு', 'வூ'],
            ['வே', 'வோ', 'கா', 'கி'],
            ['கு', 'க', 'ச', 'ஞ', 'ங', 'ச்சா'],
            ['கே', 'கோ', 'ஹ', 'ஹி'],
            ['ஹ', 'ஹே', 'ஹோ', 'ட', 'ஹீ'],
            ['டி', 'டு', 'டே', 'டோ'],
            ['ம', 'மி', 'மு', 'மெ', 'மே'],
            ['மோ', 'ட', 'டி', 'டு'],
            ['டே', 'டோ', 'ப', 'பி'],
            ['பூ', 'ஷ', 'ந', 'ட', 'பு', 'ண'],
            ['பே', 'போ', 'ர', 'ரி'],
            ['ரு', 'ரே', 'ரோ', 'த', 'தா'],
            ['தி', 'து', 'தே', 'தோ'],
            ['ந', 'நி', 'நு', 'நே'],
            ['நோ', 'ய', 'இ', 'பூ', 'யி', 'யு'],
            ['யே', 'யோ', 'ப', 'பி'],
            ['பூ', 'த', 'ப', 'டா', 'பு', 'ட'],
            ['பே', 'போ', 'ஜ', 'ஜி'],
            ['ஜூ', 'ஜே', 'ஜோ', 'கா', 'கி', 'கு', 'கெ', 'கொ'],
            ['க', 'கீ', 'கு', 'கூ', 'கி', 'கே'],
            ['கோ', 'ஸ', 'ஸீ', 'சூ', 'ஸி'],
            ['ஸே', 'ஸோ', 'தா', 'தீ', 'த', 'தி'],
            ['து', 'ச', 'ஸ்ரீ', 'ஞ', 'ஸ', 'த'],
            ['தே', 'தோ', 'ச', 'சி'],
        ],
        panjangams: {
            thirukanitha: 'திருக்கணிதம்',
            vakkiya: 'வாக்கியம்',
        },
    },
};
