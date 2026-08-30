import { createContext, useContext } from 'react';

import { SavedTheme } from '~/types';

export interface CustomThemeContextValue {
    theme: SavedTheme;
    setTheme: (theme: SavedTheme) => void;
}

export const CustomThemeContext = createContext<CustomThemeContextValue>({
    theme: SavedTheme.SYSTEM,
    setTheme: () => {},
});

export const useCustomTheme = () => useContext(CustomThemeContext);
