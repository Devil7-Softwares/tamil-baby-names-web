/**
 * Why a status changed. Publishing a reading sends whatever was published back
 * to the pool, so the ledger holds entries no reviewer ever judged: without
 * this it would claim they demoted a reading they never looked at.
 *
 * `abstained` is the odd one: nothing changed, and the row exists to record
 * that an agent looked and would not decide. Those carry the same status in
 * `from` and `to`, and are what a second human pass filters on.
 */
export const VERIFICATION_REASONS = [
    'decision',
    'displacement',
    'abstained',
] as const;

export type VerificationReason = (typeof VERIFICATION_REASONS)[number];
