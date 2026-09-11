import { createTheme, ThemeProvider, useMediaQuery } from '@mui/material';
import { PropsWithChildren, useMemo } from 'react';

import { SavedTheme } from '~/types';
import { usePersistedState } from '~/utils';

import {
    CustomThemeContext,
    CustomThemeContextValue,
} from './CustomThemeContext';

export const CustomThemeProvider: React.FC<PropsWithChildren> = ({
    children,
}) => {
    const [stored, setSavedTheme] = usePersistedState<SavedTheme>(
        'theme',
        SavedTheme.SYSTEM,
    );

    // Anything else served from this origin can leave its own value under
    // `theme` — one left it JSON-encoded, as '"system"' — and MUI throws on a
    // mode it does not know, taking the whole dashboard down with it.
    const savedTheme = Object.values(SavedTheme).includes(stored)
        ? stored
        : SavedTheme.SYSTEM;

    const systemPrefersDark = useMediaQuery('(prefers-color-scheme: dark)');

    const theme = useMemo(
        () =>
            createTheme({
                cssVariables: true,
                palette: {
                    mode:
                        savedTheme === SavedTheme.SYSTEM
                            ? systemPrefersDark
                                ? 'dark'
                                : 'light'
                            : savedTheme,
                },
                components: {
                    // An elevated Paper's top edge is hard to make out at low
                    // elevation, so give it a hairline border rather than
                    // raising the shadow. `divider` stays subtle in both modes.
                    MuiPaper: {
                        styleOverrides: {
                            elevation: ({ theme }) => ({
                                border: `1px solid ${theme.palette.divider}`,
                            }),
                        },
                    },
                },
            }),
        [savedTheme, systemPrefersDark],
    );

    const contextValue = useMemo<CustomThemeContextValue>(
        () => ({ theme: savedTheme, setTheme: setSavedTheme }),
        [savedTheme, setSavedTheme],
    );

    return (
        <CustomThemeContext.Provider value={contextValue}>
            <ThemeProvider theme={theme}>{children}</ThemeProvider>
        </CustomThemeContext.Provider>
    );
};
