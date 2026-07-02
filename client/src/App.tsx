import React from 'react';
import { useSession } from './context/SessionContext.js';
import { Landing } from './pages/Landing.js';
import { Analysis } from './pages/Analysis.js';
import { Results } from './pages/Results.js';
import { Error } from './pages/Error.js';

export function App() {
  const { state } = useSession();

  return (
    // WP-1: <main> landmark so assistive technology can navigate to main content
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-base)' }}>
      <main id="main-content">
        {state.phase === 'landing' && <Landing />}
        {(state.phase === 'connection' || !state.phase) && <Landing />}
        {state.phase === 'analyzing' && <Analysis />}
        {state.phase === 'results' && <Results />}
        {state.phase === 'error' && <Error />}
      </main>
    </div>
  );
}
