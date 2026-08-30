import { ORPCError } from '@orpc/client';
import { useQuery } from '@tanstack/react-query';
import { PropsWithChildren, useMemo } from 'react';

import { orpc } from '~/api/orpc';

import { AuthContext, AuthContextValue } from './AuthContext';

export const AuthProvider: React.FC<PropsWithChildren> = ({ children }) => {
    // `me` is the only source of truth for the session: the cookie is httpOnly,
    // so being signed out surfaces here as a 401 rather than as a missing token.
    const { data, error, isPending } = useQuery(
        orpc.admin.auth.me.queryOptions(),
    );

    const value = useMemo<AuthContextValue>(
        () => ({
            user: data ?? null,
            isLoading: isPending,
            // Matched on the code rather than with isDefinedError: this 503
            // is raised by AdminAuthGuard, which runs before oRPC and so
            // answers in Nest's error shape, not the contract's.
            isUnavailable:
                error instanceof ORPCError &&
                error.code === 'SERVICE_UNAVAILABLE',
        }),
        [data, error, isPending],
    );

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
};
