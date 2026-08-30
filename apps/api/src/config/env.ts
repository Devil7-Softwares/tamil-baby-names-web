export interface Env {
    NODE_ENV?: string;
    PORT: number;
    JWT_SECRET: string;
    RECAPTCHA_SECRET_KEY?: string;
    PUBLIC_DIR?: string;
    ADMIN_PUBLIC_DIR?: string;
    POSTGRES_HOST?: string;
    POSTGRES_PORT?: number;
    POSTGRES_DATABASE?: string;
    POSTGRES_USER?: string;
    POSTGRES_PASSWORD?: string;
    /** Signs admin session cookies. The admin area is offline while unset. */
    ADMIN_JWT_SECRET?: string;
    BOOTSTRAP_ADMIN_EMAIL?: string;
    BOOTSTRAP_ADMIN_PASSWORD?: string;
    BOOTSTRAP_ADMIN_NAME?: string;
}

export function validateEnv(raw: Record<string, unknown>): Env {
    const port = Number(raw.PORT ?? 3001);

    if (!Number.isInteger(port) || port <= 0) {
        throw new Error(`PORT must be a positive integer, got ${raw.PORT}`);
    }

    const jwtSecret = raw.JWT_SECRET;

    if (typeof jwtSecret !== 'string' || !jwtSecret) {
        throw new Error('JWT_SECRET environment variable must be set.');
    }

    const optional = (key: keyof Env) => raw[key] as string | undefined;

    const postgresPort = Number(raw.POSTGRES_PORT ?? 5432);

    if (!Number.isInteger(postgresPort) || postgresPort <= 0) {
        throw new Error(
            `POSTGRES_PORT must be a positive integer, got ${raw.POSTGRES_PORT}`,
        );
    }

    return {
        NODE_ENV: optional('NODE_ENV'),
        PORT: port,
        JWT_SECRET: jwtSecret,
        RECAPTCHA_SECRET_KEY: optional('RECAPTCHA_SECRET_KEY'),
        PUBLIC_DIR: optional('PUBLIC_DIR'),
        ADMIN_PUBLIC_DIR: optional('ADMIN_PUBLIC_DIR'),
        POSTGRES_HOST: optional('POSTGRES_HOST'),
        POSTGRES_PORT: postgresPort,
        POSTGRES_DATABASE: optional('POSTGRES_DATABASE'),
        POSTGRES_USER: optional('POSTGRES_USER'),
        POSTGRES_PASSWORD: optional('POSTGRES_PASSWORD'),
        ADMIN_JWT_SECRET: optional('ADMIN_JWT_SECRET'),
        BOOTSTRAP_ADMIN_EMAIL: optional('BOOTSTRAP_ADMIN_EMAIL'),
        BOOTSTRAP_ADMIN_PASSWORD: optional('BOOTSTRAP_ADMIN_PASSWORD'),
        BOOTSTRAP_ADMIN_NAME: optional('BOOTSTRAP_ADMIN_NAME'),
    };
}
