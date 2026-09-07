import React from 'react';
import { Route, Routes } from 'react-router-dom';

import { Calculator } from './Calculator';
import { Filters } from './Filters';
import { Names } from './Names';

export const Pages: React.FC = () => {
    return (
        <Routes>
            <Route path='/' element={<Filters />} />
            <Route path='/calculator' element={<Calculator />} />
            <Route path='/names' element={<Names />} />
        </Routes>
    );
};
