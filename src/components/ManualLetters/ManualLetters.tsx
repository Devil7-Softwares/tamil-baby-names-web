import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { IArrayResponseData, IResponseData } from '../../interfaces';
import { Gender } from '../../types';
import { Button } from '../Button';

import './ManualLetters.scss';

interface IProps {
    gender?: Gender;
    twinNames?: boolean;
    selected: string[];
    setSelected: (value: string[]) => void;
}

export const ManualLetters: React.FC<IProps> = ({
    gender,
    twinNames,
    selected,
    setSelected,
}) => {
    const [letters, setLetters] = useState<string[]>([]);

    useEffect(() => {
        axios
            .post<IArrayResponseData<string>>('/api/letters', {
                gender,
                twinNames,
            })
            .then((response) => {
                if (response.data && response.data.success) {
                    setLetters(response.data.data);
                }
            });
    }, [gender, twinNames]);

    return (
        <div className='letters'>
            {letters.map((letter) => (
                <Button
                    key={`letter-${letter}`}
                    name={letter}
                    checked={selected.includes(letter)}
                    onCheckedChange={(e, checked) => {
                        if (checked && !selected.includes(letter)) {
                            setSelected([...selected, letter]);
                        } else if (!checked && selected.includes(letter)) {
                            setSelected(
                                selected.filter((item) => item !== letter)
                            );
                        }
                    }}
                >
                    {letter}
                </Button>
            ))}
        </div>
    );
};
