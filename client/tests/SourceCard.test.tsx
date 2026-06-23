import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SourceCard } from '../src/components/SourceCard';
import { SessionContext } from '../src/context/SessionContext.js';
import type { SourceId } from '../src/types/index.js';

vi.mock('../api/client.js', () => ({
  apiClient: {
    setCredential: vi.fn(),
    validate: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

function renderSourceCard(sourceId: SourceId, sourceState: Record<string, unknown> = {}) {
  const value = {
    state: {
      phase: 'connection',
      sources: {
        [sourceId]: { status: 'pending', ...sourceState },
      },
    },
    dispatch: vi.fn(),
    updateSource: vi.fn(),
    clearSession: vi.fn(),
    abortControllerRef: { current: null },
  };

  return render(
    <SessionContext.Provider value={value as any}>
      <SourceCard sourceId={sourceId} />
    </SessionContext.Provider>
  );
}

describe('SourceCard', () => {
  it('renders local Claude Code source card with enable toggle and no credential or file upload', () => {
    renderSourceCard('claude_code', { enabled: false });

    expect(screen.getByRole('heading', { name: 'Claude Code' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /enable local claude code analysis/i })).toBeInTheDocument();
    expect(screen.getByText(/no api key or file upload is required/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/api key/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/upload file/i)).not.toBeInTheDocument();
  });

  it('renders API type source card with credential input field', () => {
    renderSourceCard('anthropic');

    expect(screen.getByRole('heading', { name: 'Anthropic' })).toBeInTheDocument();
    expect(screen.getByLabelText(/api key/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/paste your api key here/i)).toHaveAttribute('type', 'password');
    expect(screen.queryByLabelText(/upload file/i)).not.toBeInTheDocument();
  });

  it('renders Claude export as a disabled stub', () => {
    renderSourceCard('claude_export');

    expect(screen.getByRole('heading', { name: 'Claude Export' })).toBeInTheDocument();
    expect(screen.getByText(/disabled mvp stub/i)).toBeInTheDocument();
    expect(screen.getByText(/currently disabled/i)).toBeInTheDocument();
    expect(screen.getByText(/not available in this mvp/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/upload file/i)).not.toBeInTheDocument();
  });

  it('shows connected indicator for connected status', () => {
    renderSourceCard('openai', { status: 'connected', credential: 'sk-test' });

    expect(screen.getByText(/connected/i)).toBeInTheDocument();
  });

  it('shows error message for error status', () => {
    renderSourceCard('openai', { status: 'error', error: 'Invalid API key' });

    expect(screen.getByText('Invalid API key')).toBeInTheDocument();
  });
});


