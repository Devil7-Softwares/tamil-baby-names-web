import React from 'react';
import Arrow from '../../assets/arrow.png';
import Gender from '../../assets/gender.png';
import GenderBoy from '../../assets/gender-boy.png';
import GenderGirl from '../../assets/gender-girl.png';
import Religion from '../../assets/religion.png';
import Hindu from '../../assets/hindu.png';
import Islam from '../../assets/islam.png';
import Christian from '../../assets/christian.png';
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
    const [religion, setReligion] = useState<IFilterData['religion']>();
    const [startsWith, setStartsWith] = useState<IFilterData['startsWith']>();
    const [token, setToken] = useState<string | null>(null);

    const [startsWithMode, setStartsWithMode] = useState<
        'none' | 'auto' | 'manual'
    >('none');

    const onTwinNamesClick = (
        e: React.MouseEvent<HTMLButtonElement, MouseEvent>
    ) => {
        const value = Boolean(e.currentTarget.name);
        setTwinNames(value);
    };

    const onGenderClick = (
        e: React.MouseEvent<HTMLButtonElement, MouseEvent>
    ) => {
        const value = e.currentTarget.name as typeof gender;
        setGender(value);
    };

    const onReligionClick = (
        e: React.MouseEvent<HTMLButtonElement, MouseEvent>
    ) => {
        const value = e.currentTarget.name as typeof religion;
        setReligion(value);
    };

    const onStartsWithModeClick = (
        e: React.MouseEvent<HTMLButtonElement, MouseEvent>
    ) => {
        const value = e.currentTarget.name as typeof startsWithMode;
        setStartsWithMode(value);
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
                        religion,
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
            <Button
                name='false'
                checked={!twinNames}
                onClick={onTwinNamesClick}
            >
                Single Names
            </Button>
            <Button name='true' checked={twinNames} onClick={onTwinNamesClick}>
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

            <h2>Religion</h2>
            <Button
                image={Religion}
                checked={!religion}
                onCheckedChange={onGenderClick}
            >
                All
            </Button>
            <Button
                name='hindu'
                image={Hindu}
                checked={religion === 'hindu'}
                onCheckedChange={onReligionClick}
            >
                Hindu
            </Button>
            <Button
                name='muslim'
                image={Islam}
                checked={religion === 'muslim'}
                onCheckedChange={onReligionClick}
            >
                Muslim
            </Button>
            <Button
                name='chiristian'
                image={Christian}
                checked={religion === 'christian'}
                onCheckedChange={onReligionClick}
            >
                Christian
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
