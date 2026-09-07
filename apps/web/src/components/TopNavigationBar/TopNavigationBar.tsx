import './TopNavigationBar.scss';

import clsx from 'clsx';
import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

import Logo from '../../assets/logo.png';
import { CalculatorIcon, SearchIcon } from './Icons';

const NAV_ITEMS = [
    { to: '/', label: 'Find a name', ta: 'பெயர் தேடல்', Icon: SearchIcon },
    {
        to: '/calculator',
        label: 'Numerology',
        ta: 'எண்கணிதம்',
        Icon: CalculatorIcon,
    },
];

export const TopNavigationBar: React.FC = () => {
    const [expanded, setExpanded] = useState(false);
    const location = useLocation();

    const current = location.pathname === '/names' ? '/' : location.pathname;

    return (
        <nav className={clsx('top-nav-bar', expanded && 'expanded')}>
            <div
                className='nav-overlay'
                onClick={() => setExpanded(false)}
            ></div>

            <NavLink
                className='nav-item brand'
                to='/'
                onClick={() => setExpanded(false)}
            >
                <img src={Logo} alt='' />
                <span>Tamil Baby Names</span>
            </NavLink>

            <div className='spacer'></div>

            <ul>
                {NAV_ITEMS.map(({ to, label, ta, Icon }) => (
                    <li key={to}>
                        <NavLink
                            className={({ isActive }) =>
                                clsx(
                                    'nav-item',
                                    (isActive || current === to) && 'active',
                                )
                            }
                            to={to}
                            onClick={() => setExpanded(false)}
                        >
                            <Icon />

                            <span className='label'>
                                <span className='ta'>{ta}</span>
                                <span>{label}</span>
                            </span>
                        </NavLink>
                    </li>
                ))}
            </ul>

            <button
                type='button'
                className='nav-item expand'
                aria-label='Menu'
                aria-expanded={expanded}
                onClick={() => setExpanded(!expanded)}
            >
                <span className='bars'></span>
            </button>
        </nav>
    );
};
