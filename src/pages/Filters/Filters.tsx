import './Filters.scss';

import axios from 'axios';
import React, { useState } from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { useLocation, useNavigate } from 'react-router-dom';

import All from '../../assets/all.png';
import Arrow from '../../assets/arrow.png';
import Astrology from '../../assets/astrology.png';
import Choose from '../../assets/choose.png';
import Christian from '../../assets/christian.png';
import GenderBoy from '../../assets/gender-boy.png';
import GenderGirl from '../../assets/gender-girl.png';
import Gender from '../../assets/gender.png';
import Hindu from '../../assets/hindu.png';
import Islam from '../../assets/islam.png';
import Religion from '../../assets/religion.png';
import Single from '../../assets/single.png';
import Twins from '../../assets/twins.png';
import { AutoLetters, Button, Card, ManualLetters } from '../../components';
import { IResponseData } from '../../interfaces';
import { useFilterState } from '../../utils';

export const Filters: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const [loading, setLoading] = useState<boolean>(false);
    const [token, setToken] = useState<string | null>(null);

    const [twinNames, setTwinNames] = useFilterState('twinNames');
    const [gender, setGender] = useFilterState('gender');
    const [religion, setReligion] = useFilterState('religion');
    const [startsWith, setStartsWith] = useFilterState('startsWith');
    const [startsWithMode, setStartsWithMode] =
        useFilterState('startsWithMode');

    const [tob] = useFilterState('tob');
    const [tz] = useFilterState('tz');

    const onTwinNamesClick = (
        e: React.MouseEvent<HTMLButtonElement, MouseEvent>
    ) => {
        const value = e.currentTarget.name === 'true';
        gtag('event', 'filters', {
            filter: 'Twin Names',
            value,
        });
        setTwinNames(value);
    };

    const onGenderClick = (
        e: React.MouseEvent<HTMLButtonElement, MouseEvent>
    ) => {
        const value = e.currentTarget.name as typeof gender;
        gtag('event', 'filters', {
            filter: 'Gender',
            value: value || 'Both',
        });
        setGender(value);
    };

    const onReligionClick = (
        e: React.MouseEvent<HTMLButtonElement, MouseEvent>
    ) => {
        const value = e.currentTarget.name as typeof religion;
        gtag('event', 'filters', {
            filter: 'Religion',
            value: value || 'All',
        });
        setReligion(value);
    };

    const onStartsWithModeClick = (
        e: React.MouseEvent<HTMLButtonElement, MouseEvent>
    ) => {
        const value = e.currentTarget.name as typeof startsWithMode;
        gtag('event', 'filters', {
            filter: 'Start With Mode',
            value,
        });
        setStartsWith([]);
        setStartsWithMode(value);
    };

    const onGenerateClick = () => {
        if (token) {
            gtag('event', 'generate', {
                filters: {
                    twinNames,
                    gender: gender || 'Both',
                    religion: religion || 'All',
                    startsWith,
                    startsWithMode,
                },
            });

            setLoading(true);
            axios
                .post<IResponseData>(
                    '/api/generate',
                    {
                        gender,
                        startsWith,
                        twinNames,
                        religion,
                        startsWithMode,
                        tob,
                        tz,
                    },
                    { headers: { token } }
                )
                .then((response) => {
                    if (response.data.success) {
                        if (window.localStorage && location.search) {
                            window.localStorage.setItem(
                                'params',
                                location.search
                            );
                        }

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
                image={Single}
                checked={!twinNames}
                onClick={onTwinNamesClick}
            >
                Single
            </Button>
            <Button
                name='true'
                image={Twins}
                checked={twinNames}
                onClick={onTwinNamesClick}
            >
                Twin
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
                onCheckedChange={onReligionClick}
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
                name='christian'
                image={Christian}
                checked={religion === 'christian'}
                onCheckedChange={onReligionClick}
            >
                Christian
            </Button>

            <h2>Starting Letter</h2>
            <Button
                image={All}
                name='none'
                checked={startsWithMode === 'none'}
                onCheckedChange={onStartsWithModeClick}
            >
                Any Letter
            </Button>
            <Button
                image={Astrology}
                name='auto'
                checked={startsWithMode === 'auto'}
                onCheckedChange={onStartsWithModeClick}
            >
                By Date &amp; Time of Birth
            </Button>
            <Button
                image={Choose}
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
