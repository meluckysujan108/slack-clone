import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

if (location.protocol === 'https:' && !import.meta.env.VITE_WS_URL) {
  console.warn('Using secure context; set VITE_WS_URL to your wss:// server')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
