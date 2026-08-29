export interface Env {
    PORT: number;
    MYSQL_HOST?: string;
    MYSQL_DATABASE?: string;
    MYSQL_USER?: string;
    MYSQL_PASSWORD?: string;
}

export function validateEnv(raw: Record<string, unknown>): Env {
    const port = Number(raw.PORT ?? 3001);

    if (!Number.isInteger(port) || port <= 0) {
        throw new Error(`PORT must be a positive integer, got ${raw.PORT}`);
    }

    return {
        PORT: port,
        MYSQL_HOST: raw.MYSQL_HOST as string | undefined,
        MYSQL_DATABASE: raw.MYSQL_DATABASE as string | undefined,
        MYSQL_USER: raw.MYSQL_USER as string | undefined,
        MYSQL_PASSWORD: raw.MYSQL_PASSWORD as string | undefined,
    };
}
