import { AuthGate } from './components/AuthGate.jsx';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthGate><App /></AuthGate>
  </React.StrictMode>
);
