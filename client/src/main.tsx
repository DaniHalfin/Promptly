import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { SessionProvider } from './context/SessionContext.js';
import './index.css';

// Apply saved theme before React renders to prevent flash
const savedTheme = localStorage.getItem('promptly_theme') ?? 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SessionProvider>
      <App />
    </SessionProvider>
  </React.StrictMode>
);
