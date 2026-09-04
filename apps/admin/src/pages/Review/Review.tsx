import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import {
    Alert,
    Box,
    Button,
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
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminReviewRun, isSettled, ReviewRunStatus } from '@tbn/shared';
import { useState } from 'react';
import { toast } from 'react-toastify';

import { orpc } from '~/api/orpc';

const BATCHES = [10, 25, 100, 500, 2000];

/**
 * Clusters per request. Off is one at a time, which is how every calibration
 * figure behind the model comparison was measured — so it stays the default
 * and anything else is a deliberate choice.
 */
const PER_REQUEST = [1, 5, 10, 25];

/** While anything is moving, ask again; otherwise leave the server alone. */
const POLL = 1500;

const STATUS_COLOUR: Record<
    ReviewRunStatus,
    'info' | 'success' | 'warning' | 'error'
> = {
    running: 'info',
    finished: 'success',
    cancelled: 'warning',
    failed: 'error',
};

const counted = (value: number, one: string, many: string): string =>
    `${value.toLocaleString()} ${value === 1 ? one : many}`;

/** What a finished run did, in the words the command line uses. */
const did = (run: AdminReviewRun): string => {
    const summary =
        [
            run.published && counted(run.published, 'published', 'published'),
            run.rejected &&
                counted(run.rejected, 'reading rejected', 'readings rejected'),
            run.added && counted(run.added, 'written', 'written'),
            run.dropped && counted(run.dropped, 'row dropped', 'rows dropped'),
            run.abstained && `${run.abstained} left alone`,
            run.unchanged && `${run.unchanged} already right`,
            run.failed && `${run.failed} unreadable`,
        ]
            .filter(Boolean)
            .join(' · ') || 'nothing yet';

    // The counts of a run that wrote nothing say what it would have done, and
    // reading them as what it did would be exactly wrong.
    return run.applied ? summary : `would have: ${summary}`;
};

const when = (iso: string): string => new Date(iso).toLocaleString();

const Progress: React.FC<{ run: AdminReviewRun; onStop: () => void }> = ({
    run,
    onStop,
}) => {
    const done = run.reviewed + run.failed;

    return (
        <Paper sx={{ p: 2 }}>
            <Stack
                direction='row'
                spacing={2}
                sx={{ alignItems: 'center', mb: 1 }}
            >
                <Typography variant='subtitle1' sx={{ flex: 1 }}>
                    Run #{run.id} · {run.agent}
                    {run.compareWith ? ` · re-asking #${run.compareWith}` : ''}
                    {run.applied ? '' : ' · changing nothing'}
                    {run.batch > 1 ? ` · ${run.batch} per request` : ''}
                </Typography>

                <Typography variant='body2' color='text.secondary'>
                    {done.toLocaleString()} / {run.total.toLocaleString()}
                </Typography>

                <Button
                    size='small'
                    color='warning'
                    startIcon={<StopIcon />}
                    onClick={onStop}
                >
                    Stop
                </Button>
            </Stack>

            <LinearProgress
                variant={run.total ? 'determinate' : 'indeterminate'}
                value={run.total ? (done / run.total) * 100 : 0}
            />

            <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
                {did(run)}
            </Typography>
        </Paper>
    );
};

const Review: React.FC = () => {
    const [agentId, setAgentId] = useState<number | ''>('');
    const [limit, setLimit] = useState(25);
    const [compareWith, setCompareWith] = useState<number | ''>('');
    const [applied, setApplied] = useState(true);
    const [unwritten, setUnwritten] = useState(false);
    const [batch, setBatch] = useState(1);

    const queryClient = useQueryClient();

    const overview = useQuery(
        orpc.admin.review.overview.queryOptions({
            // A run writes its counts as it goes, so the page follows it
            // without holding anything open.
            refetchInterval: (query) =>
                query.state.data?.runs.some(({ status }) => !isSettled(status))
                    ? POLL
                    : false,
        }),
    );

    const reread = () =>
        queryClient.invalidateQueries({
            queryKey: orpc.admin.review.overview.key(),
        });

    const start = useMutation(
        orpc.admin.review.start.mutationOptions({
            onSuccess: async (run) => {
                toast.success(
                    `Reviewing ${counted(run.total, 'cluster', 'clusters')} with “${run.agent}”.`,
                );
                await reread();
            },
            onError: (error) => toast.error(error.message),
        }),
    );

    const cancel = useMutation(
        orpc.admin.review.cancel.mutationOptions({
            onSuccess: reread,
            onError: (error) => toast.error(error.message),
        }),
    );

    const agents = overview.data?.agents ?? [];
    const runs = overview.data?.runs ?? [];
    const active = runs.filter(({ status }) => !isSettled(status));
    const chosen = agents.find(({ id }) => id === agentId);
    const askable = runs.filter((run) => isSettled(run.status) && run.reviewed);
    const source = runs.find(({ id }) => id === compareWith);

    const waiting = !chosen
        ? 'Pick an agent to see what is waiting for it.'
        : source
          ? `${counted(source.reviewed, 'cluster', 'clusters')} run #${source.id} looked at`
          : unwritten
            ? `${chosen.unwritten.toLocaleString()} of them hold no reading at all`
            : `${chosen.pending.toLocaleString()} clusters waiting on this agent`;

    return (
        <Stack spacing={2}>
            <Typography variant='h5' sx={{ fontWeight: 600 }}>
                LLM review
            </Typography>

            <Typography variant='body2' color='text.secondary'>
                An agent reads a cluster and decides which reading is right.
                What it is unsure of it leaves alone and marks, so a person can
                go through those rather than everything. It never touches what a
                person published.
            </Typography>

            {agents.length === 0 && !overview.isLoading && (
                <Alert severity='info'>
                    No agents are configured yet. Add one on the Agents page — a
                    local Ollama needs no key.
                </Alert>
            )}

            <Paper sx={{ p: 2 }}>
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={2}
                    sx={{ alignItems: { md: 'center' } }}
                >
                    <TextField
                        select
                        label='Agent'
                        size='small'
                        value={agentId}
                        onChange={(event) =>
                            setAgentId(Number(event.target.value))
                        }
                        sx={{ minWidth: 240 }}
                    >
                        {agents.map((agent) => (
                            <MenuItem
                                key={agent.id}
                                value={agent.id}
                                disabled={
                                    !agent.enabled ||
                                    (!agent.pending && !compareWith)
                                }
                            >
                                {agent.name} · {agent.model}
                                {agent.enabled ? '' : ' — off'}
                            </MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        select
                        label='How many'
                        size='small'
                        value={limit}
                        onChange={(event) =>
                            setLimit(Number(event.target.value))
                        }
                        sx={{ minWidth: 140 }}
                    >
                        {BATCHES.map((size) => (
                            <MenuItem key={size} value={size}>
                                {size.toLocaleString()}
                            </MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        select
                        label='Same clusters as'
                        size='small'
                        value={compareWith}
                        onChange={(event) =>
                            setCompareWith(
                                event.target.value === ''
                                    ? ''
                                    : Number(event.target.value),
                            )
                        }
                        sx={{ minWidth: 200 }}
                    >
                        <MenuItem value=''>The queue</MenuItem>
                        {askable.map((run) => (
                            <MenuItem key={run.id} value={run.id}>
                                Run #{run.id} · {run.agent}
                            </MenuItem>
                        ))}
                    </TextField>

                    <Tooltip title='How many names go in one request. The standing instructions are most of a request, so asking together costs far less — and buys it by making each name a slot in a list rather than a question of its own. Every measurement of how these models behave was taken one at a time.'>
                        <TextField
                            select
                            label='Per request'
                            size='small'
                            value={batch}
                            onChange={(event) =>
                                setBatch(Number(event.target.value))
                            }
                            sx={{ minWidth: 130 }}
                        >
                            {PER_REQUEST.map((size) => (
                                <MenuItem key={size} value={size}>
                                    {size === 1 ? 'One at a time' : size}
                                </MenuItem>
                            ))}
                        </TextField>
                    </Tooltip>

                    <Tooltip title='Only names that hold no reading at all. A different job from choosing between rival readings — the model is being asked to write one — and the queue would not reach them for a long time otherwise.'>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={unwritten}
                                    disabled={!!compareWith}
                                    onChange={(event) =>
                                        setUnwritten(event.target.checked)
                                    }
                                />
                            }
                            label='Only unwritten'
                        />
                    </Tooltip>

                    <Tooltip title='Record what the agent would do and change nothing, so another agent can be asked the same question from the same starting point.'>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={!applied}
                                    onChange={(event) =>
                                        setApplied(!event.target.checked)
                                    }
                                />
                            }
                            label='Change nothing'
                        />
                    </Tooltip>

                    <Typography variant='body2' sx={{ flex: 1 }}>
                        {waiting}
                    </Typography>

                    <Button
                        variant='contained'
                        startIcon={<PlayArrowIcon />}
                        disabled={!chosen || start.isPending}
                        onClick={() =>
                            chosen &&
                            start.mutate({
                                agentId: chosen.id,
                                limit,
                                compareWith: compareWith || null,
                                applied,
                                unwritten,
                                batch,
                            })
                        }
                    >
                        Review
                    </Button>
                </Stack>
            </Paper>

            {active.map((run) => (
                <Progress
                    key={run.id}
                    run={run}
                    onStop={() => cancel.mutate({ id: run.id })}
                />
            ))}

            <Paper>
                <Box sx={{ height: 4 }}>
                    {overview.isFetching && <LinearProgress />}
                </Box>

                <TableContainer>
                    <Table size='small'>
                        <TableHead>
                            <TableRow>
                                <TableCell>Run</TableCell>
                                <TableCell>Agent</TableCell>
                                <TableCell>Started</TableCell>
                                <TableCell>Looked at</TableCell>
                                <TableCell>What it did</TableCell>
                                <TableCell>Ended</TableCell>
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {runs.map((run) => (
                                <TableRow key={run.id} hover>
                                    <TableCell>
                                        #{run.id}
                                        {run.batch > 1 && (
                                            <Typography
                                                variant='caption'
                                                color='text.secondary'
                                                sx={{ display: 'block' }}
                                            >
                                                {run.batch} per request
                                            </Typography>
                                        )}
                                        {run.compareWith && (
                                            <Typography
                                                variant='caption'
                                                color='text.secondary'
                                                sx={{ display: 'block' }}
                                            >
                                                re-asked #{run.compareWith}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>{run.agent}</TableCell>
                                    <TableCell>{when(run.startedAt)}</TableCell>
                                    <TableCell>
                                        {(
                                            run.reviewed + run.failed
                                        ).toLocaleString()}{' '}
                                        / {run.total.toLocaleString()}
                                    </TableCell>
                                    <TableCell>{did(run)}</TableCell>
                                    <TableCell>
                                        {run.error ? (
                                            <Tooltip title={run.error}>
                                                <Chip
                                                    size='small'
                                                    color={
                                                        STATUS_COLOUR[
                                                            run.status
                                                        ]
                                                    }
                                                    label={run.status}
                                                />
                                            </Tooltip>
                                        ) : (
                                            <Chip
                                                size='small'
                                                color={
                                                    STATUS_COLOUR[run.status]
                                                }
                                                label={run.status}
                                            />
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}

                            {runs.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6}>
                                        <Typography
                                            variant='body2'
                                            color='text.secondary'
                                        >
                                            Nothing has been reviewed yet.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Stack>
    );
};

export default Review;
