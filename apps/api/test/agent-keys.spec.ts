import { randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
    AgentKeyError,
    open,
    seal,
    sealedOf,
} from '../src/agents/agent-keys.js';

const SECRET = randomBytes(32).toString('base64');
const KEY = 'sk-ant-a-key-that-must-not-be-guessable';

describe('sealing an agent’s key', () => {
    it('gives back what was sealed', () => {
        expect(open(SECRET, seal(SECRET, KEY))).toBe(KEY);
    });

    it('never writes the key in the clear', () => {
        const { keyCiphertext } = seal(SECRET, KEY);

        expect(keyCiphertext.toString('utf8')).not.toContain('sk-ant');
        expect(keyCiphertext.toString('base64')).not.toContain(
            Buffer.from(KEY).toString('base64'),
        );
    });

    // Two agents sharing a key must not produce the same ciphertext, or the
    // database says which rows hold the same credential.
    it('seals the same key differently every time', () => {
        const a = seal(SECRET, KEY);
        const b = seal(SECRET, KEY);

        expect(a.keyIv.equals(b.keyIv)).toBe(false);
        expect(a.keyCiphertext.equals(b.keyCiphertext)).toBe(false);
        expect(open(SECRET, b)).toBe(KEY);
    });

    it('refuses a key sealed under a different secret', () => {
        const sealed = seal(SECRET, KEY);

        expect(() => open(randomBytes(32).toString('base64'), sealed)).toThrow(
            AgentKeyError,
        );
    });

    // GCM authenticates as it decrypts, so an edited row throws rather than
    // handing back rubbish that would be sent to a provider as a credential.
    it('refuses ciphertext that was edited in the database', () => {
        const sealed = seal(SECRET, KEY);

        sealed.keyCiphertext[0] ^= 0xff;

        expect(() => open(SECRET, sealed)).toThrow(AgentKeyError);
    });

    it('takes the secret as hex as well as base64', () => {
        const hex = randomBytes(32).toString('hex');

        expect(open(hex, seal(hex, KEY))).toBe(KEY);
    });

    it('says so when the secret is missing or the wrong length', () => {
        expect(() => seal(undefined, KEY)).toThrow(
            /AGENT_KEY_SECRET is not set/,
        );
        expect(() => seal('c2hvcnQ=', KEY)).toThrow(/must decode to 32 bytes/);
    });
});

describe('the three columns as one value', () => {
    it('is null unless all three are there', () => {
        const sealed = seal(SECRET, KEY);

        expect(sealedOf({ ...sealed })).not.toBeNull();
        expect(
            sealedOf({ keyCiphertext: null, keyIv: null, keyTag: null }),
        ).toBeNull();
        expect(sealedOf({ ...sealed, keyTag: null })).toBeNull();
    });
});
