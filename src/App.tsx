import React, { useEffect } from 'react';
import { Background } from './components';

import './App.scss';
import { Pages } from './pages';

export const App: React.FC = () => {
    useEffect(() => {
        const element = document.getElementById('pre-loader');
        if (element) element.remove();
    }, []);

    return (
        <Background>
            <Pages />
        </Background>
    );
};
