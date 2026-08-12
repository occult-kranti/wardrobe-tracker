import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './v2.css'
import App from './App'
import { initGlassLight, gateGlass } from './components/Glass'

document.documentElement.classList.add('v2');
gateGlass();
initGlassLight();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
