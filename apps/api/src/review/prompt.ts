import { ReviewSubject } from '@tbn/shared';

/**
 * What the model is told it is doing.
 *
 * Written against what the catalogue actually holds. The 12,389 readings that
 * came from `nithra.babyname` were never reviewed by anyone, and the batches
 * coming from the scraper are worse: `names-all.csv` carries 162,891 rows
 * across twenty packages, of which most are a quran translation, a dictionary
 * or a calendar rather than a name catalogue. So "this is not a name" has to be
 * a first-class answer, not an edge case the model has to be talked into.
 *
 * The instruction to prefer abstaining is deliberate and load-bearing. A model
 * that guesses confidently on 160,000 rows produces a catalogue nobody can
 * trust and no way to find the bad parts; one that says 30 leaves a queue a
 * person can actually work through.
 */
export const SYSTEM = `You review entries in a Tamil baby-name catalogue.

You are shown one name and the readings — meanings — that sources recorded for
it. Decide which reading is right.

How to judge:
- A reading is right if it is what the name means in the language the name
  comes from: Tamil, or Sanskrit, Arabic or Persian for names that entered
  Tamil from those.
- Prefer the reading that explains the name's parts. அமுதன் is from அமுதம்
  (nectar), so "the sweet one" and "immortal" are both arguable and "a farmer"
  is not.
- Several sources agreeing is worth something, but a reading repeated by three
  apps that copied each other is still one source. The source of each reading
  is shown next to it.
- The catalogue holds names Tamil families actually use, whatever language they
  came from. Richard, Albion, ஆதிஃபா and அப்துல் all belong in it. A name being
  English, Arabic, Sanskrit or Persian is NOT a reason to reject it, and not a
  reason to be unsure — judge whether the reading is right for that name in its
  own language.
- rejectName is only for entries that are not names at all: a dictionary
  headword, a phrase, a line of scripture, a UI string, a stray sentence. These
  come from catalogues scraped out of apps that also shipped other text. If a
  person could be called it, it is a name.
- Do not invent etymology. If you have not met the name, say so with a low
  confidence rather than reasoning from what it looks like.

Confidence is 0 to 100 and is about *this* name, not about your general
competence. Use low numbers freely — everything under 55 is left untouched for
a person to read, which is the right outcome when you are unsure. A wrong
confident answer costs far more than an honest low one.

Answer with JSON only.`;

const NOT_RECORDED = 'not recorded';

/** The cluster as a person would read it aloud, which is what the model gets. */
export const render = (subject: ReviewSubject): string => {
    const lines = [
        `Name: ${subject.name}`,
        `Gender: ${subject.gender}`,
        `Religion: ${subject.religion ?? NOT_RECORDED}`,
        `Language: ${subject.language ?? NOT_RECORDED}`,
        '',
    ];

    if (subject.readings.length) {
        lines.push('Readings recorded for it:');
        lines.push(
            ...subject.readings.map(
                ({ at, text, source, published }) =>
                    `${at}. ${text}` +
                    `  [source: ${source ?? NOT_RECORDED}` +
                    `${published ? ', currently published' : ''}]`,
            ),
        );
    } else {
        lines.push('No reading has been recorded for it.');
    }

    lines.push(
        '',
        'Answer with:',
        '- publish: the number of the reading to publish, or null if none is right.',
        '- reject: the numbers of readings that are wrong. May be empty.',
        '- rejectName: true only if this is not a name at all.',
        '- add: a better reading in Tamil, if every one above is wrong. Otherwise null.',
        '- confidence: 0-100.',
        '- note: one line, in English, saying why.',
    );

    return lines.join('\n');
};
