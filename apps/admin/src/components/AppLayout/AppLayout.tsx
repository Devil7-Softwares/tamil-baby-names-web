import MenuIcon from '@mui/icons-material/Menu';
import {
    AppBar,
    Box,
    Drawer,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Toolbar,
    Typography,
} from '@mui/material';
import { useCallback, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '../AuthProvider';
import { NavItems } from './NavItems';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';

const DRAWER_WIDTH = 240;

interface NavListProps {
    onNavigate?: () => void;
}

const NavList: React.FC<NavListProps> = ({ onNavigate }) => {
    const { pathname } = useLocation();
    const { user } = useAuth();

    const items = NavItems.filter(
        (item) => !item.adminOnly || user?.role === 'admin',
    );

    return (
        <List>
            {items.map((item) => {
                const active =
                    item.path === '/'
                        ? pathname === '/'
                        : pathname.startsWith(item.path);

                return (
                    <ListItem key={item.path} disablePadding>
                        <ListItemButton
                            component={Link}
                            to={item.path}
                            selected={active}
                            onClick={onNavigate}
                        >
                            <ListItemIcon>{item.icon}</ListItemIcon>
                            <ListItemText primary={item.label} />
                        </ListItemButton>
                    </ListItem>
                );
            })}
        </List>
    );
};

export const AppLayout: React.FC = () => {
    const [mobileOpen, setMobileOpen] = useState(false);

    const closeMobile = useCallback(() => setMobileOpen(false), []);

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            <AppBar
                position='static'
                color='default'
                elevation={1}
                enableColorOnDark
            >
                <Toolbar sx={{ gap: 1 }}>
                    <IconButton
                        edge='start'
                        color='inherit'
                        aria-label='Open navigation'
                        onClick={() => setMobileOpen((open) => !open)}
                        sx={{ display: { md: 'none' } }}
                    >
                        <MenuIcon />
                    </IconButton>

                    <Typography
                        variant='h6'
                        component={Link}
                        to='/'
                        sx={{
                            fontWeight: 600,
                            color: 'inherit',
                            textDecoration: 'none',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        Tamil Baby Names
                    </Typography>

                    <Box sx={{ flexGrow: 1 }} />

                    <ThemeToggle />
                    <UserMenu />
                </Toolbar>
            </AppBar>

            <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
                <Box
                    component='nav'
                    sx={{
                        display: { xs: 'none', md: 'block' },
                        width: DRAWER_WIDTH,
                        flexShrink: 0,
                        borderRight: 1,
                        borderColor: 'divider',
                        overflowY: 'auto',
                    }}
                >
                    <NavList />
                </Box>

                <Drawer
                    variant='temporary'
                    open={mobileOpen}
                    onClose={closeMobile}
                    ModalProps={{ keepMounted: true }}
                    sx={{
                        display: { xs: 'block', md: 'none' },
                        '& .MuiDrawer-paper': { width: DRAWER_WIDTH },
                    }}
                >
                    <NavList onNavigate={closeMobile} />
                </Drawer>

                <Box
                    component='main'
                    sx={{
                        flex: 1,
                        minWidth: 0,
                        overflow: 'auto',
                        p: { xs: 2, md: 3 },
                    }}
                >
                    <Outlet />
                </Box>
            </Box>
        </Box>
    );
};
