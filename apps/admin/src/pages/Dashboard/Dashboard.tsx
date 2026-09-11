import {
    Alert,
    Box,
    Chip,
    FormControlLabel,
    LinearProgress,
    Paper,
    Stack,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    AdminActivity,
    AdminSpend,
    AdminStatusCounts,
    NAME_STATUSES,
} from '@tbn/shared';

import { orpc } from '~/api/orpc';
import { useAuth } from '~/components';
import { STATUS_COLOUR } from '~/utils';
import { formatCost, formatTokens } from '~/utils/cost';

const total = (counts: AdminStatusCounts): number =>
    NAME_STATUSES.reduce((sum, status) => sum + counts[status], 0);

/** A number, and what the statuses behind it are. */
const Counts: React.FC<{ title: string; counts: AdminStatusCounts }> = ({
    title,
    counts,
}) => (
    <Paper sx={{ p: 2, flex: 1, minWidth: 220 }}>
        <Typography variant='body2' color='text.secondary'>
            {title}
        </Typography>

        <Typography variant='h4' sx={{ fontWeight: 600, my: 0.5 }}>
            {total(counts).toLocaleString()}
        </Typography>

        <Stack direction='row' spacing={1} sx={{ flexWrap: 'wrap' }}>
            {NAME_STATUSES.filter((status) => counts[status] > 0).map(
                (status) => (
                    <Chip
                        key={status}
                        size='small'
                        color={STATUS_COLOUR[status]}
                        label={`${counts[status].toLocaleString()} ${status}`}
                    />
                ),
            )}
        </Stack>
    </Paper>
);

/**
 * One ledger entry in words. A displacement was nobody's judgment, so it says
 * what happened to the reading rather than naming a reviewer for it.
 */
const Decision: React.FC<{ entry: AdminActivity }> = ({ entry }) => (
    <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        sx={{ alignItems: { sm: 'center' } }}
    >
        <Chip
            size='small'
            // A considered entry carries the status the row *would* have
            // reached, so without the prefix it reads as something that
            // happened.
            color={
                entry.reason === 'considered'
                    ? 'default'
                    : STATUS_COLOUR[entry.toStatus]
            }
            label={
                entry.reason === 'considered'
                    ? `would: ${entry.fromStatus} → ${entry.toStatus}`
                    : `${entry.fromStatus} → ${entry.toStatus}`
            }
        />

        <Typography variant='body2' sx={{ flex: 1 }}>
            {entry.subject ?? '—'}
        </Typography>

        <Typography variant='body2' color='text.secondary'>
            {entry.reason === 'displacement'
                ? `displaced by ${entry.actor ?? 'the pipeline'}`
                : (entry.actor ?? 'the pipeline')}
            {' · '}
            {new Date(entry.at).toLocaleString()}
        </Typography>
    </Stack>
);

/** What the cloud models have cost, all told and by agent. */
const Spend: React.FC<{ spend: AdminSpend }> = ({ spend }) => (
    <Paper sx={{ p: 2 }}>
        <Typography variant='subtitle1'>AI spend</Typography>

        <Typography variant='h4' sx={{ fontWeight: 600, my: 0.5 }}>
            {formatCost(spend.total)}
        </Typography>

        <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
            Every run that recorded its tokens, at the prices it started with.
        </Typography>

        {spend.agents.length ? (
            <Box sx={{ overflowX: 'auto' }}>
                <Table size='small'>
                    <TableHead>
                        <TableRow>
                            <TableCell>Agent</TableCell>
                            <TableCell align='right'>Runs</TableCell>
                            <TableCell align='right'>Tokens in</TableCell>
                            <TableCell align='right'>Tokens out</TableCell>
                            <TableCell align='right'>Cost</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {spend.agents.map((row) => (
                            <TableRow key={row.agent}>
                                <TableCell>{row.agent}</TableCell>
                                <TableCell align='right'>
                                    {row.runs.toLocaleString()}
                                </TableCell>
                                <TableCell align='right'>
                                    {formatTokens(row.inputTokens)}
                                </TableCell>
                                <TableCell align='right'>
                                    {formatTokens(row.outputTokens)}
                                </TableCell>
                                <TableCell align='right'>
                                    {formatCost(row.cost)}
                                    {row.unpriced > 0 && (
                                        <Typography
                                            variant='caption'
                                            color='text.secondary'
                                            sx={{ display: 'block' }}
                                        >
                                            {row.unpriced} with no price
                                        </Typography>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Box>
        ) : (
            <Typography variant='body2' color='text.secondary'>
                No run has recorded its tokens yet.
            </Typography>
        )}

        {spend.unrecorded > 0 && (
            <Typography
                variant='caption'
                color='text.secondary'
                sx={{ display: 'block', mt: 1 }}
            >
                {spend.unrecorded.toLocaleString()} earlier{' '}
                {spend.unrecorded === 1 ? 'run is' : 'runs are'} from before
                tokens were recorded, and not counted.
            </Typography>
        )}
    </Paper>
);

/** What the public site serves. Reviewers see it; only an admin flips it. */
const PublicSite: React.FC<{ canChange: boolean }> = ({ canChange }) => {
    const queryClient = useQueryClient();
    const settings = useQuery(orpc.admin.settings.get.queryOptions());

    const update = useMutation(
        orpc.admin.settings.update.mutationOptions({
            onSuccess: (data) =>
                queryClient.setQueryData(
                    orpc.admin.settings.get.queryKey(),
                    data,
                ),
        }),
    );

    return (
        <Paper sx={{ p: 2 }}>
            <Typography variant='subtitle1'>Public site</Typography>

            <FormControlLabel
                control={
                    <Switch
                        checked={settings.data?.showUnreviewed ?? false}
                        disabled={
                            !canChange || !settings.data || update.isPending
                        }
                        onChange={(_event, showUnreviewed) =>
                            update.mutate({ showUnreviewed })
                        }
                    />
                }
                label='Show unreviewed names'
            />

            <Typography variant='body2' color='text.secondary'>
                Candidates appear beside the published names, with the newest
                candidate reading where none is published. Rejected names never
                appear.
            </Typography>

            {update.isError && (
                <Alert severity='error' sx={{ mt: 1 }}>
                    The setting could not be changed.
                </Alert>
            )}
        </Paper>
    );
};

const Dashboard: React.FC = () => {
    const { user } = useAuth();
    const overview = useQuery(orpc.admin.overview.get.queryOptions());

    return (
        <Stack spacing={2}>
            <Typography variant='h5' sx={{ fontWeight: 600 }}>
                Dashboard
            </Typography>

            <Typography variant='body2' color='text.secondary'>
                Signed in as {user?.name} ({user?.role}).
            </Typography>

            <PublicSite canChange={user?.role === 'admin'} />

            {overview.isFetching && <LinearProgress />}

            {overview.isError && (
                <Alert severity='error'>The catalogue could not be read.</Alert>
            )}

            {overview.data && (
                <>
                    <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={2}
                        sx={{ flexWrap: 'wrap' }}
                    >
                        <Counts
                            title='Catalogue rows'
                            counts={overview.data.names}
                        />

                        <Counts
                            title='Readings'
                            counts={overview.data.meanings}
                        />

                        <Paper sx={{ p: 2, flex: 1, minWidth: 220 }}>
                            <Typography variant='body2' color='text.secondary'>
                                Clusters
                            </Typography>

                            <Typography
                                variant='h4'
                                sx={{ fontWeight: 600, my: 0.5 }}
                            >
                                {overview.data.clusters.total.toLocaleString()}
                            </Typography>

                            <Chip
                                size='small'
                                label={`${overview.data.clusters.duplicated.toLocaleString()} filed more than once`}
                            />
                        </Paper>
                    </Stack>

                    <Spend spend={overview.data.spend} />

                    <Paper sx={{ p: 2 }}>
                        <Typography variant='subtitle1' sx={{ mb: 1 }}>
                            Recent decisions
                        </Typography>

                        {overview.data.activity.length ? (
                            <Stack spacing={1}>
                                {overview.data.activity.map((entry) => (
                                    <Decision key={entry.id} entry={entry} />
                                ))}
                            </Stack>
                        ) : (
                            <Typography variant='body2' color='text.secondary'>
                                Nothing has been reviewed yet. Decisions made on
                                the Names page are recorded here.
                            </Typography>
                        )}
                    </Paper>
                </>
            )}
        </Stack>
    );
};

export default Dashboard;
