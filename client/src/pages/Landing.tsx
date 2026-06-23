import React from 'react';
import { useSession } from '../context/SessionContext.js';

export function Landing() {
  const { dispatch } = useSession();

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-5xl font-bold mb-4 text-slate-900">Promptly</h1>
        <p className="text-xl text-slate-600 mb-6">Local-first AI token economy analysis. No data persistence. No external servers.</p>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-slate-900">Privacy First</h2>
          <p className="text-slate-700 mb-4">
            All analysis happens on your device. Your API credentials and files never leave your browser. Promptly is completely local—zero data is stored on any external server.
          </p>
          <ul className="text-left text-slate-600 space-y-2 mb-6">
            <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Connect to OpenAI, Anthropic, GitHub Copilot</li>
            <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Upload ChatGPT or Claude export files</li>
            <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Analyze token usage and costs</li>
            <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Get personalized recommendations</li>
            <li className="flex items-center"><span className="text-green-500 mr-2">✓</span> Export results as PDF or JSON</li>
          </ul>
        </div>

        <button className="primary text-lg px-8 py-3" onClick={() => dispatch({ phase: 'connection' })}>
          Start Analysis
        </button>
      </div>
    </div>
  );
}
