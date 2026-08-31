import { NameStatus } from '@tbn/shared';

/** One colour per status, so a chip means the same thing on every page. */
export const STATUS_COLOUR: Record<
    NameStatus,
    'success' | 'warning' | 'default'
> = {
    published: 'success',
    candidate: 'warning',
    rejected: 'default',
};
