import type { User } from '@tbn/shared';
import { createContext, useContext } from 'react';

export interface AuthContextValue {
    user: User | null;
    isLoading: boolean;
    /** True when the server has no ADMIN_JWT_SECRET, so nobody can sign in. */
    isUnavailable: boolean;
}

export const AuthContext = createContext<AuthContextValue>({
    user: null,
    isLoading: true,
    isUnavailable: false,
});

export const useAuth = () => useContext(AuthContext);
