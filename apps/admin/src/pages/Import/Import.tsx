import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import {
    Alert,
    Button,
    Chip,
    FormControlLabel,
    LinearProgress,
    Paper,
    Stack,
    Switch,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { IMPORT_LIMIT, ImportReport } from '@tbn/shared';
import { useRef, useState } from 'react';
import { toast } from 'react-toastify';

import { orpc } from '~/api/orpc';

interface Batch {
    filename: string;
    content: string;
}

/** "1 new cluster", not "1 new clusters". */
const counted = (value: number, one: string, many: string): string =>
    `${value.toLocaleString()} ${value === 1 ? one : many}`;

const COUNTS: Array<{ key: keyof ImportReport; one: string; many: string }> = [
    { key: 'names', one: 'name', many: 'names' },
    { key: 'clusters', one: 'new cluster', many: 'new clusters' },
    { key: 'meanings', one: 'reading', many: 'readings' },
    { key: 'unchanged', one: 'already there', many: 'already there' },
];

/** What the run did, in the words the command line uses for the same thing. */
const Report: React.FC<{ report: ImportReport; dryRun: boolean }> = ({
    report,
    dryRun,
}) => (
    <Paper sx={{ p: 2 }}>
        <Typography variant='subtitle1' sx={{ mb: 1 }}>
            {dryRun ? 'Would import' : 'Imported'} from “{report.source}”
        </Typography>

        <Stack direction='row' spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {COUNTS.map(({ key, one, many }) => (
                <Chip
                    key={key}
                    size='small'
                    label={counted(report[key] as number, one, many)}
                />
            ))}

            {report.rejected.length > 0 && (
                <Chip
                    size='small'
                    color='error'
                    label={`${report.rejected.length.toLocaleString()} refused`}
                />
            )}
        </Stack>

        {report.rejected.length > 0 && (
            <TableContainer sx={{ mt: 2 }}>
                <Table size='small'>
                    <TableHead>
                        <TableRow>
                            <TableCell>Record</TableCell>
                            <TableCell>Name</TableCell>
                            <TableCell>Why</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {report.rejected.map((rejection) => (
                            <TableRow key={rejection.at}>
                                <TableCell>{rejection.at}</TableCell>
                                <TableCell>{rejection.name ?? '—'}</TableCell>
                                <TableCell>{rejection.reason}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        )}
    </Paper>
);

const Import: React.FC = () => {
    const [batch, setBatch] = useState<Batch | null>(null);
    const [dryRun, setDryRun] = useState(true);
    const [report, setReport] = useState<ImportReport | null>(null);
    // What the report describes, which is not what the switch says once it has
    // been flicked for the next run.
    const [reportWasDryRun, setReportWasDryRun] = useState(true);
    const picker = useRef<HTMLInputElement>(null);

    const queryClient = useQueryClient();

    const run = useMutation(
        orpc.admin.import.run.mutationOptions({
            onSuccess: async (result, { dryRun: was }) => {
                setReport(result);
                setReportWasDryRun(was ?? false);

                if (was) {
                    return;
                }

                // A re-run of a batch already imported adds nothing, and
                // saying it added zero names reads like a failure.
                toast.success(
                    result.names || result.meanings
                        ? `Added ${counted(result.names, 'name', 'names')} and ${counted(result.meanings, 'reading', 'readings')} to the queue.`
                        : 'Nothing new — the catalogue already had this batch.',
                );

                // The queue and the counts both moved, and neither is on screen.
                await Promise.all([
                    queryClient.invalidateQueries({
                        queryKey: orpc.admin.names.list.key(),
                    }),
                    queryClient.invalidateQueries({
                        queryKey: orpc.admin.overview.get.key(),
                    }),
                ]);
            },
            onError: (error) => toast.error(error.message),
        }),
    );

    const choose = async (file: File | undefined) => {
        if (!file) {
            return;
        }

        if (file.size > IMPORT_LIMIT) {
            toast.error('That batch is too big to import here — use the CLI.');

            return;
        }

        setBatch({ filename: file.name, content: await file.text() });
        setReport(null);
    };

    return (
        <Stack spacing={2}>
            <Typography variant='h5' sx={{ fontWeight: 600 }}>
                Import
            </Typography>

            <Typography variant='body2' color='text.secondary'>
                A JSON batch of names, which arrive as candidates for review.
                Nothing an import writes is published, and running the same
                batch twice adds nothing the second time.
            </Typography>

            <Paper sx={{ p: 2 }}>
                <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    spacing={2}
                    sx={{ alignItems: { md: 'center' } }}
                >
                    <input
                        ref={picker}
                        type='file'
                        accept='application/json,.json'
                        hidden
                        onChange={(event) =>
                            void choose(event.target.files?.[0])
                        }
                    />

                    <Button
                        variant='outlined'
                        startIcon={<UploadFileOutlinedIcon />}
                        onClick={() => picker.current?.click()}
                    >
                        Choose a batch
                    </Button>

                    <Typography variant='body2' sx={{ flex: 1 }}>
                        {batch?.filename ?? 'No file chosen'}
                    </Typography>

                    <FormControlLabel
                        control={
                            <Switch
                                checked={dryRun}
                                onChange={(event) =>
                                    setDryRun(event.target.checked)
                                }
                            />
                        }
                        label='Check without writing'
                    />

                    <Button
                        variant='contained'
                        disabled={!batch || run.isPending}
                        onClick={() =>
                            batch &&
                            run.mutate({ content: batch.content, dryRun })
                        }
                    >
                        {dryRun ? 'Check' : 'Import'}
                    </Button>
                </Stack>
            </Paper>

            {run.isPending && <LinearProgress />}

            {run.isError && <Alert severity='error'>{run.error.message}</Alert>}

            {report && <Report report={report} dryRun={reportWasDryRun} />}
        </Stack>
    );
};

export default Import;
