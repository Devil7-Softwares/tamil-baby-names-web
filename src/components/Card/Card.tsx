import clsx from 'clsx';
import React, { PropsWithChildren } from 'react';
import { ProgressOverlay } from '../ProgressOverlay';

import './Card.scss';

interface IProps {
    className?: string;
    loading?: boolean;
}

export const Card: React.FC<PropsWithChildren<IProps>> = ({
    children,
    className,
    loading,
}) => {
    return (
        <div className={clsx('card', className)}>
            {children}
            <ProgressOverlay loading={!!loading} />
        </div>
    );
};
