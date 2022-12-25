import React from 'react';
import Arrow from '../../assets/arrow.png';
import Gender from '../../assets/gender.png';
import GenderBoy from '../../assets/gender-boy.png';
import GenderGirl from '../../assets/gender-girl.png';
import { Card, Button, ManualLetters, AutoLetters } from '../../components';
import ReCAPTCHA from 'react-google-recaptcha';

import './Filters.scss';
import { useState } from 'react';
import { IFilterData, IResponseData } from '../../interfaces';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export const Filters: React.FC = () => {
    const navigate = useNavigate();

    const [loading, setLoading] = useState<boolean>(false);
    const [twinNames, setTwinNames] = useState<IFilterData['twinNames']>();
    const [gender, setGender] = useState<IFilterData['gender']>();
    const [startsWith, setStartsWith] = useState<IFilterData['startsWith']>();
    const [token, setToken] = useState<string | null>(null);

    const [startsWithMode, setStartsWithMode] = useState<
        'none' | 'auto' | 'manual'
    >('none');

    const onGenderClick = (
        e: React.MouseEvent<HTMLButtonElement, MouseEvent>
    ) => {
        setGender(e.currentTarget.name as typeof gender);
    };

    const onStartsWithModeClick = (
        e: React.MouseEvent<HTMLButtonElement, MouseEvent>
    ) => {
        setStartsWithMode(e.currentTarget.name as typeof startsWithMode);
    };

    const onGenerateClick = () => {
        if (token) {
            setLoading(true);
            axios
                .post<IResponseData>(
                    '/api/generate',
                    {
                        gender,
                        startsWith,
                        twinNames,
                    },
                    { headers: { token } }
                )
                .then((response) => {
                    if (response.data.success) {
                        navigate('/names');
                    }
                })
                .finally(() => {
                    setLoading(false);
                });
        }
    };

    return (
        <Card className='filters' loading={loading}>
            <h2>Name Type</h2>
            <Button checked={!twinNames} onClick={() => setTwinNames(false)}>
                Single Names
            </Button>
            <Button checked={twinNames} onClick={() => setTwinNames(true)}>
                Twin Names
            </Button>

            <h2>Gender</h2>
            <Button
                image={Gender}
                checked={!gender || !gender.length}
                onCheckedChange={onGenderClick}
            >
                Both
            </Button>
            <Button
                name='boy'
                image={GenderBoy}
                checked={gender?.includes('boy')}
                onCheckedChange={onGenderClick}
            >
                Boy
            </Button>
            <Button
                name='girl'
                image={GenderGirl}
                checked={gender?.includes('girl')}
                onCheckedChange={onGenderClick}
            >
                Girl
            </Button>

            <h2>Starting Letter</h2>
            <Button
                name='none'
                checked={startsWithMode === 'none'}
                onCheckedChange={onStartsWithModeClick}
            >
                Any Letter
            </Button>
            <Button
                name='auto'
                checked={startsWithMode === 'auto'}
                onCheckedChange={onStartsWithModeClick}
            >
                By Date &amp; Time of Birth
            </Button>
            <Button
                name='manual'
                checked={startsWithMode === 'manual'}
                onCheckedChange={onStartsWithModeClick}
            >
                Select Letters
            </Button>

            {startsWithMode === 'auto' ? (
                <AutoLetters setStartsWith={setStartsWith} />
            ) : startsWithMode === 'manual' ? (
                <ManualLetters
                    gender={gender}
                    twinNames={twinNames}
                    selected={startsWith || []}
                    setSelected={setStartsWith}
                />
            ) : null}

            <div className='splitter'></div>

            <ReCAPTCHA
                className='recaptcha'
                sitekey={process.env.RECAPTCHA_SITE_KEY || ''}
                onChange={setToken}
            />

            {token && (
                <Button
                    className='generate'
                    image={Arrow}
                    onClick={onGenerateClick}
                >
                    Generate
                </Button>
            )}
        </Card>
    );
};
