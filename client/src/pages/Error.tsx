import React from 'react';
import { useSession } from '../context/SessionContext.js';

export function Error() {
  const { state, dispatch } = useSession();

  return (
    <div
      data-testid="error-page"
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: 'var(--color-bg-base)',
      }}
    >
      <div style={{
        width: '100%',
        maxWidth: 448,
        textAlign: 'center',
        background: 'var(--color-bg-surface)',
        border: '1px solid var(--color-input-border)',
        borderRadius: 'var(--radius-lg)',
        padding: '32px 24px',
      }}>
        {/* WP-2: aria-hidden — decorative emoji has no information value for AT users */}
        <div style={{ marginBottom: 24, fontSize: '3.75rem', lineHeight: 1, color: 'var(--color-critical-text)' }} aria-hidden="true">⚠️</div>
        {/* WP-7: tabIndex={-1} + data-focus-on-mount enables programmatic focus on phase transition */}
        {/* B4: className="focus-target" replaces inline outline:none — ring is visible on programmatic .focus() via B3 fix */}
        <h1
          tabIndex={-1}
          data-focus-on-mount
          className="focus-target"
          style={{
            margin: '0 0 16px',
            fontSize: 'var(--text-title)',
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}
        >
          Analysis Failed
        </h1>
        <p style={{ margin: '0 0 24px', color: 'var(--text-secondary)', fontSize: 'var(--text-body)' }}>
          {state.analysisError || 'An unknown error occurred'}
        </p>

        <div data-testid="error-actions" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button className="primary" style={{ flex: '1 1 160px' }} onClick={() => dispatch({ phase: 'landing' })}>
            Try Again
          </button>
          <button className="secondary" style={{ flex: '1 1 160px' }} onClick={() => dispatch({ phase: 'landing', sources: {} })}>
            Start Over
          </button>
        </div>
      </div>
    </div>
  );
}

