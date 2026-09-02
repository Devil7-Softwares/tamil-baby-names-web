/**
 * Where a run got to. A closed set, unlike `AGENT_PROVIDERS` — a run either
 * finishes, is stopped, or breaks, and there is no fourth ending to add later.
 */
export const REVIEW_RUN_STATUSES = [
    'running',
    'finished',
    'cancelled',
    'failed',
] as const;

export type ReviewRunStatus = (typeof REVIEW_RUN_STATUSES)[number];

/** Whether a run is still moving, which is what the dashboard polls on. */
export const isSettled = (status: ReviewRunStatus): boolean =>
    status !== 'running';
