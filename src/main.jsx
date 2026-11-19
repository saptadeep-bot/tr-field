import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { App } from './ui/App.jsx';
import { LiveRoot } from './ui/Live.jsx';
import { LIVE } from './config.js';

createRoot(document.getElementById('root')).render(LIVE ? <LiveRoot /> : <App />);

// Installed app: keep the app's own files on the phone so it opens instantly.
// Client data is never stored by this; it always comes from the database.
if (LIVE && 'serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
