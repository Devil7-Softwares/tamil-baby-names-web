import { Navigate, Outlet } from 'react-router-dom';

import { LoadingOverlay } from '../LoadingOverlay/LoadingOverlay';
import { useAuth } from './AuthContext';

export interface ProtectedRouteProps {
    /** Restrict to admins — the API rejects these routes for anyone else. */
    adminOnly?: boolean;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
    adminOnly = false,
}) => {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return <LoadingOverlay />;
    }

    if (!user) {
        return <Navigate to='/login' replace />;
    }

    // Without this a reviewer lands on a page whose every request 403s.
    if (adminOnly && user.role !== 'admin') {
        return <Navigate to='/' replace />;
    }

    return <Outlet />;
};
