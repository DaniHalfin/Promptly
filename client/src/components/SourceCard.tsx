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
        WebkitFontSmoothing: 'antialiased',
        MozOsxFontSmoothing: 'grayscale',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 'var(--text-heading)', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{info.label}</h3>
        {(source?.status === 'connected' || source?.status === 'ready') && (
          <span style={{
            padding: '2px 8px',
            background: 'var(--color-positive-muted)',
            color: 'var(--color-positive-text)',
            fontSize: 'var(--text-note)',
            fontWeight: 600,
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--color-positive)',
            flexShrink: 0,
          }}>✓ Connected</span>
        )}
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 'var(--text-note)', color: 'var(--text-secondary)' }}>{info.description}</p>

      {!info.disabled && info.setupInstructions && (
        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            onClick={() => setShowInstructions((v) => !v)}
            style={{ fontSize: 'var(--text-note)', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            aria-expanded={showInstructions}
          >
            {showInstructions ? '▴ Hide setup steps' : '▾ How to connect'}
          </button>

          {showInstructions && (
            <div style={{ marginTop: 8, padding: '10px 14px', background: 'var(--color-bg-inset)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <ol style={{ margin: 0, paddingLeft: 20, listStyle: 'decimal' }}>
                {info.setupInstructions.steps.map((step, i) => (
                  <li key={i} style={{ fontSize: 'var(--text-note)', color: 'var(--text-secondary)', marginBottom: 4 }}>{step}</li>
                ))}
              </ol>
              {info.setupInstructions.note && (
                <div style={{ marginTop: 8, padding: '6px 10px', background: 'var(--color-warning-muted)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-warning)' }}>
                  <p style={{ fontSize: 'var(--text-note)', color: 'var(--color-warning-text)', margin: 0 }}>{info.setupInstructions.note}</p>
                </div>
              )}
              {info.setupInstructions.docsUrl && (
                <a
                  href={info.setupInstructions.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-block', marginTop: 8, fontSize: 'var(--text-note)', color: 'var(--color-accent-light)' }}
                >
                  Official docs →
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {info.disabled ? (
        <div style={{ borderRadius: 'var(--radius-sm)', border: '1px solid rgba(255,255,255,0.08)', background: 'var(--color-bg-inset)', padding: '10px 14px' }} aria-disabled="true">
          <p style={{ fontSize: 'var(--text-body)', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>Currently disabled</p>
          <p style={{ fontSize: 'var(--text-note)', color: 'var(--text-muted)', marginTop: 4, marginBottom: 0 }}>Claude export upload is not available in this MVP.</p>
        </div>
      ) : info.type === 'api' ? (
        <div>
          <label htmlFor={`${sourceId}-credential`} style={{ display: 'block', fontSize: 'var(--text-body)', fontWeight: 500, marginBottom: 8 }}>API Key</label>
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
              fontSize: 'var(--text-body)',
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
          <button
            role="switch"
            aria-checked={Boolean(source?.enabled)}
            aria-label={`Enable local ${info.label} analysis`}
            onClick={() => checkboxRef.current?.click()}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}
          >
            <span className={`toggle-track${source?.enabled ? ' on' : ''}${validating ? ' disabled' : ''}`}>
              <span className="toggle-thumb" />
            </span>
            <span style={{ fontSize: 'var(--text-body)', fontWeight: 500, color: 'var(--text-primary)' }}>
              Enable local {info.label} analysis
            </span>
          </button>
          <input
            ref={checkboxRef}
            type="checkbox"
            aria-hidden="true"
            tabIndex={-1}
            style={{ display: 'none' }}
            checked={Boolean(source?.enabled)}
            onChange={handleLocalToggle}
            disabled={validating}
          />
          <p style={{ fontSize: 'var(--text-note)', color: 'var(--text-muted)', margin: 0 }}>
            Promptly scans <code>{info.localPath}</code> on this computer. No API key or file upload is required.
          </p>
          {validating && <p style={{ fontSize: 'var(--text-body)', color: 'var(--color-accent-light)', marginTop: 8 }}>{info.localCheckMessage ?? 'Checking local data...'}</p>}
        </div>
      ) : (
        <div>
          <div
            className="upload-area"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) updateSource(sourceId, { file, status: 'ready' });
            }}
            role="button"
            tabIndex={0}
            aria-label="Upload JSON or JSONL file"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
          >
            <span className="upload-area-icon">📂</span>
            <span className="upload-area-label">
              Click or drag a .json / .jsonl file here
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.jsonl"
            aria-hidden="true"
            tabIndex={-1}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          {source?.file && (
            <div className="upload-file-selected">
              <span>✓ {source.file.name}</span>
              <button
                type="button"
                className="upload-file-clear"
                onClick={() => {
                  if (fileInputRef.current) fileInputRef.current.value = '';
                  updateSource(sourceId, { file: undefined, status: 'pending' });
                }}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      {source?.error && <p style={{ fontSize: 'var(--text-body)', color: 'var(--color-critical)', marginTop: 8, WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale' }}>{source.error}</p>}
    </div>
  );
}
