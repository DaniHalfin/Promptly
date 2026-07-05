import React from 'react';
import { useSession } from '../context/SessionContext.js';

export function Error() {
  const { state, dispatch } = useSession();

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* WP-2: aria-hidden — decorative emoji has no information value for AT users */}
        <div className="mb-6 text-6xl text-red-500" aria-hidden="true">⚠️</div>
        {/* WP-7: tabIndex={-1} + data-focus-on-mount enables programmatic focus on phase transition */}
        <h1 className="text-3xl font-bold mb-4 text-slate-900" tabIndex={-1} data-focus-on-mount style={{ outline: 'none' }}>Analysis Failed</h1>
        <p className="text-slate-600 mb-6">{state.analysisError || 'An unknown error occurred'}</p>

        <div className="flex gap-4">
          <button className="primary flex-1" onClick={() => dispatch({ phase: 'landing' })}>
            Try Again
          </button>
          <button className="secondary flex-1" onClick={() => dispatch({ phase: 'landing', sources: {} })}>
            Start Over
          </button>
        </div>
      </div>
    </div>
  );
}
