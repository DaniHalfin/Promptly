import React, { useState } from 'react';
import { useSession } from '../context/SessionContext.js';
import { apiClient } from '../api/client.js';
import { SourceCard } from '../components/SourceCard.js';
import type { SourceConfig, SourceId } from '../types/index.js';

export function Connection() {
  const { dispatch, state, abortControllerRef } = useSession();
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 86400000 * 30).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  // Check if at least one source is connected
  const hasConnectedSource = Object.values(state.sources).some(
    s => s?.status === 'connected' || s?.status === 'ready'
  );

  const isActive = (sourceId: SourceId) => {
    const source = state.sources[sourceId];
    return source?.status === 'connected' || source?.status === 'ready';
  };

  const sourceConfig = (sourceId: SourceId, hasCredential: boolean): SourceConfig => ({
    sourceId,
    hasCredential,
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  const handleStart = async () => {
    try {
      const config: { sources: SourceConfig[] } = {
        sources: [
          isActive('openai') ? sourceConfig('openai', true) : null,
          isActive('anthropic') ? sourceConfig('anthropic', true) : null,
          isActive('github_copilot') ? sourceConfig('github_copilot', true) : null,
          isActive('chatgpt_export') ? sourceConfig('chatgpt_export', false) : null,
          isActive('claude_code') ? sourceConfig('claude_code', false) : null,
        ].filter((source): source is SourceConfig => source !== null),
      };

      dispatch({ phase: 'analyzing' });

      const credentials = {
        openai: state.sources.openai?.credential,
        anthropic: state.sources.anthropic?.credential,
        github_copilot: state.sources.github_copilot?.credential,
      };

      const files = {
        chatgpt_export: state.sources.chatgpt_export?.file,
      };

      // Create a new AbortController for this analysis
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const report = await apiClient.analyze(config, credentials, files, controller.signal);
        // Only dispatch results if the request wasn't aborted
        if (!controller.signal.aborted) {
          dispatch(report.cross_source_summary.allSourcesFailed ? { phase: 'connection', report } : { phase: 'results', report });
        }
      } finally {
        abortControllerRef.current = null;
      }
    } catch (err) {
      // Don't dispatch error if this was an AbortError (user cancelled)
      if ((err as Error).name === 'AbortError') return;
      dispatch({ phase: 'error', analysisError: (err as Error).message });
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Connect Your Sources</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <SourceCard sourceId="openai" />
          <SourceCard sourceId="anthropic" />
          <SourceCard sourceId="github_copilot" />
          <SourceCard sourceId="chatgpt_export" />
          <SourceCard sourceId="claude_code" />
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">Analysis Period</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Start Date</label>
              <input type="date" value={dateRange.start} onChange={e => setDateRange({ ...dateRange, start: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">End Date</label>
              <input type="date" value={dateRange.end} onChange={e => setDateRange({ ...dateRange, end: e.target.value })} />
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button className="primary" onClick={handleStart} disabled={!hasConnectedSource}>
            Start Analysis
          </button>
          <button className="secondary" onClick={() => dispatch({ phase: 'landing' })}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
