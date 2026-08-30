import { CssBaseline } from '@mui/material';
import { ToastContainer } from 'react-toastify';

import { CustomThemeProvider } from '~/components';

import { Pages } from './pages';

export const App: React.FC = () => (
    <CustomThemeProvider>
        <CssBaseline />

        <Pages />

        <ToastContainer position='bottom-right' />
    </CustomThemeProvider>
);
