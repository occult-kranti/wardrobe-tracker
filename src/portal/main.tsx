import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import './portal.css';
import App from './App';

// Remove this portal's former session-persisted credential without reading it.
// New credentials live only in React state, including on the published origin.
try { window.sessionStorage.removeItem('almari-admin-token'); } catch { /* storage can be refused */ }

/**
 * THE BOARD'S ENTRY, AND THE THREE THINGS IT DELIBERATELY DOES NOT DO.
 *
 *   registerServiceWorker() — a monitoring board must never be answered from a
 *     cached yesterday. publicDir is off in this build, so there is no worker
 *     to register even by accident; this is the second lock on the same door.
 *   applyTheme() / loadTheme() — those live in src/lib/accounts.ts, which is
 *     the account layer. portal.html names its room in one attribute instead.
 *   documentElement.classList.add('v2') — v2.css is not imported, so `plate`
 *     resolves to the flat paper plate rather than the glass one. Right for a
 *     dense board of numbers, and it costs nothing to leave out.
 */
createRoot(document.getElementById('portal-root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
