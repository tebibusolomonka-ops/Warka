import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './style.css'

if ('serviceWorker' in navigator && import.meta.env.PROD)
  void navigator.serviceWorker.register('/service-worker.js')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
