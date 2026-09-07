import './Help.scss';

import clsx from 'clsx';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface IProps {
    title: { ta: string; en: string };
    ta: React.ReactNode;
    en: React.ReactNode;
}

const LANGUAGES = [
    { key: 'ta' as const, label: 'தமிழ்' },
    { key: 'en' as const, label: 'English' },
];

/**
 * Panjangam and Numerology ask the reader to choose between methods whose names
 * mean nothing unless they already know, and the choice changes which names
 * they are shown.
 */
export const Help: React.FC<IProps> = ({ title, ta, en }) => {
    const [open, setOpen] = useState(false);
    const [language, setLanguage] = useState<'ta' | 'en'>('ta');

    useEffect(() => {
        if (!open) {
            return;
        }

        const escape = (event: KeyboardEvent): void => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };

        window.addEventListener('keydown', escape);

        return () => window.removeEventListener('keydown', escape);
    }, [open]);

    // Portalled out of the <label>, where a press on the backdrop activated the
    // button that opened it, and out of `card`, whose backdrop-filter makes it
    // the containing block for `position: fixed`.
    const dialog = (
        <div
            className='help-backdrop'
            role='dialog'
            aria-modal='true'
            aria-label={title.en}
            onClick={() => setOpen(false)}
        >
            {/* Inside the backdrop, which closes on a press. */}
            <div
                className='help-dialog'
                onClick={(event) => event.stopPropagation()}
            >
                <header>
                    <h3>
                        {title.ta} / {title.en}
                    </h3>

                    <button
                        type='button'
                        className='close'
                        aria-label='Close'
                        onClick={() => setOpen(false)}
                    >
                        ×
                    </button>
                </header>

                <nav className='tabs'>
                    {LANGUAGES.map(({ key, label }) => (
                        <button
                            key={key}
                            type='button'
                            className={clsx(language === key && 'on')}
                            aria-pressed={language === key}
                            onClick={() => setLanguage(key)}
                        >
                            {label}
                        </button>
                    ))}
                </nav>

                <div className='body'>{language === 'ta' ? ta : en}</div>
            </div>
        </div>
    );

    return (
        <>
            <button
                type='button'
                className='help-icon'
                aria-label={`${title.en} — what is this?`}
                onClick={() => setOpen(true)}
            >
                i
            </button>

            {open && createPortal(dialog, document.body)}
        </>
    );
};
