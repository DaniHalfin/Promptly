import React, { useEffect, useState } from 'react';
import { useSession } from '../context/SessionContext.js';

export function Analysis() {
  const { state, dispatch, abortControllerRef } = useSession();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsed(e => e + 1), 1000);
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, []);

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}m ${seconds % 60}s`;

  const handleCancel = () => {
    // Abort the analysis request
    abortControllerRef.current?.abort();
    // Transition back to connection
    dispatch({ phase: 'connection' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md w-full">
        <div className="mb-8">
          <div className="inline-block">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
          </div>
        </div>

        <h2 className="text-2xl font-semibold mb-4">Analyzing Your Data</h2>
        <p className="text-slate-600 mb-2">Elapsed time: {formatTime(elapsed)}</p>

        <div className="bg-white rounded-lg p-6 mb-6 text-left">
          <h3 className="font-semibold mb-2">What's happening:</h3>
          <ul className="space-y-1 text-sm text-slate-600">
            <li>• Connecting to your API sources</li>
            <li>• Processing usage data</li>
            <li>• Calculating metrics</li>
            <li>• Generating recommendations</li>
          </ul>
        </div>

        <button className="danger" onClick={handleCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
