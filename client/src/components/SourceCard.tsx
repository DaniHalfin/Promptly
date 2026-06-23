import React, { useState } from 'react';
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
  { label: string; type: 'api' | 'file' | 'local'; description: string; disabled?: boolean; setupInstructions?: SetupInstructions }
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
    type: 'api',
    description: 'Copilot usage via GitHub',
    setupInstructions: {
      steps: [
        'Go to github.com/settings/tokens and create a classic PAT',
        'Required scopes: repo (recommended) or admin:org',
        'You must be an org admin or billing manager',
        'Paste the token here',
      ],
      note: 'Org-licensed users may not have billing access. A local file-based option is coming.',
      docsUrl: 'https://docs.github.com/en/copilot/managing-copilot/monitoring-usage-and-entitlements',
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

  return (
    <div className={`border-2 rounded-lg p-6 transition-colors ${statusColor[source?.status || 'pending']}`}>
      <h3 className="text-lg font-semibold mb-2">{info.label}</h3>
      <p className="text-sm text-slate-600 mb-4">{info.description}</p>

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
            id={`${sourceId}-credential`}
            type="password"
            placeholder="Paste your API key here"
            value={source?.credential || ''}
            onChange={handleCredentialChange}
            className="mb-3"
          />
          <button className="secondary w-full" onClick={handleValidate} disabled={validating || !source?.credential}>
            {validating ? 'Validating...' : 'Validate'}
          </button>
        </div>
      ) : info.type === 'local' ? (
        <div>
          <label className="flex items-center gap-3 text-sm font-medium mb-2">
            <input type="checkbox" checked={Boolean(source?.enabled)} onChange={handleLocalToggle} disabled={validating} />
            Enable local Claude Code analysis
          </label>
          <p className="text-xs text-slate-500">
            Promptly scans <code>~/.claude/projects</code> on this computer. No API key or file upload is required.
          </p>
          {validating && <p className="text-sm text-blue-600 mt-2">Checking local Claude Code data...</p>}
        </div>
      ) : (
        <div>
          <label htmlFor={`${sourceId}-file`} className="block text-sm font-medium mb-2">Upload File</label>
          <input id={`${sourceId}-file`} type="file" accept=".json,.jsonl" onChange={handleFileChange} className="mb-3" />
          {source?.file && <p className="text-sm text-green-600">✓ {source.file.name} selected</p>}
        </div>
      )}

      {source?.error && <p className="text-sm text-red-600 mt-2">{source.error}</p>}
      {source?.status === 'connected' && <p className="text-sm text-green-600 mt-2">✓ Connected</p>}
    </div>
  );
}
