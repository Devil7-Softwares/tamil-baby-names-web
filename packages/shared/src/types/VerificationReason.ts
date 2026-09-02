/**
 * Why a status changed. Publishing a reading sends whatever was published back
 * to the pool, so the ledger holds entries no reviewer ever judged: without
 * this it would claim they demoted a reading they never looked at.
 *
 * Three of them changed nothing, and they are not the same thing.
 *
 * `abstained` is an agent below the confidence bar: it looked and would not
 * decide, which is where a second human pass is worth the most. `unchanged` is
 * its opposite — an agent that was certain and found the catalogue already
 * right, which needs nobody. Both carry `from_status = to_status`.
 *
 * `considered` is what an agent *would* have done on a run told not to write,
 * which is the only way to ask two models one question without the first one's
 * answer changing what the second one is shown. Its `to_status` is the status
 * the row would have reached, so `reason` is the only thing that says it did
 * not: nothing should read a transition here without reading the reason.
 */
export const VERIFICATION_REASONS = [
    'decision',
    'displacement',
    'abstained',
    'unchanged',
    'considered',
] as const;

export type VerificationReason = (typeof VERIFICATION_REASONS)[number];
