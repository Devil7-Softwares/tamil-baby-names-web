import { Inject, Injectable } from '@nestjs/common';
import { User, UserRole } from '@tbn/shared';
import { hash } from 'bcryptjs';

import { ADMIN_USERS_MODEL } from '../../database/database.constants.js';
import { AdminUsersModel, IAdminUser } from '../../database/models.js';

const SALT_ROUNDS = 12;

export interface CreateUserInput {
    email: string;
    password: string;
    name: string;
    role: UserRole;
}

/** Strips the password hash, which must never reach a response. */
export const toPublicUser = (user: IAdminUser): User => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
});

@Injectable()
export class UsersService {
    constructor(
        @Inject(ADMIN_USERS_MODEL) private readonly users: AdminUsersModel,
    ) {}

    count(): Promise<number> {
        return this.users.count();
    }

    async findById(id: number): Promise<IAdminUser | null> {
        const row = await this.users.findByPk(id);

        return row?.get({ plain: true }) ?? null;
    }

    async findByEmail(email: string): Promise<IAdminUser | null> {
        const row = await this.users.findOne({ where: { email } });

        return row?.get({ plain: true }) ?? null;
    }

    async create(input: CreateUserInput): Promise<IAdminUser> {
        const row = await this.users.create({
            email: input.email,
            passwordHash: await hash(input.password, SALT_ROUNDS),
            name: input.name,
            role: input.role,
        });

        return row.get({ plain: true });
    }
}
