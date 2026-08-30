import { Card, CardContent, Stack, Typography } from '@mui/material';

import { useAuth } from '~/components';

const Dashboard: React.FC = () => {
    const { user } = useAuth();

    return (
        <Stack spacing={2}>
            <Typography variant='h5' sx={{ fontWeight: 600 }}>
                Dashboard
            </Typography>

            <Card>
                <CardContent>
                    <Typography variant='body1'>
                        Signed in as {user?.name} ({user?.role}).
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                        Catalogue tools are added here as they land.
                    </Typography>
                </CardContent>
            </Card>
        </Stack>
    );
};

export default Dashboard;
