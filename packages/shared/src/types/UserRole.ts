export const USER_ROLES = ['admin', 'reviewer'] as const;

export type UserRole = (typeof USER_ROLES)[number];
