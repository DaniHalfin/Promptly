import React, { useState, useRef } from 'react';
import { useSession } from '../context/SessionContext.js';
import { SourceId } from '../types/index.js';
import { apiClient } from '../api/client.js';

interface SetupInstructions {
  steps: string[];
  docsUrl?: string;
  note?: string;
}

const sourceInfo: Record<
  SourceId,
  { label: string; type: 'api' | 'file' | 'local'; description: string; disabled?: boolean; setupInstructions?: SetupInstructions; localPath?: string; localCheckMessage?: string; }
> = {
  openai: {
    label: 'OpenAI',
    type: 'api',
    description: 'Usage from OpenAI API',
    setupInstructions: {
      steps: [
        'Go to platform.openai.com/api-keys',
        'Click "Create new secret key" — no special permissions needed',
        'Paste the key here',
      ],
      docsUrl: 'https://platform.openai.com/api-keys',
    },
  },
  anthropic: {
    label: 'Anthropic',
    type: 'api',
    description: 'Usage from Anthropic API',
    setupInstructions: {
      steps: [
        'Go to console.anthropic.com/settings/keys',
        'Click "Create Key" — no special permissions needed',
        'Paste the key here',
      ],
      docsUrl: 'https://console.anthropic.com/settings/keys',
    },
  },
  github_copilot: {
    label: 'GitHub Copilot',
    type: 'local',
    description: 'Reads session data from ~/.copilot/session-state/ automatically; no API key required.',
    localPath: '~/.copilot/session-state',
    localCheckMessage: 'Checking local GitHub Copilot data...',
    setupInstructions: {
      steps: [
        'No setup needed — Promptly reads ~/.copilot/session-state/ automatically',
        'Enable the toggle to start analysis',
      ],
    },
  },
  chatgpt_export: {
    label: 'ChatGPT Export',
    type: 'file',
    description: 'Exported conversation JSON',
    setupInstructions: {
      steps: [
        'In ChatGPT, go to Settings → Data controls → Export data',
        'Request an export and wait for the email',
        'Download the ZIP and extract conversations.json',
        'Upload that file here',
      ],
      docsUrl: 'https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data',
    },
  },
  claude_export: {
    label: 'Claude Export',
    type: 'file',
    description: 'Disabled MVP stub; use Claude Code local projects instead',
    disabled: true,
  },
  claude_code: {
    label: 'Claude Code',
    type: 'local',
    description: 'Reads Claude Code JSONL from ~/.claude/projects locally; no data leaves this machine.',
    localPath: '~/.claude/projects',
    localCheckMessage: 'Checking local Claude Code data...',
    setupInstructions: {
      steps: [
        'No setup needed — Promptly reads ~/.claude/projects/ automatically',
        'Enable the toggle to start analysis',
      ],
    },
  },
};

export function SourceCard({ sourceId }: { sourceId: SourceId }) {
  const { state, updateSource } = useSession();
  const info = sourceInfo[sourceId];
  const source = state.sources[sourceId];
  const [validating, setValidating] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const credInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const checkboxRef = useRef<HTMLInputElement>(null);

  const isConnected = source?.status === 'connected' || source?.status === 'ready' || source?.enabled;

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input, button, a, label')) return;
    if (info.disabled) return;
    if (info.type === 'local') {
      checkboxRef.current?.click();
    } else if (info.type === 'api') {
      credInputRef.current?.focus();
    } else if (info.type === 'file') {
      fileInputRef.current?.focus();
    }
  };

  const handleCredentialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateSource(sourceId, { credential: e.target.value, status: 'pending' });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    updateSource(sourceId, { file, status: file ? 'ready' : 'pending' });
  };

  const handleValidate = async () => {
    setValidating(true);
    try {
      // Set credential before validating
      if (source?.credential) {
        apiClient.setCredential(sourceId, source.credential);
      }
      const result = await apiClient.validate(sourceId);
      updateSource(sourceId, { status: 'connected', error: null });
    } catch (err) {
      updateSource(sourceId, { status: 'error', error: (err as Error).message });
    }
    setValidating(false);
  };

  const handleLocalToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = e.target.checked;
    if (!enabled) {
      updateSource(sourceId, { enabled: false, status: 'pending', error: null });
      return;
    }

    updateSource(sourceId, { enabled: true, status: 'pending', error: null });
    setValidating(true);
    try {
      await apiClient.validate(sourceId);
      updateSource(sourceId, { enabled: true, status: 'connected', error: null });
    } catch (err) {
      updateSource(sourceId, { enabled: true, status: 'error', error: (err as Error).message });
    }
    setValidating(false);
  };

  const statusColor: Record<string, string> = {
    pending: 'bg-gray-100',
    ready: 'bg-blue-100 border-blue-300',
    connected: 'bg-green-100 border-green-300',
    error: 'bg-red-100 border-red-300',
  };

  const cardBorder = isConnected
    ? '2px solid var(--color-accent-border)'
    : source?.status === 'error'
    ? '1px solid var(--color-critical)'
    : '1px solid rgba(255,255,255,0.07)';

  const cardBg = isConnected
    ? 'color-mix(in oklab, var(--color-accent) 10%, var(--color-bg-surface))'
    : 'var(--color-bg-surface)';

  return (
    <div
      onClick={handleCardClick}
      style={{
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
        transition: 'all 150ms ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        cursor: info.disabled ? 'default' : 'pointer',
        border: cardBorder,
        background: cardBg,
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{info.label}</h3>
        {isConnected && (
          <span style={{
            color: 'var(--color-accent-light)',
            fontSize: '1rem',
            animation: 'checkIn 120ms ease-out',
            flexShrink: 0,
          }}>✓</span>
        )}
      </div>
      <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{info.description}</p>

      {!info.disabled && info.setupInstructions && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setShowInstructions((v) => !v)}
            className="text-xs text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline focus:outline-none"
            aria-expanded={showInstructions}
          >
            {showInstructions ? '▴ Hide' : 'How to connect ▾'}
          </button>

          {showInstructions && (
            <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-3">
              <ol className="list-decimal list-inside space-y-1">
                {info.setupInstructions.steps.map((step, i) => (
                  <li key={i} className="text-xs text-slate-600">{step}</li>
                ))}
              </ol>
              {info.setupInstructions.note && (
                <div className="mt-2 rounded border border-amber-300 bg-amber-50 px-2 py-1">
                  <p className="text-xs text-amber-800">{info.setupInstructions.note}</p>
                </div>
              )}
              {info.setupInstructions.docsUrl && (
                <a
                  href={info.setupInstructions.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs text-blue-600 hover:underline"
                >
                  Official docs →
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {info.disabled ? (
        <div className="rounded border border-slate-200 bg-slate-50 p-3" aria-disabled="true">
          <p className="text-sm font-semibold text-slate-700">Currently disabled</p>
          <p className="text-xs text-slate-500 mt-1">Claude export upload is not available in this MVP.</p>
        </div>
      ) : info.type === 'api' ? (
        <div>
          <label htmlFor={`${sourceId}-credential`} className="block text-sm font-medium mb-2">API Key</label>
          <input
            ref={credInputRef}
            id={`${sourceId}-credential`}
            type="password"
            placeholder="Paste your API key here"
            value={source?.credential || ''}
            onChange={handleCredentialChange}
            style={{
              width: '100%',
              background: 'var(--color-bg-inset)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              fontFamily: 'monospace',
              marginBottom: 8,
            }}
          />
          <button className="secondary w-full" onClick={handleValidate} disabled={validating || !source?.credential}>
            {validating ? 'Validating...' : 'Validate'}
          </button>
        </div>
      ) : info.type === 'local' ? (
        <div>
          <label className="flex items-center gap-3 text-sm font-medium mb-2">
            <input ref={checkboxRef} type="checkbox" checked={Boolean(source?.enabled)} onChange={handleLocalToggle} disabled={validating} />
            Enable local {info.label} analysis
          </label>
          <p className="text-xs text-slate-500">
            Promptly scans <code>{info.localPath}</code> on this computer. No API key or file upload is required.
          </p>
          {validating && <p className="text-sm text-blue-600 mt-2">{info.localCheckMessage ?? 'Checking local data...'}</p>}
        </div>
      ) : (
        <div>
          <label htmlFor={`${sourceId}-file`} className="block text-sm font-medium mb-2">Upload File</label>
          <input ref={fileInputRef} id={`${sourceId}-file`} type="file" accept=".json,.jsonl" onChange={handleFileChange} className="mb-3" />
          {source?.file && <p className="text-sm text-green-600">✓ {source.file.name} selected</p>}
        </div>
      )}

      {source?.error && <p className="text-sm text-red-600 mt-2">{source.error}</p>}
      {source?.status === 'connected' && <p className="text-sm text-green-600 mt-2">✓ Connected</p>}
    </div>
  );
}
