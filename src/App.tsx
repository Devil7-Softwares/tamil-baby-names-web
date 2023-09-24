import './App.scss';

import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';

import { Background } from './components';
import { Pages } from './pages';
import { FilterStateProvider } from './utils';

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
