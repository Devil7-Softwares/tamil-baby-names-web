import React, { useEffect } from 'react';
import { Background } from './components';

import './App.scss';
import { Pages } from './pages';
import { FilterStateProvider } from './utils';
import { BrowserRouter } from 'react-router-dom';

export const App: React.FC = () => {
    useEffect(() => {
        const element = document.getElementById('pre-loader');
        if (element) element.remove();
    }, []);

    return (
        <BrowserRouter>
            <FilterStateProvider>
                <Background>
                    <Pages />
                </Background>
            </FilterStateProvider>
        </BrowserRouter>
    );
};
