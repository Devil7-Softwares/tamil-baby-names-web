import React, { PropsWithChildren } from 'react';
import DrifterStars from 'react-drifter-stars';

export const Background: React.FC<
    PropsWithChildren<Record<string, unknown>>
> = ({ children }) => {
    return (
        <div className='gradiant-background'>
            {/* <Stars /> */}
            <DrifterStars />
            {children}
        </div>
    );
};
