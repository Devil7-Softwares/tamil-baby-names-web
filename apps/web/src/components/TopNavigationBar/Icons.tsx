import React from 'react';

const svg = (children: React.ReactNode): React.ReactElement => (
    <svg
        className='icon'
        viewBox='0 0 24 24'
        fill='none'
        stroke='currentColor'
        strokeWidth={2}
        strokeLinecap='round'
        strokeLinejoin='round'
        aria-hidden='true'
        focusable='false'
    >
        {children}
    </svg>
);

export const SearchIcon: React.FC = () =>
    svg(
        <>
            <circle cx='10.5' cy='10.5' r='6.5' />
            <path d='M15.5 15.5 L21 21' />
        </>,
    );

export const CalculatorIcon: React.FC = () =>
    svg(
        <>
            <rect x='4' y='2.5' width='16' height='19' rx='2.5' />
            <path d='M8 7 h8' />
            <g strokeWidth={2.5}>
                <path d='M8.5 12 h.01M12 12 h.01M15.5 12 h.01' />
                <path d='M8.5 16.5 h.01M12 16.5 h.01M15.5 16.5 h.01' />
            </g>
        </>,
    );
