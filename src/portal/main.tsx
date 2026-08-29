import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import './portal.css';
import App from './App';

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
