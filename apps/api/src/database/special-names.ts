/**
 * The 133 rows the import filed under `சிறப்பு` ("special") — its bucket for
 * names borrowed from notable people, which is a category and not a religion.
 *
 * `religion` is the tradition the *name* comes from, which is what the
 * catalogue's three buckets have always meant: it says nothing about what any
 * person believed. Where the tradition is one the catalogue does not carry it
 * stays null and `tradition` says which it is, rather than being rounded into
 * the nearest of the three.
 */
export interface SpecialName {
    name: string;
    religion: 'hindu' | 'muslim' | 'christian' | null;
    /** Only where the religion is null: the tradition that would have fit. */
    tradition?: string;
}

/** A tradition this reading could not settle, as against one it could name. */
export const UNCLEAR = 'unclear';

export const SPECIAL_NAMES: SpecialName[] = [
    { name: 'அப்துல்கலாம்', religion: 'muslim' },
    { name: 'அம்பேத்கர்', religion: 'hindu' },
    { name: 'அண்ணாதுரை', religion: 'hindu' },
    { name: 'அல்பன்சோ', religion: 'christian' },
    { name: 'அலெக்ஸாண்டர்', religion: 'christian' },
    { name: 'அக்பர்', religion: 'muslim' },
    { name: 'அன்ராஜ்', religion: 'hindu' },
    { name: 'அனுவஹா', religion: 'hindu' },
    { name: 'அன்வித்', religion: 'hindu' },
    { name: 'அரஷான்', religion: 'muslim' },
    { name: 'அசோக்', religion: 'hindu' },
    { name: 'ஆப்ரகாம் லிங்கன்', religion: 'christian' },
    { name: 'ஒபாமா', religion: null, tradition: 'Luo' },
    { name: 'கட்டபொம்மன்', religion: 'hindu' },
    { name: 'கருணாநிதி', religion: 'hindu' },
    { name: 'கனிஷ்க்', religion: 'hindu' },
    { name: 'ககுந்தா', religion: 'hindu' },
    { name: 'கனிஷிக்', religion: 'hindu' },
    { name: 'கந்த்', religion: 'hindu' },
    { name: 'கர்னாதரா', religion: 'hindu' },
    { name: 'கரன்', religion: 'hindu' },
    { name: 'சந்திர குப்த மௌரியா', religion: 'hindu' },
    { name: 'சச்சின் டெண்டுல்கர்', religion: 'hindu' },
    { name: 'சத்திய மூர்த்தி', religion: 'hindu' },
    { name: 'தனபால்', religion: 'hindu' },
    { name: 'தரணிபால்', religion: 'hindu' },
    { name: 'நரேந்திர மோடி', religion: 'hindu' },
    { name: 'நரசிம்ஹ ரோ', religion: 'hindu' },
    { name: 'பகத் சிங்', religion: null, tradition: 'Sikh' },
    { name: 'பத்சஹ்', religion: 'muslim' },
    { name: 'பஹிந்தர்', religion: null, tradition: UNCLEAR },
    { name: 'மகாத்மா காந்தி', religion: 'hindu' },
    { name: 'மன்மோகன் சிக்', religion: null, tradition: 'Sikh' },
    { name: 'மகிபதி', religion: 'hindu' },
    { name: 'மஜெட்டி', religion: 'hindu' },
    { name: 'மணிமுடி', religion: 'hindu' },
    { name: 'மனோர்', religion: 'hindu' },
    { name: 'மல்', religion: 'muslim' },
    { name: 'மலங்க்', religion: 'muslim' },
    { name: 'ரபீந்திரநாத் தாகூர்', religion: 'hindu' },
    { name: 'வல்லபாய் படேல்', religion: 'hindu' },
    { name: 'கோபால் கிருஷ்ண கோக்லே', religion: 'hindu' },
    { name: 'சார்லஸ் மார்டின்', religion: 'christian' },
    { name: 'சிதம்பரம்', religion: 'hindu' },
    { name: 'சிவாஜி', religion: 'hindu' },
    { name: 'சுபாஷ் சந்திர போஸ்', religion: 'hindu' },
    { name: 'சுவாமி விவேகானந்தர்', religion: 'hindu' },
    { name: 'சுப்ரமணிய சிவா', religion: 'hindu' },
    { name: 'சுல்தான் மெஹ்மத்', religion: 'muslim' },
    { name: 'தாதா பாய் நேரோஜி', religion: null, tradition: 'Parsi' },
    { name: 'தாமஸ் ஆல்வா எடிசன்', religion: 'christian' },
    { name: 'தாமஸ் ஜெப்பர்சன்', religion: 'christian' },
    { name: 'தாரீஷ்', religion: 'hindu' },
    { name: 'தர்னீஷ்', religion: 'hindu' },
    { name: 'தாமன்', religion: 'hindu' },
    { name: 'நித்தியானந்தா', religion: 'hindu' },
    { name: 'நிதிஸ் குமார்', religion: 'hindu' },
    { name: 'பாலா கங்காதர திலக்', religion: 'hindu' },
    { name: 'பாரதியார்', religion: 'hindu' },
    { name: 'பாரதிதாசன்', religion: 'hindu' },
    { name: 'பாத்காஹ்', religion: 'muslim' },
    { name: 'பாலசேனா', religion: 'hindu' },
    { name: 'பாஷா', religion: 'muslim' },
    { name: 'பில்கேட்ஸ்', religion: 'christian' },
    { name: 'வாஜ்பாய்', religion: 'hindu' },
    { name: 'வாஞ்சிநாதன்', religion: 'hindu' },
    { name: 'போப் ப்ரான்சிஸ்', religion: 'christian' },
    { name: 'பெஞ்சமின் ப்ராங்லின்', religion: 'christian' },
    { name: 'பெடல் கேஸ்ட்ரோ', religion: 'christian' },
    { name: 'மார்டின் லூதர்', religion: 'christian' },
    { name: 'மார்க் ஆண்டனி', religion: 'christian' },
    { name: 'மாலீக்', religion: 'muslim' },
    { name: 'மாலிக்', religion: 'muslim' },
    { name: 'நெப்போலியன்', religion: 'christian' },
    { name: 'நெல்சன் மண்டெலா', religion: 'christian' },
    { name: 'விஸ்வநாத ஆனந்த்', religion: 'hindu' },
    { name: 'கிரிஸ்டோபர் கொலம்பஸ்', religion: 'christian' },
    { name: 'ராமசந்திரன்', religion: 'hindu' },
    { name: 'ராம் மனோகர் லோகியா', religion: 'hindu' },
    { name: 'ராமா ரோ', religion: 'hindu' },
    { name: 'ராஜேந்திர பிரசாத்', religion: 'hindu' },
    { name: 'ராமசாமி', religion: 'hindu' },
    { name: 'ராஜிவ் காந்தி', religion: 'hindu' },
    { name: 'காமராஜர்', religion: 'hindu' },
    { name: 'காக்தே', religion: 'hindu' },
    { name: 'கார்த்திக்', religion: 'hindu' },
    { name: 'லாலா லஜ்பத் ராய்', religion: 'hindu' },
    { name: 'லால் பகதுர் சாஸ்திரி', religion: 'hindu' },
    { name: 'லாலு பிரசாத் யாதவ்', religion: 'hindu' },
    { name: 'திருப்பூர் குமரன்', religion: 'hindu' },
    { name: 'தினேஷ் குப்தா', religion: 'hindu' },
    { name: 'பீட்டர்', religion: 'christian' },
    { name: 'கென்னடி', religion: 'christian' },
    { name: 'மோதிலால் நேரு', religion: 'hindu' },
    { name: 'ஜுலியஸ் சீசர்', religion: 'christian' },
    { name: 'ஜவகர்லால் நேரு', religion: 'hindu' },
    { name: 'ஜாகீர் குசைன்', religion: 'muslim' },
    { name: 'ஜார்ஜ் வாசிங்டன்', religion: 'christian' },
    { name: 'ஜெயபிரகாஷ் நாராயண்', religion: 'hindu' },
    { name: 'ஹிட்லர்', religion: 'christian' },
    { name: 'ஜோசப் ஸ்டாலின்', religion: 'christian' },
    { name: 'அன்னை தெரஸா', religion: 'christian' },
    { name: 'அன்னி பெசண்ட்', religion: 'christian' },
    { name: 'அருந்ததி பட்டாச்சாரியா', religion: 'hindu' },
    { name: 'இந்திரா காந்தி', religion: 'hindu' },
    { name: 'ஏஞ்சலினா ஜுலி', religion: 'christian' },
    { name: 'கஸ்தூரிபாய்', religion: 'hindu' },
    { name: 'கமலா நேரு', religion: 'hindu' },
    { name: 'கல்பனா சாவ்லா', religion: 'hindu' },
    { name: 'சரோஜினி நாயுடு', religion: 'hindu' },
    { name: 'பத்மஜா நாயுடு', religion: 'hindu' },
    { name: 'மரிய தெரசா', religion: 'christian' },
    { name: 'மம்தா பானர்ஜி', religion: 'hindu' },
    { name: 'குயின் எலிசபத்', religion: 'christian' },
    { name: 'சானியா மிர்ஷா', religion: 'muslim' },
    { name: 'சோனியா காந்தி', religion: 'christian' },
    { name: 'துர்கா பாய் தேஸ்முக்', religion: 'hindu' },
    { name: 'பிரதீபா படேல்', religion: 'hindu' },
    { name: 'பி.டி.உஷா', religion: 'hindu' },
    { name: 'மாயாவதி', religion: 'hindu' },
    { name: 'மீரா பாய்', religion: 'hindu' },
    { name: 'முத்துலட்சுமி ரெட்டி', religion: 'hindu' },
    { name: 'மேரி கியூரி', religion: 'christian' },
    { name: 'விஜயலட்சுமி பண்டிட்', religion: 'hindu' },
    { name: 'விக்டோரியா ராணி', religion: 'christian' },
    { name: 'வேலு நாச்சியார்', religion: 'hindu' },
    { name: 'கிரண்பேடி', religion: 'hindu' },
    { name: 'மோனலிசா', religion: 'christian' },
    { name: 'ராணி லட்சுமி பாய்', religion: 'hindu' },
    { name: 'காத்ரின்', religion: 'christian' },
    { name: 'ஜானகி தேவர்', religion: 'hindu' },
    { name: 'ஜெயலலிதா', religion: 'hindu' },
    { name: 'ஹெலன் கில்லர்', religion: 'christian' },
];

const FILED =
    'Imported under "சிறப்பு" (special), the source\'s bucket for names borrowed from notable people.';

/** What the note on such a row says, and why the religion column moved. */
export const specialNote = ({ tradition }: SpecialName): string => {
    if (!tradition) {
        return `${FILED} The religion is the name's tradition.`;
    }

    return tradition === UNCLEAR
        ? `${FILED} Its tradition is not clear enough to name one.`
        : `${FILED} Named in the ${tradition} tradition, which the catalogue does not carry.`;
};
