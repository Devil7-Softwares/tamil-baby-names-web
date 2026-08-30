import { Box, CircularProgress } from '@mui/material';

export const LoadingOverlay: React.FC = () => (
    <Box
        sx={{
            flex: 1,
            minHeight: '60vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }}
    >
        <CircularProgress />
    </Box>
);
