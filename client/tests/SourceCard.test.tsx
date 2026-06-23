import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

  it('renders "How to connect" toggle for non-disabled sources', () => {
    renderSourceCard('openai');

    expect(screen.getByRole('button', { name: /how to connect/i })).toBeInTheDocument();
    // instructions hidden initially
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('expands setup instructions when toggle is clicked', () => {
    renderSourceCard('openai');

    const toggle = screen.getByRole('button', { name: /how to connect/i });
    fireEvent.click(toggle);

    expect(screen.getByText(/platform.openai.com\/api-keys/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /official docs/i })).toBeInTheDocument();
    // toggle label changes
    expect(screen.getByRole('button', { name: /hide/i })).toBeInTheDocument();
  });

  it('collapses instructions when toggle is clicked again', () => {
    renderSourceCard('openai');

    const toggle = screen.getByRole('button', { name: /how to connect/i });
    fireEvent.click(toggle); // expand
    fireEvent.click(screen.getByRole('button', { name: /hide/i })); // collapse

    expect(screen.queryByText(/platform.openai.com\/api-keys/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /how to connect/i })).toBeInTheDocument();
  });

  it('shows amber note in expanded GitHub Copilot instructions', () => {
    renderSourceCard('github_copilot');

    fireEvent.click(screen.getByRole('button', { name: /how to connect/i }));

    expect(screen.getByText(/org-licensed users may not have billing access/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /official docs/i })).toBeInTheDocument();
  });

  it('shows setup instructions for claude_code without a docsUrl link', () => {
    renderSourceCard('claude_code', { enabled: false });

    fireEvent.click(screen.getByRole('button', { name: /how to connect/i }));

    expect(screen.getByText(/no setup needed/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /official docs/i })).not.toBeInTheDocument();
  });

  it('does NOT render the toggle for disabled claude_export source', () => {
    renderSourceCard('claude_export');

    expect(screen.queryByRole('button', { name: /how to connect/i })).not.toBeInTheDocument();
  });
});


