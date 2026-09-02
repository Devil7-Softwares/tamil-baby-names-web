import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/** AES-256-GCM: 32-byte key, 12-byte nonce, 16-byte tag. */
const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;

/** The three columns that together are one sealed key. */
export interface SealedKey {
    keyCiphertext: Buffer;
    keyIv: Buffer;
    keyTag: Buffer;
}

export class AgentKeyError extends Error {}

/**
 * Reads the master key. Base64 or hex, because a 32-byte secret is written
 * both ways and getting told which one is wrong beats a decrypt that fails
 * later for no visible reason.
 */
export const masterKey = (secret: string | undefined): Buffer => {
    if (!secret) {
        throw new AgentKeyError(
            'AGENT_KEY_SECRET is not set, so agent keys cannot be sealed or read.',
        );
    }

    const decoded = /^[0-9a-f]{64}$/i.test(secret)
        ? Buffer.from(secret, 'hex')
        : Buffer.from(secret, 'base64');

    if (decoded.length !== KEY_BYTES) {
        throw new AgentKeyError(
            `AGENT_KEY_SECRET must decode to ${KEY_BYTES} bytes, got ${decoded.length}.`,
        );
    }

    return decoded;
};

export const seal = (
    secret: string | undefined,
    plaintext: string,
): SealedKey => {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, masterKey(secret), iv);

    const keyCiphertext = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]);

    return { keyCiphertext, keyIv: iv, keyTag: cipher.getAuthTag() };
};

/**
 * Opens a sealed key. GCM authenticates as it decrypts, so a row edited in the
 * database — or opened with the wrong master key — throws rather than handing
 * back plausible rubbish that would be sent to a provider as a credential.
 */
export const open = (
    secret: string | undefined,
    { keyCiphertext, keyIv, keyTag }: SealedKey,
): string => {
    const decipher = createDecipheriv(ALGORITHM, masterKey(secret), keyIv);

    decipher.setAuthTag(keyTag);

    try {
        return Buffer.concat([
            decipher.update(keyCiphertext),
            decipher.final(),
        ]).toString('utf8');
    } catch {
        throw new AgentKeyError(
            'This agent’s key could not be opened. AGENT_KEY_SECRET has probably changed since it was saved — replace the key on the agent.',
        );
    }
};

/**
 * The three columns as one value, or null when the agent has no key. A row is
 * whole or empty; `agents_key_is_whole` enforces the same thing in the database.
 */
export const sealedOf = (row: {
    keyCiphertext: Buffer | null;
    keyIv: Buffer | null;
    keyTag: Buffer | null;
}): SealedKey | null =>
    row.keyCiphertext && row.keyIv && row.keyTag
        ? {
              keyCiphertext: row.keyCiphertext,
              keyIv: row.keyIv,
              keyTag: row.keyTag,
          }
        : null;
