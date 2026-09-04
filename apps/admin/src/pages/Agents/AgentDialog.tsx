import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    MenuItem,
    Stack,
    Switch,
    TextField,
    Typography,
} from '@mui/material';
import {
    AdminAgent,
    AGENT_PROVIDER_LABELS,
    AgentProviderId,
    AgentProviderSummary,
} from '@tbn/shared';
import { useState } from 'react';

/**
 * The form asks three separate questions — which model, how to reach it, how to
 * call it — and as one flat column of eight controls they all looked alike.
 */
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
    title,
    children,
}) => (
    <Stack spacing={2}>
        <Divider textAlign='left'>
            <Typography variant='overline' color='text.secondary'>
                {title}
            </Typography>
        </Divider>

        {children}
    </Stack>
);

/** What the form holds. `options` stays text until it is saved. */
interface Draft {
    name: string;
    provider: AgentProviderId;
    model: string;
    baseUrl: string;
    apiKey: string;
    options: string;
    /** Off means one at a time. `concurrency` is only read when this is on. */
    parallel: boolean;
    concurrency: string;
    enabled: boolean;
}

export interface Saved {
    name: string;
    provider: AgentProviderId;
    model: string;
    baseUrl: string;
    /** Undefined leaves a saved key alone; a string replaces it. */
    apiKey?: string;
    options: Record<string, unknown>;
    /** Null defers to the provider's own figure. */
    concurrency: number | null;
    enabled: boolean;
}

const blank = (provider: AgentProviderId): Draft => ({
    name: '',
    provider,
    model: '',
    baseUrl: '',
    apiKey: '',
    options: '',
    parallel: true,
    concurrency: '',
    enabled: true,
});

const draftOf = (agent: AdminAgent): Draft => ({
    name: agent.name,
    provider: agent.provider,
    model: agent.model,
    baseUrl: agent.baseUrl ?? '',
    apiKey: '',
    options: Object.keys(agent.options).length
        ? JSON.stringify(agent.options, null, 2)
        : '',
    // One at a time *is* a concurrency of one, so the switch and the number are
    // one stored value rather than two that can disagree. Read through to the
    // provider's figure, or an Ollama agent left on the default shows the
    // switch on while actually running one at a time.
    parallel: (agent.concurrency ?? agent.providerConcurrency) !== 1,
    concurrency:
        agent.concurrency && agent.concurrency !== 1
            ? String(agent.concurrency)
            : '',
    enabled: agent.enabled,
});

/**
 * The dials each provider actually reads, as a starting point to edit.
 *
 * Neither of these is safe to suggest more widely than it is: `effort` is
 * refused by Haiku though Sonnet and Opus take it, and `temperature` is refused
 * by every current OpenAI model though a self-hosted server usually wants one.
 * So the hint names the one dial that works everywhere.
 */
const OPTIONS_HINT: Record<AgentProviderId, string> = {
    anthropic: '{ "effort": "high" }',
    openai: '{ "timeout": 60000 }',
    ollama: '{ "think": false, "temperature": 0 }',
};

const MODEL_HINT: Record<AgentProviderId, string> = {
    anthropic: 'claude-opus-5',
    openai: 'gpt-5.6-terra',
    ollama: 'qwen3:8b',
};

export const AgentDialog: React.FC<{
    open: boolean;
    /** The agent being changed, or null to configure a new one. */
    agent: AdminAgent | null;
    providers: AgentProviderSummary[];
    saving: boolean;
    onClose: () => void;
    onSave: (saved: Saved) => void;
}> = ({ open, agent, providers, saving, onClose, onSave }) => {
    const first = providers.find(({ usable }) => usable)?.id ?? 'ollama';
    // Read once. The caller remounts this on every open, so the values belong
    // to the agent being edited rather than to whichever was edited last —
    // which is how a key typed for one ends up saved against another.
    const [draft, setDraft] = useState<Draft>(() =>
        agent ? draftOf(agent) : blank(first),
    );
    const [badOptions, setBadOptions] = useState<string | null>(null);

    const chosen = providers.find(({ id }) => id === draft.provider);
    const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
        setDraft((current) => ({ ...current, [key]: value }));

    const save = () => {
        let options: Record<string, unknown> = {};

        if (draft.options.trim()) {
            try {
                options = JSON.parse(draft.options) as Record<string, unknown>;
            } catch {
                setBadOptions('That is not valid JSON.');

                return;
            }
        }

        onSave({
            name: draft.name.trim(),
            provider: draft.provider,
            model: draft.model.trim(),
            baseUrl: draft.baseUrl.trim(),
            ...(draft.apiKey ? { apiKey: draft.apiKey } : {}),
            options,
            concurrency: draft.parallel ? Number(draft.concurrency) || null : 1,
            enabled: draft.enabled,
        });
    };

    const incomplete = !draft.name.trim() || !draft.model.trim();

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth='md'>
            <DialogTitle>{agent ? agent.name : 'Add an agent'}</DialogTitle>

            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label='Name'
                        size='small'
                        value={draft.name}
                        onChange={(event) => set('name', event.target.value)}
                        helperText={
                            agent
                                ? `Its slug stays “${agent.slug}”, so what it has already written keeps its attribution.`
                                : 'What it is called in the dashboard.'
                        }
                    />

                    <Section title='Where it lives'>
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={2}
                        >
                            <TextField
                                select
                                label='API'
                                size='small'
                                sx={{ flex: 1 }}
                                value={draft.provider}
                                // Changing it would strand the key and the endpoint,
                                // and an agent's slug is already attached to its work.
                                disabled={!!agent}
                                onChange={(event) =>
                                    set(
                                        'provider',
                                        event.target.value as AgentProviderId,
                                    )
                                }
                                helperText={
                                    agent
                                        ? 'Add another agent to use a different API.'
                                        : undefined
                                }
                            >
                                {providers.map((provider) => (
                                    <MenuItem
                                        key={provider.id}
                                        value={provider.id}
                                        disabled={!provider.usable}
                                    >
                                        {AGENT_PROVIDER_LABELS[provider.id]}
                                        {provider.usable
                                            ? ''
                                            : ' — needs AGENT_KEY_SECRET'}
                                    </MenuItem>
                                ))}
                            </TextField>

                            <TextField
                                label='Model'
                                size='small'
                                sx={{ flex: 1 }}
                                value={draft.model}
                                onChange={(event) =>
                                    set('model', event.target.value)
                                }
                                placeholder={MODEL_HINT[draft.provider]}
                                helperText='Exactly as the provider names it.'
                            />
                        </Stack>

                        <TextField
                            label='Endpoint'
                            size='small'
                            value={draft.baseUrl}
                            onChange={(event) =>
                                set('baseUrl', event.target.value)
                            }
                            placeholder={chosen?.defaultBaseUrl}
                            helperText='Leave empty for the provider’s own endpoint. Set it for a gateway, a proxy, or an Ollama elsewhere.'
                        />

                        {chosen?.needsKey && (
                            <TextField
                                label='API key'
                                size='small'
                                type='password'
                                autoComplete='off'
                                value={draft.apiKey}
                                onChange={(event) =>
                                    set('apiKey', event.target.value)
                                }
                                helperText={
                                    agent?.hasKey
                                        ? 'A key is saved. Type a new one to replace it — it cannot be read back.'
                                        : 'Sealed before it is stored, and never shown again.'
                                }
                            />
                        )}
                    </Section>

                    <Section title='How it is called'>
                        <TextField
                            label='Options'
                            size='small'
                            multiline
                            minRows={2}
                            value={draft.options}
                            onChange={(event) => {
                                set('options', event.target.value);
                                setBadOptions(null);
                            }}
                            placeholder={OPTIONS_HINT[draft.provider]}
                            error={!!badOptions}
                            helperText={
                                badOptions ??
                                `JSON, passed to the provider. For ${AGENT_PROVIDER_LABELS[draft.provider]}: ${OPTIONS_HINT[draft.provider]}`
                            }
                        />

                        <Stack spacing={0.5}>
                            <Stack
                                direction='row'
                                spacing={2}
                                sx={{ alignItems: 'center' }}
                            >
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={draft.parallel}
                                            onChange={(event) =>
                                                set(
                                                    'parallel',
                                                    event.target.checked,
                                                )
                                            }
                                        />
                                    }
                                    label='Ask about several at once'
                                    sx={{ mr: 0 }}
                                />

                                <TextField
                                    label='At most'
                                    size='small'
                                    type='number'
                                    disabled={!draft.parallel}
                                    value={draft.concurrency}
                                    onChange={(event) =>
                                        set('concurrency', event.target.value)
                                    }
                                    placeholder={String(
                                        chosen?.concurrency ?? 1,
                                    )}
                                    slotProps={{
                                        htmlInput: { min: 1, max: 32 },
                                    }}
                                    sx={{ width: 120 }}
                                />
                            </Stack>

                            {/* One line under both, so the switch and the field sit
                            on the same baseline instead of the field being
                            pushed up by helper text only it carries. */}
                            <Typography
                                variant='caption'
                                color='text.secondary'
                            >
                                {draft.parallel
                                    ? `How many clusters a run may have in flight at once. Blank uses ${AGENT_PROVIDER_LABELS[draft.provider]}'s own ${chosen?.concurrency ?? 1}.`
                                    : 'One request at a time, which is what a model on this machine wants.'}
                            </Typography>
                        </Stack>
                    </Section>

                    <Section title='Availability'>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={draft.enabled}
                                    onChange={(event) =>
                                        set('enabled', event.target.checked)
                                    }
                                />
                            }
                            label='Available to run reviews'
                        />
                    </Section>

                    {chosen && !chosen.usable && (
                        <Alert severity='warning'>
                            {AGENT_PROVIDER_LABELS[chosen.id]} needs an API key,
                            and keys cannot be sealed until AGENT_KEY_SECRET is
                            set in the API’s environment.
                        </Alert>
                    )}
                </Stack>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    variant='contained'
                    disabled={incomplete || saving}
                    onClick={save}
                >
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
};
