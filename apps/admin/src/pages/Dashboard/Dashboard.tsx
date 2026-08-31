import {
    Alert,
    Chip,
    LinearProgress,
    Paper,
    Stack,
    Typography,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { AdminActivity, AdminStatusCounts, NAME_STATUSES } from '@tbn/shared';

import { orpc } from '~/api/orpc';
import { useAuth } from '~/components';
import { STATUS_COLOUR } from '~/utils';

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
            color={STATUS_COLOUR[entry.toStatus]}
            label={`${entry.fromStatus} → ${entry.toStatus}`}
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
