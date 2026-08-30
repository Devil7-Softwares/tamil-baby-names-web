import { z } from 'zod';

import { USER_ROLES } from '../types/UserRole.js';

export const UserSchema = z.object({
    id: z.number().int().positive(),
    email: z.email(),
    name: z.string(),
    role: z.enum(USER_ROLES),
    createdAt: z.iso.datetime(),
});

export type User = z.infer<typeof UserSchema>;
