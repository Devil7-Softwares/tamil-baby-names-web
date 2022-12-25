import './ProgressOverlay.scss';

import React from 'react';

interface IProps {
    loading?: boolean;
}

export const ProgressOverlay: React.FC<IProps> = ({ loading = true }: IProps) =>
    loading ? (
        <div className='progress-overlay'>
            <div className='loader'>
                <div></div>
                <div></div>
            </div>
        </div>
    ) : null;
