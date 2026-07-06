import React, { useEffect, useRef } from 'react';
import { useSession } from './context/SessionContext.js';
import { Landing } from './pages/Landing.js';
import { Analysis } from './pages/Analysis.js';
import { Results } from './pages/Results.js';
import { Error } from './pages/Error.js';

export function App() {
  const { state } = useSession();

  // WP-7: Move focus to the new page's primary heading on phase transition.
  // B-ARIA-02: focusedPhaseRef guards against re-firing for the same phase (e.g.
  // React StrictMode double-invocation, or context updates that preserve state.phase).
  const focusedPhaseRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (focusedPhaseRef.current === state.phase) return;
    focusedPhaseRef.current = state.phase;
    const id = setTimeout(() => {
      const heading = document.querySelector<HTMLElement>('[data-focus-on-mount]');
      if (heading) heading.focus();
    }, 50);
    return () => clearTimeout(id);
  }, [state.phase]);

  return (
    // WP-1: <main> landmark so assistive technology can navigate to main content
    <div style={{ minHeight: '100vh', background: 'var(--color-bg-base)' }}>
      <main id="main-content">
        {(state.phase === 'landing' || !state.phase) && <Landing />}
        {state.phase === 'analyzing' && <Analysis />}
        {state.phase === 'results' && <Results />}
        {state.phase === 'error' && <Error />}
      </main>
    </div>
  );
}
