import React from 'react';
import { useSession } from './context/SessionContext.js';
import { Landing } from './pages/Landing.js';
import { Connection } from './pages/Connection.js';
import { Analysis } from './pages/Analysis.js';
import { Results } from './pages/Results.js';
import { Error } from './pages/Error.js';

export function App() {
  const { state } = useSession();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {state.phase === 'landing' && <Landing />}
      {(state.phase === 'connection' || !state.phase) && <Connection />}
      {state.phase === 'analyzing' && <Analysis />}
      {state.phase === 'results' && <Results />}
      {state.phase === 'error' && <Error />}
    </div>
  );
}
