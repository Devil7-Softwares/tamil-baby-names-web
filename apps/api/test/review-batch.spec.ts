import { REVIEW_BATCH_JSON_SCHEMA } from '@tbn/shared';
import { describe, expect, it } from 'vitest';

import { renderBatch } from '../src/review/prompt.js';
import { parseBatch } from '../src/review/reviewer.js';

const subject = (name: string, readings: string[] = []) => ({
    name,
    gender: 'boy',
    religion: null,
    language: null,
    readings: readings.map((text, at) => ({
        at: at + 1,
        text,
        source: 'nithra.babyname',
        published: false,
    })),
});

describe('asking about several names at once', () => {
    it('numbers each name and asks for the number back', () => {
        const prompt = renderBatch([subject('கணேஷ்'), subject('அன்பு')]);

        expect(prompt).toContain('--- 1 ---');
        expect(prompt).toContain('--- 2 ---');
        expect(prompt).toContain('Name: கணேஷ்');
        expect(prompt).toContain('Name: அன்பு');
        expect(prompt).toContain('at: the number of the name above');
    });

    // A model filling ten slots has a pull towards filling all ten, and
    // declining is the answer that matters most on names with no reading.
    it('tells the model the names are unrelated', () => {
        const prompt = renderBatch([subject('a'), subject('b')]);

        expect(prompt).toContain('Judge each entirely on');
        expect(prompt).toContain('its own');
        expect(prompt).toMatch(/unsure about one says nothing/);
    });

    it('carries each name’s own readings', () => {
        const prompt = renderBatch([
            subject('கணேஷ்', ['சிவனின் மகன்']),
            subject('அன்பு'),
        ]);

        expect(prompt).toContain('சிவனின் மகன்');
        expect(prompt).toContain('No reading has been recorded for it.');
    });

    it('states the instructions once, not once per name', () => {
        const one = renderBatch([subject('a')]);
        const five = renderBatch(
            ['a', 'b', 'c', 'd', 'e'].map((n) => subject(n)),
        );
        const count = (text: string) =>
            text.split('- confidence: 0-100.').length - 1;

        expect(count(one)).toBe(1);
        expect(count(five)).toBe(1);
    });
});

describe('reading a batch answer', () => {
    it('takes the verdicts and keys them by the name they name', () => {
        const parsed = parseBatch(
            '```json {"verdicts":[' +
                '{"at":2,"publish":null,"reject":[],"rejectName":false,"add":null,"confidence":80,"note":"b"},' +
                '{"at":1,"publish":1,"reject":[],"rejectName":false,"add":null,"confidence":90,"note":"a"}' +
                ']} ```',
        );

        expect('batch' in parsed).toBe(true);

        if ('batch' in parsed) {
            expect(parsed.batch.verdicts.map((v) => v.at)).toEqual([2, 1]);
        }
    });

    it('refuses an answer that is not JSON', () => {
        expect(parseBatch('sorry, I cannot')).toMatchObject({
            unreadable: expect.stringContaining('did not answer with JSON'),
        });
    });

    it('refuses a verdict missing the number it is about', () => {
        const parsed = parseBatch(
            '{"verdicts":[{"publish":null,"reject":[],"rejectName":false,' +
                '"add":null,"confidence":80,"note":"x"}]}',
        );

        expect('unreadable' in parsed).toBe(true);
    });

    // Providers take a subset of JSON Schema; the ranges zod emits are outside
    // it, and Claude answers 400 for them.
    it('is held to a schema with no numeric ranges', () => {
        const found: string[] = [];
        const walk = (node: unknown): void => {
            if (Array.isArray(node)) {
                node.forEach(walk);
            } else if (node && typeof node === 'object') {
                for (const [key, value] of Object.entries(node)) {
                    if (
                        ['minimum', 'maximum'].includes(
                            key.replace(/^exclusive/, '').toLowerCase(),
                        )
                    ) {
                        found.push(key);
                    }

                    walk(value);
                }
            }
        };

        walk(REVIEW_BATCH_JSON_SCHEMA);

        expect(found).toEqual([]);
        expect(REVIEW_BATCH_JSON_SCHEMA).toMatchObject({ type: 'object' });
    });
});
