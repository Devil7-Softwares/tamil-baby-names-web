import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import FormatQuoteOutlinedIcon from '@mui/icons-material/FormatQuoteOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
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
    AdminCitation,
    AdminCitedMeaning,
    AdminCluster,
    AdminClusterMember,
    AdminProposal,
    AdminVerdict,
    AgentReviewFilter,
    GENDERS,
    NAME_STATUSES,
    NameStatus,
    RUN_OUTCOMES,
    RunOutcome,
} from '@tbn/shared';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';

import { orpc } from '~/api/orpc';
import { STATUS_COLOUR, useDebounced } from '~/utils';

const ANY = 'any';

const AGENT_REVIEW: Array<{ value: AgentReviewFilter; label: string }> = [
    { value: 'decided', label: 'An agent decided' },
    { value: 'unsure', label: 'An agent was unsure' },
    { value: 'unchanged', label: 'An agent found it already right' },
    { value: 'considered', label: 'An agent only gave an opinion' },
    { value: 'suggested', label: 'Two or more suggested a meaning' },
    { value: 'none', label: 'No agent has looked' },
];

/** Ceilings, not thresholds: "show me what it was at most this sure of". */
const CONFIDENCE = [90, 75, 60];

/**
 * What a run did, in the words its own report uses, so the label a person
 * clicked on the Review page is the label they land on here.
 */
const RUN_OUTCOME_LABEL: Record<RunOutcome, string> = {
    written: 'Wrote a reading',
    published: 'Published a reading',
    rejected: 'Rejected a reading',
    dropped: 'Dropped the row',
    abstained: 'Left alone — unsure',
    unchanged: 'Left alone — already right',
    considered: 'Only gave an opinion',
    failed: 'Could not be asked',
};

const isOutcome = (value: string | null): value is RunOutcome =>
    !!value && (RUN_OUTCOMES as readonly string[]).includes(value);

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

/**
 * Where the sources said it. A reviewer choosing between two readings is
 * choosing between what is behind them, and the slug alone does not say.
 */
const Citations: React.FC<{ citations: AdminCitation[] }> = ({ citations }) => {
    if (!citations.length) {
        return null;
    }

    return (
        <Tooltip
            title={
                <Stack spacing={0.5}>
                    {citations.map((citation) => (
                        <Box key={citation.id}>
                            <Typography
                                variant='caption'
                                sx={{ display: 'block', fontWeight: 600 }}
                            >
                                {citation.source ?? 'Unknown source'} ·{' '}
                                {citation.locator}
                            </Typography>

                            {citation.excerpt && (
                                <Typography variant='caption'>
                                    “{citation.excerpt}”
                                </Typography>
                            )}
                        </Box>
                    ))}
                </Stack>
            }
        >
            <FormatQuoteOutlinedIcon fontSize='small' color='action' />
        </Tooltip>
    );
};

/**
 * What an agent made of this cluster, and how sure it said it was.
 *
 * The confidence is shown as the model's own claim rather than as a fact,
 * because it is one: a small model reports 85 on names it has never met. It is
 * here so a person can decide what to re-read, not so they can trust it.
 */
const Verdict: React.FC<{ verdict: AdminVerdict }> = ({ verdict }) => (
    <Tooltip
        title={
            <Stack spacing={0.5}>
                <Typography variant='caption' sx={{ fontWeight: 600 }}>
                    {verdict.agent}
                    {verdict.confidence === null
                        ? ''
                        : ` · said ${verdict.confidence}% sure`}
                </Typography>

                {verdict.note && (
                    <Typography variant='caption'>{verdict.note}</Typography>
                )}

                <Typography variant='caption' sx={{ opacity: 0.7 }}>
                    {verdict.abstained
                        ? 'It would not decide, so nothing was changed.'
                        : verdict.unchanged
                          ? 'It was sure this was already right, and changed nothing.'
                          : verdict.considered
                            ? 'It was asked without being allowed to write. Nothing was changed.'
                            : 'It changed this. Nobody has checked it since.'}
                </Typography>
            </Stack>
        }
    >
        <Chip
            size='small'
            variant='outlined'
            color={
                verdict.abstained
                    ? 'warning'
                    : verdict.unchanged
                      ? 'success'
                      : verdict.considered
                        ? 'default'
                        : 'info'
            }
            icon={
                verdict.abstained ? (
                    <HelpOutlineOutlinedIcon />
                ) : (
                    <SmartToyOutlinedIcon />
                )
            }
            label={
                verdict.confidence === null ? 'AI' : `AI ${verdict.confidence}`
            }
        />
    </Tooltip>
);

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

                {member.notes && (
                    <Tooltip title={member.notes}>
                        <InfoOutlinedIcon fontSize='small' color='disabled' />
                    </Tooltip>
                )}

                <Typography variant='body2' color='text.secondary'>
                    {member.source ?? '—'}
                </Typography>

                <Citations citations={member.citations} />
            </Stack>
        ))}
    </Stack>
);

const Meanings: React.FC<{
    meanings: AdminCitedMeaning[];
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

                    <Citations citations={meaning.citations} />
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

                    {cluster.verdict && <Verdict verdict={cluster.verdict} />}

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

                {cluster.proposals.length > 0 && (
                    <Proposals proposals={cluster.proposals} />
                )}
            </TableCell>
        </TableRow>
    );
};

/**
 * What agents said they would write, where nothing was written.
 *
 * Shown as a list rather than reduced to an "they agree" flag: deciding by
 * machine whether two Tamil paraphrases mean the same thing is exactly the
 * guess that would quietly mislead, and two lines side by side let a person see
 * it in a second. Greyed where the agent was below the bar — it is still worth
 * reading, but it is not a second opinion.
 */
const Proposals: React.FC<{ proposals: AdminProposal[] }> = ({ proposals }) => (
    <Stack spacing={0.5} sx={{ mt: 1 }}>
        {proposals.map((proposal) => (
            <Stack
                key={proposal.agent}
                direction='row'
                spacing={1}
                sx={{ alignItems: 'baseline' }}
            >
                <Chip
                    size='small'
                    variant='outlined'
                    color={proposal.confident ? 'info' : 'default'}
                    icon={<EditNoteOutlinedIcon />}
                    label={
                        proposal.confidence === null
                            ? proposal.agent
                            : `${proposal.agent} ${proposal.confidence}`
                    }
                />

                <Typography
                    variant='body2'
                    color={
                        proposal.confident ? 'text.primary' : 'text.secondary'
                    }
                >
                    {proposal.text}
                </Typography>
            </Stack>
        ))}
    </Stack>
);

const Names: React.FC = () => {
    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<NameStatus | typeof ANY>(ANY);
    const [gender, setGender] = useState<string>(ANY);
    const [duplicatesOnly, setDuplicatesOnly] = useState(false);
    const [agentReview, setAgentReview] = useState<
        AgentReviewFilter | typeof ANY
    >(ANY);
    const [maxConfidence, setMaxConfidence] = useState<number | typeof ANY>(
        ANY,
    );
    const [page, setPage] = useState(0);
    const [limit, setLimit] = useState(25);

    // The run lives in the URL rather than in state, because the Review page
    // links straight into it: arriving on a page that is already mounted has
    // to change what is shown, and local state would quietly ignore it.
    const [params, setParams] = useSearchParams();
    const run = params.get('run') ?? '';
    const outcome = params.get('outcome');
    const runOutcome: RunOutcome | typeof ANY = isOutcome(outcome)
        ? outcome
        : ANY;

    const setRunParams = (next: { run?: string; outcome?: string }): void => {
        const merged = new URLSearchParams(params);

        for (const [key, value] of Object.entries(next)) {
            if (value) {
                merged.set(key, value);
            } else {
                merged.delete(key);
            }
        }

        // An outcome with no run to ask it about filters nothing, and would sit
        // in the URL looking as though it did.
        if (!merged.get('run')) {
            merged.delete('outcome');
        }

        setParams(merged, { replace: true });
        setPage(0);
    };

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
                ...(agentReview === ANY ? {} : { agentReview }),
                ...(maxConfidence === ANY ? {} : { maxConfidence }),
                ...(run ? { run: Number(run) } : {}),
                ...(run && runOutcome !== ANY ? { runOutcome } : {}),
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

                    <TextField
                        select
                        label='AI review'
                        size='small'
                        value={agentReview}
                        onChange={(event) =>
                            onFilterChange(setAgentReview)(
                                event.target.value as AgentReviewFilter,
                            )
                        }
                        sx={{ minWidth: 190 }}
                    >
                        <MenuItem value={ANY}>Any</MenuItem>
                        {AGENT_REVIEW.map(({ value, label }) => (
                            <MenuItem key={value} value={value}>
                                {label}
                            </MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        select
                        label='It was at most'
                        size='small'
                        value={maxConfidence}
                        onChange={(event) =>
                            onFilterChange(setMaxConfidence)(
                                event.target.value === ANY
                                    ? ANY
                                    : Number(event.target.value),
                            )
                        }
                        sx={{ minWidth: 150 }}
                    >
                        <MenuItem value={ANY}>Any sure</MenuItem>
                        {CONFIDENCE.map((ceiling) => (
                            <MenuItem key={ceiling} value={ceiling}>
                                {ceiling}% sure
                            </MenuItem>
                        ))}
                    </TextField>

                    <TextField
                        label='From run'
                        size='small'
                        type='number'
                        value={run}
                        placeholder='#'
                        onChange={(event) =>
                            setRunParams({ run: event.target.value })
                        }
                        sx={{ minWidth: 110 }}
                    />

                    <TextField
                        select
                        label='Did what'
                        size='small'
                        value={runOutcome}
                        disabled={!run}
                        onChange={(event) =>
                            setRunParams({
                                outcome:
                                    event.target.value === ANY
                                        ? ''
                                        : event.target.value,
                            })
                        }
                        sx={{ minWidth: 200 }}
                    >
                        <MenuItem value={ANY}>Anything</MenuItem>
                        {RUN_OUTCOMES.map((value) => (
                            <MenuItem key={value} value={value}>
                                {RUN_OUTCOME_LABEL[value]}
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
