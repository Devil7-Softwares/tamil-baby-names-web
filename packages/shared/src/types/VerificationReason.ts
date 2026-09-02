/**
 * Why a status changed. Publishing a reading sends whatever was published back
 * to the pool, so the ledger holds entries no reviewer ever judged: without
 * this it would claim they demoted a reading they never looked at.
 *
 * Two of them changed nothing, and carry the same status in `from` and `to`.
 * `abstained` records that an agent looked and would not decide, which is what
 * a second human pass filters on. `considered` records what an agent *would*
 * have done on a run that was told not to write — the only way to ask two
 * models one question without the first one's answer changing the second one's.
 */
export const VERIFICATION_REASONS = [
    'decision',
    'displacement',
    'abstained',
    'considered',
] as const;

export type VerificationReason = (typeof VERIFICATION_REASONS)[number];
