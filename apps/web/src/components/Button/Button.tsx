import './Button.scss';

import clsx from 'clsx';
import React, { PropsWithChildren } from 'react';

interface IProps extends React.DetailedHTMLProps<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
> {
    image?: string;
    /** The Tamil label, shown above the English one the children carry. */
    ta?: string;
    checked?: boolean;
    onCheckedChange?: (
        e: React.MouseEvent<HTMLButtonElement, MouseEvent>,
        checked: boolean,
    ) => void;
}

export const Button: React.FC<PropsWithChildren<IProps>> = ({
    children,
    checked,
    className,
    image,
    ta,
    onCheckedChange,
    onClick,
    ...props
}) => (
    <button
        {...props}
        className={clsx(className, checked && 'checked')}
        onClick={(e) => {
            if (typeof onClick === 'function') {
                onClick(e);
            }

            if (typeof onCheckedChange === 'function') {
                onCheckedChange(e, !checked);
            }
        }}
    >
        {image && <img src={image} />}

        {ta ? (
            <span className='label'>
                <span className='ta'>{ta}</span>
                <span>{children}</span>
            </span>
        ) : (
            children
        )}
    </button>
);
