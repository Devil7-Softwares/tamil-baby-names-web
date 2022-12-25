import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Filters } from './Filters';
import { Names } from './Names';

export const Pages: React.FC = () => {
    return (
        <BrowserRouter>
            <Routes>
                <Route path='/' element={<Filters />} />
                <Route path='/names' element={<Names />} />
            </Routes>
        </BrowserRouter>
    );
};
