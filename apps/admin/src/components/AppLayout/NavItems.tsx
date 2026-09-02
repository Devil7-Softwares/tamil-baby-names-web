import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import SortByAlphaOutlinedIcon from '@mui/icons-material/SortByAlphaOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
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
    {
        label: 'Import',
        path: '/import',
        icon: <UploadFileOutlinedIcon />,
        adminOnly: true,
    },
    {
        label: 'Agents',
        path: '/agents',
        icon: <SmartToyOutlinedIcon />,
        adminOnly: true,
    },
    {
        label: 'LLM review',
        path: '/review',
        icon: <RateReviewOutlinedIcon />,
        adminOnly: true,
    },
];
