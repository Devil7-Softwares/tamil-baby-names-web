export const NAME_STATUSES = ['published', 'candidate', 'rejected'] as const;

export type NameStatus = (typeof NAME_STATUSES)[number];

/** The only status the public site serves. */
export const PUBLISHED: NameStatus = 'published';
