export interface Env {
    NODE_ENV?: string;
    PORT: number;
    JWT_SECRET: string;
    RECAPTCHA_SECRET_KEY?: string;
    PUBLIC_DIR?: string;
    ADMIN_PUBLIC_DIR?: string;
    MYSQL_HOST?: string;
    MYSQL_DATABASE?: string;
    MYSQL_USER?: string;
    MYSQL_PASSWORD?: string;
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

    return {
        NODE_ENV: optional('NODE_ENV'),
        PORT: port,
        JWT_SECRET: jwtSecret,
        RECAPTCHA_SECRET_KEY: optional('RECAPTCHA_SECRET_KEY'),
        PUBLIC_DIR: optional('PUBLIC_DIR'),
        ADMIN_PUBLIC_DIR: optional('ADMIN_PUBLIC_DIR'),
        MYSQL_HOST: optional('MYSQL_HOST'),
        MYSQL_DATABASE: optional('MYSQL_DATABASE'),
        MYSQL_USER: optional('MYSQL_USER'),
        MYSQL_PASSWORD: optional('MYSQL_PASSWORD'),
        ADMIN_JWT_SECRET: optional('ADMIN_JWT_SECRET'),
        BOOTSTRAP_ADMIN_EMAIL: optional('BOOTSTRAP_ADMIN_EMAIL'),
        BOOTSTRAP_ADMIN_PASSWORD: optional('BOOTSTRAP_ADMIN_PASSWORD'),
        BOOTSTRAP_ADMIN_NAME: optional('BOOTSTRAP_ADMIN_NAME'),
    };
}
