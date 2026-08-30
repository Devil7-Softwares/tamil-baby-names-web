export const commonErrors = {
    BAD_REQUEST: { message: 'The request could not be understood.' },
    UNAUTHORIZED: { message: 'Authentication is required.' },
    FORBIDDEN: { message: 'Insufficient permissions.' },
    NOT_FOUND: { message: 'Not found.' },
    /** The admin area is unusable until ADMIN_JWT_SECRET is set on the server. */
    SERVICE_UNAVAILABLE: { message: 'The admin area is not configured.' },
};
