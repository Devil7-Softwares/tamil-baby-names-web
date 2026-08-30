import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import SortByAlphaOutlinedIcon from '@mui/icons-material/SortByAlphaOutlined';
import { ReactNode } from 'react';

export interface NavItem {
    label: string;
    path: string;
    icon: ReactNode;
    /** Hidden from reviewers, matching the route guard and the API. */
    adminOnly?: boolean;
}

/**
 * The sidebar's model. Adding a page is one entry here plus one `<Route>` in
 * `pages/index.tsx` — nothing links to a route that does not exist yet.
 */
export const NavItems: NavItem[] = [
    { label: 'Dashboard', path: '/', icon: <DashboardOutlinedIcon /> },
    { label: 'Names', path: '/names', icon: <SortByAlphaOutlinedIcon /> },
];
