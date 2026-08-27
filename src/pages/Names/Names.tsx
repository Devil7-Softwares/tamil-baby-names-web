import './Names.scss';

import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Button, Card, Pagination } from '../../components';
import {
    IFilterData,
    IName,
    IPaginatedResponseData,
    ITwinName,
} from '../../interfaces';
import { WithFilters } from '../../types';
import { getDocumentTitleByFilter } from '../../utils/Common';

interface ILoadedNames {
    key: string;
    data: IName[] | ITwinName[];
    total: number;
    filters: IFilterData;
}

/** A twin pair carries a number per name; a name the method cannot read, none. */
const nameNumbers = (item: IName | ITwinName): string =>
    ('name1' in item ? [item.nameNumber1, item.nameNumber2] : [item.nameNumber])
        .map((value) => value?.toString() ?? '-')
        .join(' / ');

export const Names: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams(
        new URLSearchParams({ page: '1', limit: '25' }),
    );

    const page = Number(searchParams.get('page'));
    const limit = Number(searchParams.get('limit'));

    const [loaded, setLoaded] = useState<ILoadedNames | null>(null);

    const requestKey = `${page}|${limit}`;
    const loading = loaded?.key !== requestKey;

    const filters = loaded?.filters;
    const data = loaded?.data || [];
    const total = loaded?.total || 0;

    useEffect(() => {
        let cancelled = false;

        axios
            .get<WithFilters<IPaginatedResponseData<IName>>>('/api/names', {
                params: { limit, page },
            })
            .then((response) => {
                if (cancelled) {
                    return;
                }

                setLoaded({
                    key: `${page}|${limit}`,
                    data: response.data.success ? response.data.data : [],
                    total: response.data.success ? response.data.total : 0,
                    filters: response.data.filters,
                });
            })
            .catch(() => {
                if (!cancelled) {
                    navigate('/');
                }
            });

        return () => {
            cancelled = true;
        };
    }, [page, limit, navigate]);

    useEffect(() => {
        if (filters) {
            document.title = getDocumentTitleByFilter(filters);
        }
    }, [filters]);

    return (
        <div className='names-container'>
            <Card className='top-container'>
                <Button
                    onClick={() =>
                        navigate(
                            window.localStorage &&
                                window.localStorage.getItem('params')
                                ? `/${window.localStorage.getItem('params')}`
                                : '/',
                        )
                    }
                >
                    Back
                </Button>
                <div>
                    <div>Total Names: {total}</div>
                    <Button
                        onClick={() => {
                            gtag('event', 'export');
                            window.open('/api/export', '_blank');
                        }}
                    >
                        Download
                    </Button>
                </div>
            </Card>
            <Card className='names' loading={loading}>
                <div className='table-container'>
                    {data.length ? (
                        <table
                            style={{
                                gridTemplateColumns: `${
                                    filters?.twinNames
                                        ? 'auto 1fr auto 1fr'
                                        : 'auto 1fr'
                                } auto ${!filters?.gender ? '100px' : ''} ${
                                    !filters?.twinNames && !filters?.religion
                                        ? '100px'
                                        : ''
                                } 100px`,
                            }}
                        >
                            <thead>
                                <tr>
                                    {filters?.twinNames ? (
                                        <>
                                            <th>Name 1</th>
                                            <th>Meaning 1</th>
                                            <th>Name 2</th>
                                            <th>Meaning 2</th>
                                        </>
                                    ) : (
                                        <>
                                            <th>Name</th>
                                            <th>Meaning</th>
                                        </>
                                    )}
                                    <th>No.</th>
                                    {!filters?.gender && <th>Gender</th>}
                                    {!filters?.twinNames &&
                                        !filters?.religion && <th>Religion</th>}
                                    <th>Language</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((item) => (
                                    <tr key={`name-${item.id}`}>
                                        {'name' in item ? (
                                            <>
                                                <td>{item.name}</td>
                                                <td>{item.meaning}</td>
                                            </>
                                        ) : (
                                            <>
                                                <td>{item.name1}</td>
                                                <td>{item.meaning1}</td>
                                                <td>{item.name2}</td>
                                                <td>{item.meaning2}</td>
                                            </>
                                        )}
                                        <td className='name-number'>
                                            {nameNumbers(item)}
                                        </td>
                                        {!filters?.gender && (
                                            <td>
                                                {item.gender === 'boy'
                                                    ? 'ஆண்'
                                                    : 'பெண்'}
                                            </td>
                                        )}
                                        {'religion' in item &&
                                            !filters?.religion && (
                                                <td>{item.religion}</td>
                                            )}
                                        <td>{item.language}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div>No data!</div>
                    )}
                </div>
                <Pagination
                    currentPage={page}
                    sizePerPage={limit}
                    totalCount={total}
                    onChange={(pageNumber) => {
                        setSearchParams({
                            page: pageNumber.toString(),
                            limit: limit.toString(),
                        });
                    }}
                />
            </Card>
        </div>
    );
};
