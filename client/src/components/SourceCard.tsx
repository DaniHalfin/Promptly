import React, { useState, useRef } from 'react';
import { useSession } from '../context/SessionContext.js';
import type { SourceValidationState } from '../context/SessionContext.js';
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
    /* WP-13: Removed "no data leaves" claim — the footer covers privacy globally */
    description: 'Local session data — no API key required.',
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
    /* WP-13: Shorter copy — footer covers global privacy claim; JSONL glossed inline */
    description: 'Local JSONL logs — no API key or upload required.',
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

  const isConnected = source?.status === 'connected' || source?.status === 'ready';

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
      if (!result.valid || result.availability === 'none') {
        updateSource(sourceId, { status: 'error', error: result.errorMessage || 'No data available for this source' });
      } else {
        updateSource(sourceId, { status: 'connected', error: null });
      }
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
      const result = await apiClient.validate(sourceId);
      if (!result.valid || result.availability === 'none') {
        updateSource(sourceId, { enabled: true, status: 'error', error: result.errorMessage || 'No data available for this source' });
      } else {
        updateSource(sourceId, { enabled: true, status: 'connected', error: null });
      }
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
    /* STATIC-P1-C01 Option 2: role="group" + aria-labelledby groups card controls under its heading label */
    <div
      role="group"
      aria-labelledby={`${sourceId}-heading`}
      onClick={handleCardClick}
      style={{
        borderRadius: 'var(--radius-lg)',
        padding: '16px 20px',
        transition: 'background 150ms ease, border-color 150ms ease',
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
        <h3 id={`${sourceId}-heading`} style={{ margin: 0, fontSize: 'var(--text-heading)', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{info.label}</h3>
        {source?.validation && source.validation.status !== 'idle' ? (
          <ValidationBadge validation={source.validation} />
        ) : (source?.status === 'connected' || source?.status === 'ready') && (
          /* WP-13: "Validated" is more accurate — confirms credentials, not that analysis has run */
          <span style={{
            padding: '2px 8px',
            background: 'var(--color-positive-muted)',
            color: 'var(--color-positive-text)',
            fontSize: 'var(--text-note)',
            fontWeight: 600,
            borderRadius: 'var(--radius-pill)',
            border: '1px solid var(--color-positive)',
            flexShrink: 0,
          }}>✓ Validated</span>
        )}
      </div>
      <p style={{ margin: '0 0 12px', fontSize: 'var(--text-note)', color: 'var(--text-secondary)' }}>{info.description}</p>

      {!info.disabled && info.setupInstructions && (
        <div style={{ marginBottom: 16 }}>
          {/* WP-5: .disclosure-btn class replaces bare inline style — visible button boundary, open/closed state via aria-expanded */}
          <button
            type="button"
            className="disclosure-btn"
            onClick={() => setShowInstructions((v) => !v)}
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
        /* WP-6: aria-busy signals async state to AT immediately */
        <div aria-busy={validating} aria-label={validating ? 'Validating…' : undefined}>
          <label htmlFor={`${sourceId}-credential`} style={{ display: 'block', fontSize: 'var(--text-body)', fontWeight: 500, marginBottom: 8 }}>API Key</label>
          <input
            ref={credInputRef}
            id={`${sourceId}-credential`}
            type="password"
            placeholder="Paste your API key here"
            value={source?.credential || ''}
            onChange={handleCredentialChange}
            /* WP-3: aria-describedby links input to its error so AT announces error on focus */
            aria-describedby={source?.error ? `${sourceId}-error` : undefined}
            style={{
              width: '100%',
              background: 'var(--color-bg-inset)',
              /* WP-10: use --color-input-border token (0.35 opacity) for WCAG 3:1 non-text contrast */
              border: '1px solid var(--color-input-border)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px',
              color: 'var(--text-primary)',
              fontSize: 'var(--text-body)',
              fontFamily: 'monospace',
              marginBottom: 8,
            }}
          />
          {/* WP-3: aria-describedby on button so screen readers announce error when button is focused after a failed attempt */}
          <button
            className="secondary"
            style={{ width: '100%' }}
            onClick={handleValidate}
            disabled={validating || !source?.credential}
            aria-describedby={source?.error ? `${sourceId}-error` : undefined}
          >
            {validating ? 'Validating…' : 'Validate'}
          </button>
        </div>
      ) : info.type === 'local' ? (
        /* WP-6: aria-busy on the local-toggle container mirrors async state for AT */
        <div aria-busy={validating}>
          <button
            role="switch"
            aria-checked={Boolean(source?.enabled)}
            /* WP-2: aria-disabled prevents AT from announcing the switch as activatable during validation */
            aria-disabled={validating ? true : undefined}
            aria-label={`Enable local ${info.label} analysis`}
            onClick={() => { if (validating) return; checkboxRef.current?.click(); }}
            /* WP-4: padding + minHeight ensure ≥44px touch target (was padding:0, ~22px tall) */
            style={{ background: 'none', border: 'none', padding: '11px 0', minHeight: 44, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}
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
          {/* WP-13: Shorter copy — global footer covers the "no data leaves" privacy claim */}
          <p style={{ fontSize: 'var(--text-note)', color: 'var(--text-muted)', margin: 0 }}>
            Scans <code>{info.localPath}</code> on this machine.
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
            /* WP-2: aria-label and visible text match exactly (WCAG 2.5.3 Label-in-name) */
            aria-label="Click or drag a .json or .jsonl file here"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
          >
            <span className="upload-area-icon">📂</span>
            <span className="upload-area-label">
              Click or drag a .json or .jsonl file here
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
                /* WP-2: aria-label gives the icon-only ✕ button an accessible name */
                aria-label="Clear file"
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

      {/* E5: Partial-data warning and no-data exclusion explanation */}
      {source?.validation?.status === 'partial' && (
        <p
          data-testid={`${sourceId}-partial-warning`}
          style={{ fontSize: 'var(--text-note)', color: 'var(--color-warning-text)', marginTop: 8 }}
        >
          ⚠️ Partial data · {source.validation.daysAvailable ?? 0} of {source.validation.daysRequested ?? 0} days available
        </p>
      )}
      {source?.validation?.status === 'none' && (
        <p
          data-testid={`${sourceId}-excluded`}
          style={{ fontSize: 'var(--text-note)', color: 'var(--text-muted)', marginTop: 8 }}
        >
          No data for the selected period — this source will be excluded from analysis.
        </p>
      )}

      {/* WP-3: role="alert" announces errors to AT immediately; id enables aria-describedby on related inputs */}
      {source?.error && (
        <p
          id={`${sourceId}-error`}
          role="alert"
          style={{ fontSize: 'var(--text-body)', color: 'var(--color-critical-text)', marginTop: 8 }}
        >
          {source.error}
        </p>
      )}
    </div>
  );
}

/**
 * E5: Inline per-source validation badge driven by session validation state.
 * Reflects date-range data availability (distinct from credential/connection status).
 */
function ValidationBadge({ validation }: { validation: SourceValidationState }) {
  const base: React.CSSProperties = {
    padding: '2px 8px',
    fontSize: 'var(--text-note)',
    fontWeight: 600,
    borderRadius: 'var(--radius-pill)',
    flexShrink: 0,
  };

  if (validation.status === 'validating') {
    return (
      <span
        data-testid="source-validation-badge"
        data-validation-status="validating"
        aria-live="polite"
        style={{ ...base, background: 'var(--color-bg-inset)', color: 'var(--text-muted)', border: '1px solid var(--color-input-border)' }}
      >
        Revalidating…
      </span>
    );
  }

  if (validation.status === 'full') {
    return (
      <span
        data-testid="source-validation-badge"
        data-validation-status="full"
        style={{ ...base, background: 'var(--color-positive-muted)', color: 'var(--color-positive-text)', border: '1px solid var(--color-positive)' }}
      >
        ✅ Data available
      </span>
    );
  }

  if (validation.status === 'partial') {
    return (
      <span
        data-testid="source-validation-badge"
        data-validation-status="partial"
        style={{ ...base, background: 'var(--color-warning-muted)', color: 'var(--color-warning-text)', border: '1px solid var(--color-warning)' }}
      >
        ⚠️ Partial data · {validation.daysAvailable ?? 0} days
      </span>
    );
  }

  if (validation.status === 'none' || validation.status === 'error') {
    return (
      <span
        data-testid="source-validation-badge"
        data-validation-status={validation.status}
        style={{ ...base, background: 'var(--color-critical-muted)', color: 'var(--color-critical-text)', border: '1px solid var(--color-critical)' }}
      >
        ❌ No data in range
      </span>
    );
  }

  return null;
}
