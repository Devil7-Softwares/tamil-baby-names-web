import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import SettingsBrightnessOutlinedIcon from '@mui/icons-material/SettingsBrightnessOutlined';
import { IconButton, Tooltip } from '@mui/material';

import { useCustomTheme } from '~/components/CustomThemeProvider';
import { SavedTheme } from '~/types';

const NEXT: Record<SavedTheme, SavedTheme> = {
    [SavedTheme.SYSTEM]: SavedTheme.LIGHT,
    [SavedTheme.LIGHT]: SavedTheme.DARK,
    [SavedTheme.DARK]: SavedTheme.SYSTEM,
};

const ICONS: Record<SavedTheme, React.ReactNode> = {
    [SavedTheme.SYSTEM]: <SettingsBrightnessOutlinedIcon />,
    [SavedTheme.LIGHT]: <LightModeOutlinedIcon />,
    [SavedTheme.DARK]: <DarkModeOutlinedIcon />,
};

export const ThemeToggle: React.FC = () => {
    const { theme, setTheme } = useCustomTheme();

    return (
        <Tooltip title={`Theme: ${theme}`}>
            <IconButton
                color='inherit'
                aria-label='Change theme'
                onClick={() => setTheme(NEXT[theme])}
            >
                {ICONS[theme]}
            </IconButton>
        </Tooltip>
    );
};
