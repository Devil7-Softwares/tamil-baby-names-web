import {
    Alert,
    Box,
    Chip,
    FormControlLabel,
    LinearProgress,
    MenuItem,
    Paper,
    Stack,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import {
    AdminMeaning,
    AdminName,
    GENDERS,
    NAME_STATUSES,
    NameStatus,
} from '@tbn/shared';
import { useState } from 'react';

import { orpc } from '~/api/orpc';
import { useDebounced } from '~/utils';

const STATUS_COLOUR: Record<NameStatus, 'success' | 'warning' | 'default'> = {
    published: 'success',
    candidate: 'warning',
    rejected: 'default',
};

const ANY = 'any';

const Meanings: React.FC<{ meanings: AdminMeaning[] }> = ({ meanings }) => {
    if (!meanings.length) {
        return (
            <Typography variant='body2' color='text.secondary'>
                No meaning recorded
            </Typography>
        );
    }

    return (
        <Stack spacing={0.5}>
            {meanings.map((meaning) => (
                <Stack
                    key={meaning.id}
                    direction='row'
                    spacing={1}
                    sx={{ alignItems: 'center' }}
                >
                    <Typography variant='body2'>{meaning.text}</Typography>

                    {meaning.status !== 'published' && (
                        <Chip
                            size='small'
                            label={meaning.status}
                            color={STATUS_COLOUR[meaning.status]}
                        />
                    )}
                </Stack>
            ))}
        </Stack>
    );
};

const NameRow: React.FC<{ row: AdminName }> = ({ row }) => (
    <TableRow hover>
        <TableCell>
            <Stack direction='row' spacing={1} sx={{ alignItems: 'center' }}>
                <Typography variant='body2'>{row.name}</Typography>

                {row.duplicates > 1 && (
                    <Tooltip
                        title={`The catalogue holds this name on ${row.duplicates} rows`}
                    >
                        <Chip size='small' label={`×${row.duplicates}`} />
                    </Tooltip>
                )}
            </Stack>
        </TableCell>

        <TableCell>{row.gender}</TableCell>
        <TableCell>{row.religion}</TableCell>
        <TableCell>{row.language}</TableCell>

        <TableCell>
            <Chip
                size='small'
                label={row.status}
                color={STATUS_COLOUR[row.status]}
            />
        </TableCell>

        <TableCell>
            <Meanings meanings={row.meanings} />
        </TableCell>

        <TableCell>
            <Typography variant='body2' color='text.secondary'>
                {row.source ?? '—'}
            </Typography>
        </TableCell>
    </TableRow>
);

const Names: React.FC = () => {
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<NameStatus | typeof ANY>(ANY);
    const [gender, setGender] = useState<string>(ANY);
    const [duplicatesOnly, setDuplicatesOnly] = useState(false);
    const [page, setPage] = useState(0);
    const [limit, setLimit] = useState(25);

    const term = useDebounced(search);

    const names = useQuery(
        orpc.admin.names.list.queryOptions({
            input: {
                page: page + 1,
                limit,
                ...(term ? { search: term } : {}),
                ...(status === ANY ? {} : { status }),
                ...(gender === ANY ? {} : { gender: gender as 'boy' | 'girl' }),
                ...(duplicatesOnly ? { duplicatesOnly } : {}),
            },
            // Keeps the previous page on screen while the next one loads, so
            // the table does not collapse on every keystroke.
            placeholderData: (previous) => previous,
        }),
    );

    // Any filter change re-reads from the first page; page 9 of a narrower
    // result set is usually empty.
    const onFilterChange =
        <T,>(set: (value: T) => void) =>
        (value: T) => {
            set(value);
            setPage(0);
        };

    return (
        <Stack spacing={2}>
            <Typography variant='h5' sx={{ fontWeight: 600 }}>
                Names
            </Typography>

            <Paper sx={{ p: 2 }}>
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={2}
                    sx={{ alignItems: { md: 'center' } }}
                >
                    <TextField
                        label='Search'
                        size='small'
                        value={search}
                        onChange={(event) =>
                            onFilterChange(setSearch)(event.target.value)
                        }
                        sx={{ minWidth: 220 }}
                    />

                    <TextField
                        select
                        label='Status'
                        size='small'
                        value={status}
                        onChange={(event) =>
                            onFilterChange(setStatus)(
                                event.target.value as NameStatus,
                            )
                        }
                        sx={{ minWidth: 150 }}
                    >
                        <MenuItem value={ANY}>Any</MenuItem>
                        {NAME_STATUSES.map((value) => (
                            <MenuItem key={value} value={value}>
                                {value}
                            </MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        select
                        label='Gender'
                        size='small'
                        value={gender}
                        onChange={(event) =>
                            onFilterChange(setGender)(event.target.value)
                        }
                        sx={{ minWidth: 150 }}
                    >
                        <MenuItem value={ANY}>Any</MenuItem>
                        {GENDERS.map((value) => (
                            <MenuItem key={value} value={value}>
                                {value}
                            </MenuItem>
                        ))}
                    </TextField>

                    <FormControlLabel
                        control={
                            <Switch
                                checked={duplicatesOnly}
                                onChange={(event) =>
                                    onFilterChange(setDuplicatesOnly)(
                                        event.target.checked,
                                    )
                                }
                            />
                        }
                        label='Held more than once'
                    />
                </Stack>
            </Paper>

            {names.isError && (
                <Alert severity='error'>Could not load the catalogue.</Alert>
            )}

            <Paper>
                <Box sx={{ height: 4 }}>
                    {names.isFetching && <LinearProgress />}
                </Box>

                <TableContainer>
                    <Table size='small'>
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Gender</TableCell>
                                <TableCell>Religion</TableCell>
                                <TableCell>Language</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Meanings</TableCell>
                                <TableCell>Source</TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {names.data?.items.map((row) => (
                                <NameRow key={row.id} row={row} />
                            ))}

                            {names.data?.items.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7}>
                                        <Typography
                                            variant='body2'
                                            color='text.secondary'
                                        >
                                            No names match these filters.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                <TablePagination
                    component='div'
                    count={names.data?.total ?? 0}
                    page={page}
                    onPageChange={(_, next) => setPage(next)}
                    rowsPerPage={limit}
                    rowsPerPageOptions={[25, 50, 100]}
                    onRowsPerPageChange={(event) => {
                        setLimit(Number(event.target.value));
                        setPage(0);
                    }}
                />
            </Paper>
        </Stack>
    );
};

export default Names;
