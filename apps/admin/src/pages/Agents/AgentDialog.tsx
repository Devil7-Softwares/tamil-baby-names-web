import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    MenuItem,
    Stack,
    Switch,
    TextField,
} from '@mui/material';
import {
    AdminAgent,
    AGENT_PROVIDER_LABELS,
    AgentProviderId,
    AgentProviderSummary,
} from '@tbn/shared';
import { useState } from 'react';

/** What the form holds. `options` stays text until it is saved. */
interface Draft {
    name: string;
    provider: AgentProviderId;
    model: string;
    baseUrl: string;
    apiKey: string;
    options: string;
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
    enabled: boolean;
}

const blank = (provider: AgentProviderId): Draft => ({
    name: '',
    provider,
    model: '',
    baseUrl: '',
    apiKey: '',
    options: '',
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
    enabled: agent.enabled,
});

/** The dials each provider actually reads, as a starting point to edit. */
const OPTIONS_HINT: Record<AgentProviderId, string> = {
    anthropic: '{ "effort": "high" }',
    openai: '{ "temperature": 0 }',
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
            enabled: draft.enabled,
        });
    };

    const incomplete = !draft.name.trim() || !draft.model.trim();

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth='sm'>
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

                    <TextField
                        select
                        label='API'
                        size='small'
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
                        value={draft.model}
                        onChange={(event) => set('model', event.target.value)}
                        placeholder={MODEL_HINT[draft.provider]}
                    />

                    <TextField
                        label='Endpoint'
                        size='small'
                        value={draft.baseUrl}
                        onChange={(event) => set('baseUrl', event.target.value)}
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
