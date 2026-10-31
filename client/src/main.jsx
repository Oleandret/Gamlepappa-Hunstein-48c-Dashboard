import { AuthGate } from './components/AuthGate.jsx';
import { HusetView } from './components/huset/HusetView.jsx';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';

// Google-innloggingen sender alltid tilbake til '/'; gå videre til mobilsiden hvis det var der man startet.
try {
  const returnTo = sessionStorage.getItem('dashboard.returnTo');
  if (window.location.pathname === '/' && ['/avvik', '/huset', '/paaminnelser', '/veiledninger'].includes(returnTo)) window.history.replaceState(null, '', returnTo);
  sessionStorage.removeItem('dashboard.returnTo');
} catch { /* ignore */ }

const path = window.location.pathname.replace(/\/+$/, '');
const mobilePage = { '/avvik': 'avvik', '/huset': 'gjoremal', '/paaminnelser': 'paaminnelser', '/veiledninger': 'veiledninger' }[path];

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthGate>{session => mobilePage || session?.role === 'beboer'
      ? <main className="min-h-screen bg-nx-bg text-nx-text"><HusetView standalone initialTab={mobilePage || 'gjoremal'} user={session} /></main>
      : <App />}</AuthGate>
  </React.StrictMode>
);
