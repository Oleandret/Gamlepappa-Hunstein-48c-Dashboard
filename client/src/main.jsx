import { AuthGate } from './components/AuthGate.jsx';
import { AvvikView } from './components/views/AvvikView.jsx';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';

// Google-innloggingen sender alltid tilbake til '/'; gå videre til mobilsiden hvis det var der man startet.
try {
  if (window.location.pathname === '/' && sessionStorage.getItem('dashboard.returnTo') === '/avvik') window.history.replaceState(null, '', '/avvik');
  sessionStorage.removeItem('dashboard.returnTo');
} catch { /* ignore */ }

const avvikPage = window.location.pathname.replace(/\/+$/, '') === '/avvik';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthGate>{avvikPage ? <main className="min-h-screen bg-nx-bg text-nx-text"><AvvikView standalone /></main> : <App />}</AuthGate>
  </React.StrictMode>
);
