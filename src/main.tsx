import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './v2.css'
import App from './App'

document.documentElement.classList.add('v2');
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
