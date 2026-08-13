import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './v2.css'
import App from './App'
import { initGlassLight, gateGlass } from './components/Glass'
import { applyTheme, loadTheme } from './lib/accounts'
import { registerServiceWorker } from './lib/install'

document.documentElement.classList.add('v2');
// Before the first paint, not a frame after it: without this the whole app
// renders one beat in the light room and then flips.
applyTheme(loadTheme());
// Today had two spellings, '' and '#/', so the very first entry in history
// could differ from the one the Today link writes.
if (!window.location.hash) {
  window.history.replaceState(window.history.state, '', '#/');
}
gateGlass();
initGlassLight();
registerServiceWorker();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
