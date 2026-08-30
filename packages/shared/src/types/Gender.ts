export const GENDERS = ['boy', 'girl'] as const;

export type Gender = (typeof GENDERS)[number];
