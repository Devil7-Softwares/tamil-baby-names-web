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

export const Names: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams(
        new URLSearchParams({ page: '1', limit: '25' })
    );

    const page = Number(searchParams.get('page'));
    const limit = Number(searchParams.get('limit'));

    const [filters, setFilters] = useState<IFilterData>({} as IFilterData);
    const [total, setTotal] = useState(0);
    const [data, setData] = useState<IName[] | ITwinName[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        axios
            .get<WithFilters<IPaginatedResponseData<IName>>>('/api/names', {
                params: { limit, page },
            })
            .then((response) => {
                if (response.data.success) {
                    setData(response.data.data);
                    setTotal(response.data.total);
                    setFilters(response.data.filters);
                }
            })
            .catch(() => {
                navigate('/');
            })
            .finally(() => setLoading(false));
    }, [page, limit]);

    useEffect(() => {
        document.title = getDocumentTitleByFilter(filters);
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
                                : '/'
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
                                    filters.twinNames
                                        ? 'auto 1fr auto 1fr'
                                        : 'auto 1fr'
                                } ${!filters.gender ? '100px' : ''} ${
                                    !filters.twinNames && !filters.religion
                                        ? '100px'
                                        : ''
                                } 100px`,
                            }}
                        >
                            <thead>
                                <tr>
                                    {filters.twinNames ? (
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
                                    {!filters.gender && <th>Gender</th>}
                                    {!filters.twinNames &&
                                        !filters.religion && <th>Religion</th>}
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
                                        {!filters.gender && (
                                            <td>
                                                {item.gender === 'boy'
                                                    ? 'ஆண்'
                                                    : 'பெண்'}
                                            </td>
                                        )}
                                        {'religion' in item &&
                                            !filters.religion && (
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
