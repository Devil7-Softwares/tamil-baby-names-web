import {
    Alert,
    Box,
    Chip,
    FormControlLabel,
    LinearProgress,
    Menu,
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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    AdminCluster,
    AdminClusterMember,
    AdminMeaning,
    GENDERS,
    NAME_STATUSES,
    NameStatus,
} from '@tbn/shared';
import { useState } from 'react';
import { toast } from 'react-toastify';

import { orpc } from '~/api/orpc';
import { STATUS_COLOUR, useDebounced } from '~/utils';

const ANY = 'any';

/** The status, and the only control that changes it. */
const StatusChip: React.FC<{
    status: NameStatus;
    disabled: boolean;
    onChange: (status: NameStatus) => void;
}> = ({ status, disabled, onChange }) => {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);

    return (
        <>
            <Chip
                size='small'
                label={status}
                color={STATUS_COLOUR[status]}
                disabled={disabled}
                onClick={(event) => setAnchor(event.currentTarget)}
            />

            <Menu
                anchorEl={anchor}
                open={!!anchor}
                onClose={() => setAnchor(null)}
            >
                {NAME_STATUSES.map((value) => (
                    <MenuItem
                        key={value}
                        selected={value === status}
                        onClick={() => {
                            setAnchor(null);

                            if (value !== status) {
                                onChange(value);
                            }
                        }}
                    >
                        {value}
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
};

/** Whatever the import recorded about a row, and nothing where it did not. */
const filedAs = ({ religion, language }: AdminClusterMember): string =>
    [religion, language].filter(Boolean).join(' · ');

/** The catalogue rows the cluster gathered, one line each. */
const Members: React.FC<{
    members: AdminClusterMember[];
    disabled: boolean;
    onChange: (id: number, status: NameStatus) => void;
}> = ({ members, disabled, onChange }) => (
    <Stack spacing={0.5}>
        {members.map((member) => (
            <Stack
                key={member.id}
                direction='row'
                spacing={1}
                sx={{ alignItems: 'center' }}
            >
                <StatusChip
                    status={member.status}
                    disabled={disabled}
                    onChange={(status) => onChange(member.id, status)}
                />

                <Typography variant='body2'>
                    {filedAs(member) || '—'}
                </Typography>

                <Typography variant='body2' color='text.secondary'>
                    {member.source ?? '—'}
                </Typography>
            </Stack>
        ))}
    </Stack>
);

const Meanings: React.FC<{
    meanings: AdminMeaning[];
    disabled: boolean;
    onChange: (id: number, status: NameStatus) => void;
}> = ({ meanings, disabled, onChange }) => {
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

                    <StatusChip
                        status={meaning.status}
                        disabled={disabled}
                        onChange={(status) => onChange(meaning.id, status)}
                    />
                </Stack>
            ))}
        </Stack>
    );
};

const ClusterRow: React.FC<{ cluster: AdminCluster }> = ({ cluster }) => {
    const queryClient = useQueryClient();

    // Without an input, the key matches every page and filter the reviewer has
    // visited, not just the one on screen.
    const reread = () =>
        queryClient.invalidateQueries({
            queryKey: orpc.admin.names.list.key(),
        });

    const nameStatus = useMutation(
        orpc.admin.names.setStatus.mutationOptions({
            onSuccess: reread,
            onError: () => toast.error('Could not update the name.'),
        }),
    );

    const meaningStatus = useMutation(
        orpc.admin.names.setMeaningStatus.mutationOptions({
            onSuccess: async ({ meanings }, { id }) => {
                // Publishing a reading sends the one it replaced back to the
                // pool, which is worth saying out loud: nobody asked for it.
                meanings
                    .filter((meaning) => meaning.id !== id)
                    .forEach((meaning) =>
                        toast.info(`“${meaning.text}” is a candidate again.`),
                    );

                await reread();
            },
            onError: () => toast.error('Could not update the meaning.'),
        }),
    );

    const pending = nameStatus.isPending || meaningStatus.isPending;

    return (
        <TableRow hover>
            <TableCell>
                <Stack
                    direction='row'
                    spacing={1}
                    sx={{ alignItems: 'center' }}
                >
                    <Typography variant='body2'>{cluster.name}</Typography>

                    {cluster.members.length > 1 && (
                        <Tooltip
                            title={`The import filed this name on ${cluster.members.length} rows`}
                        >
                            <Chip
                                size='small'
                                label={`×${cluster.members.length}`}
                            />
                        </Tooltip>
                    )}
                </Stack>
            </TableCell>

            <TableCell>{cluster.gender}</TableCell>

            <TableCell>
                <Members
                    members={cluster.members}
                    disabled={pending}
                    onChange={(id, status) => nameStatus.mutate({ id, status })}
                />
            </TableCell>

            <TableCell>
                <Meanings
                    meanings={cluster.meanings}
                    disabled={pending}
                    onChange={(id, status) =>
                        meaningStatus.mutate({ id, status })
                    }
                />
            </TableCell>
        </TableRow>
    );
};

const Names: React.FC = () => {
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<NameStatus | typeof ANY>(ANY);
    const [gender, setGender] = useState<string>(ANY);
    const [duplicatesOnly, setDuplicatesOnly] = useState(false);
    const [page, setPage] = useState(0);
    const [limit, setLimit] = useState(25);

    const term = useDebounced(search);

    const clusters = useQuery(
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
                        label='Filed more than once'
                    />
                </Stack>
            </Paper>

            {clusters.isError && (
                <Alert severity='error'>Could not load the catalogue.</Alert>
            )}

            <Paper>
                <Box sx={{ height: 4 }}>
                    {clusters.isFetching && <LinearProgress />}
                </Box>

                <TableContainer>
                    <Table size='small'>
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Gender</TableCell>
                                <TableCell>Rows</TableCell>
                                <TableCell>Readings</TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {clusters.data?.items.map((cluster) => (
                                <ClusterRow
                                    key={cluster.id}
                                    cluster={cluster}
                                />
                            ))}

                            {clusters.data?.items.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4}>
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
                    count={clusters.data?.total ?? 0}
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
