import DrifterStars from '@devil7softwares/react-drifter-stars';
import React, { PropsWithChildren } from 'react';

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
