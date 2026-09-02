import AddIcon from '@mui/icons-material/Add';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import KeyOffOutlinedIcon from '@mui/icons-material/KeyOffOutlined';
import KeyOutlinedIcon from '@mui/icons-material/KeyOutlined';
import {
    Alert,
    Box,
    Button,
    Chip,
    IconButton,
    LinearProgress,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AdminAgent, AGENT_PROVIDER_LABELS } from '@tbn/shared';
import { useState } from 'react';
import { toast } from 'react-toastify';

import { orpc } from '~/api/orpc';

import { AgentDialog, Saved } from './AgentDialog';

/** The endpoint a row is actually pointed at, defaults included. */
const endpointOf = (agent: AdminAgent, fallback: string | undefined): string =>
    agent.baseUrl ?? fallback ?? '—';

const Agents: React.FC = () => {
    const [editing, setEditing] = useState<AdminAgent | null>(null);
    const [open, setOpen] = useState(false);
    const [checked, setChecked] = useState<Record<number, string>>({});

    const queryClient = useQueryClient();

    const providers = useQuery(orpc.admin.agents.providers.queryOptions());
    const agents = useQuery(orpc.admin.agents.list.queryOptions());

    const reread = () =>
        queryClient.invalidateQueries({
            queryKey: orpc.admin.agents.list.key(),
        });

    const create = useMutation(
        orpc.admin.agents.create.mutationOptions({
            onSuccess: async (agent) => {
                setOpen(false);
                toast.success(`“${agent.name}” is configured.`);
                await reread();
            },
            onError: (error) => toast.error(error.message),
        }),
    );

    const update = useMutation(
        orpc.admin.agents.update.mutationOptions({
            onSuccess: async () => {
                setOpen(false);
                await reread();
            },
            onError: (error) => toast.error(error.message),
        }),
    );

    const remove = useMutation(
        orpc.admin.agents.remove.mutationOptions({
            onSuccess: reread,
            onError: (error) => toast.error(error.message),
        }),
    );

    // Which agent was tested comes from the row that asked, not from the
    // mutation's input: the id there is coerced and arrives as a string.
    const [testing, setTesting] = useState<number | null>(null);

    const check = useMutation(
        orpc.admin.agents.check.mutationOptions({
            onSuccess: (result) => {
                if (testing !== null) {
                    setChecked((current) => ({
                        ...current,
                        [testing]: result.ok
                            ? 'ok'
                            : (result.why ?? 'It did not answer.'),
                    }));
                }

                if (result.ok) {
                    toast.success('It answered.');
                }
            },
            onError: (error) => toast.error(error.message),
        }),
    );

    const test = (id: number) => {
        setTesting(id);
        check.mutate({ id });
    };

    const save = (saved: Saved) =>
        editing
            ? update.mutate({ id: editing.id, ...saved })
            : create.mutate(saved);

    // Bumped on every open so the dialog remounts and reads its values fresh.
    const [session, setSession] = useState(0);

    const edit = (agent: AdminAgent | null) => {
        setEditing(agent);
        setSession((count) => count + 1);
        setOpen(true);
    };

    const defaults = new Map(
        providers.data?.providers.map(({ id, defaultBaseUrl }) => [
            id,
            defaultBaseUrl,
        ]),
    );

    return (
        <Stack spacing={2}>
            <Stack
                direction='row'
                spacing={2}
                sx={{ alignItems: 'center', justifyContent: 'space-between' }}
            >
                <Typography variant='h5' sx={{ fontWeight: 600 }}>
                    Agents
                </Typography>

                <Button
                    variant='contained'
                    startIcon={<AddIcon />}
                    onClick={() => edit(null)}
                >
                    Add an agent
                </Button>
            </Stack>

            <Typography variant='body2' color='text.secondary'>
                The models that can be asked to review the queue. A key is
                sealed before it is stored and cannot be read back — only
                replaced.
            </Typography>

            {providers.data && !providers.data.canSealKeys && (
                <Alert severity='warning'>
                    AGENT_KEY_SECRET is not set in the API’s environment, so
                    only an agent that needs no key — a local Ollama — can be
                    used.
                </Alert>
            )}

            {agents.isError && (
                <Alert severity='error'>Could not load the agents.</Alert>
            )}

            <Paper>
                <Box sx={{ height: 4 }}>
                    {(agents.isFetching || remove.isPending) && (
                        <LinearProgress />
                    )}
                </Box>

                <TableContainer>
                    <Table size='small'>
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>API</TableCell>
                                <TableCell>Model</TableCell>
                                <TableCell>Endpoint</TableCell>
                                <TableCell>Key</TableCell>
                                <TableCell align='right' />
                            </TableRow>
                        </TableHead>

                        <TableBody>
                            {agents.data?.agents.map((agent) => (
                                <TableRow key={agent.id} hover>
                                    <TableCell>
                                        <Stack
                                            direction='row'
                                            spacing={1}
                                            sx={{ alignItems: 'center' }}
                                        >
                                            <Typography variant='body2'>
                                                {agent.name}
                                            </Typography>

                                            {!agent.enabled && (
                                                <Chip
                                                    size='small'
                                                    label='off'
                                                    color='default'
                                                />
                                            )}

                                            {checked[agent.id] === 'ok' && (
                                                <Chip
                                                    size='small'
                                                    color='success'
                                                    label='answered'
                                                />
                                            )}

                                            {checked[agent.id] &&
                                                checked[agent.id] !== 'ok' && (
                                                    <Tooltip
                                                        title={
                                                            checked[agent.id]
                                                        }
                                                    >
                                                        <Chip
                                                            size='small'
                                                            color='error'
                                                            label='no answer'
                                                        />
                                                    </Tooltip>
                                                )}
                                        </Stack>
                                    </TableCell>

                                    <TableCell>
                                        {AGENT_PROVIDER_LABELS[agent.provider]}
                                    </TableCell>

                                    <TableCell>{agent.model}</TableCell>

                                    <TableCell>
                                        <Typography
                                            variant='body2'
                                            color={
                                                agent.baseUrl
                                                    ? 'text.primary'
                                                    : 'text.secondary'
                                            }
                                        >
                                            {endpointOf(
                                                agent,
                                                defaults.get(agent.provider),
                                            )}
                                        </Typography>
                                    </TableCell>

                                    <TableCell>
                                        {agent.hasKey ? (
                                            <Tooltip title='A key is saved. It cannot be read back.'>
                                                <KeyOutlinedIcon
                                                    fontSize='small'
                                                    color='action'
                                                />
                                            </Tooltip>
                                        ) : (
                                            <Tooltip title='No key saved.'>
                                                <KeyOffOutlinedIcon
                                                    fontSize='small'
                                                    color='disabled'
                                                />
                                            </Tooltip>
                                        )}
                                    </TableCell>

                                    <TableCell align='right'>
                                        <Stack
                                            direction='row'
                                            spacing={1}
                                            sx={{ justifyContent: 'flex-end' }}
                                        >
                                            <Button
                                                size='small'
                                                disabled={check.isPending}
                                                onClick={() => test(agent.id)}
                                            >
                                                Test
                                            </Button>

                                            <IconButton
                                                size='small'
                                                onClick={() => edit(agent)}
                                            >
                                                <EditOutlinedIcon fontSize='small' />
                                            </IconButton>

                                            <IconButton
                                                size='small'
                                                onClick={() =>
                                                    remove.mutate({
                                                        id: agent.id,
                                                    })
                                                }
                                            >
                                                <DeleteOutlinedIcon fontSize='small' />
                                            </IconButton>
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            ))}

                            {agents.data?.agents.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6}>
                                        <Typography
                                            variant='body2'
                                            color='text.secondary'
                                        >
                                            No agents yet. A local Ollama needs
                                            no key and costs nothing to run.
                                        </Typography>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            <AgentDialog
                key={session}
                open={open}
                agent={editing}
                providers={providers.data?.providers ?? []}
                saving={create.isPending || update.isPending}
                onClose={() => setOpen(false)}
                onSave={save}
            />
        </Stack>
    );
};

export default Agents;
