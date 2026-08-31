/**
 * Why a status changed. Publishing a reading sends whatever was published back
 * to the pool, so the ledger holds entries no reviewer ever judged: without
 * this it would claim they demoted a reading they never looked at.
 */
export const VERIFICATION_REASONS = ['decision', 'displacement'] as const;

export type VerificationReason = (typeof VERIFICATION_REASONS)[number];
