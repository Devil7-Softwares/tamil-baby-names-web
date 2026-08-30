import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import {
    Avatar,
    Divider,
    IconButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Tooltip,
    Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'react-toastify';

import { orpc } from '~/api/orpc';
import { useAuth } from '~/components/AuthProvider';

export const UserMenu: React.FC = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);

    const logout = useMutation(
        orpc.admin.auth.logout.mutationOptions({
            onSuccess: async () => {
                setAnchor(null);
                // Drops the cached `me`, which sends ProtectedRoute to /login.
                await queryClient.resetQueries();
            },
            onError: () => toast.error('Could not sign out.'),
        }),
    );

    if (!user) {
        return null;
    }

    return (
        <>
            <Tooltip title={user.name}>
                <IconButton
                    onClick={(event) => setAnchor(event.currentTarget)}
                    aria-label='Account menu'
                    size='small'
                >
                    <Avatar sx={{ width: 32, height: 32 }}>
                        {user.name.charAt(0).toUpperCase()}
                    </Avatar>
                </IconButton>
            </Tooltip>

            <Menu
                anchorEl={anchor}
                open={!!anchor}
                onClose={() => setAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <MenuItem
                    disabled
                    sx={{ display: 'block', opacity: '1 !important' }}
                >
                    <Typography variant='body2' sx={{ fontWeight: 600 }}>
                        {user.name}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                        {user.email} · {user.role}
                    </Typography>
                </MenuItem>

                <Divider />

                <MenuItem
                    onClick={() => logout.mutate({})}
                    disabled={logout.isPending}
                >
                    <ListItemIcon>
                        <LogoutOutlinedIcon fontSize='small' />
                    </ListItemIcon>
                    <ListItemText>Sign out</ListItemText>
                </MenuItem>
            </Menu>
        </>
    );
};
