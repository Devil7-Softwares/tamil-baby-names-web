import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

import { AppLayout, LoadingOverlay, ProtectedRoute } from '~/components';

const Login = lazy(() => import('./Login/Login'));
const Dashboard = lazy(() => import('./Dashboard/Dashboard'));
const Names = lazy(() => import('./Names/Names'));
const ImportPage = lazy(() => import('./Import/Import'));
const Agents = lazy(() => import('./Agents/Agents'));

export const Pages: React.FC = () => (
    <Suspense fallback={<LoadingOverlay />}>
        <Routes>
            <Route path='/login' element={<Login />} />

            <Route element={<ProtectedRoute />}>
                <Route element={<AppLayout />}>
                    <Route path='/' element={<Dashboard />} />
                    <Route path='/names' element={<Names />} />
                </Route>
            </Route>

            <Route element={<ProtectedRoute adminOnly />}>
                <Route element={<AppLayout />}>
                    <Route path='/import' element={<ImportPage />} />
                    <Route path='/agents' element={<Agents />} />
                </Route>
            </Route>

            <Route path='*' element={<div>404 Not Found</div>} />
        </Routes>
    </Suspense>
);
