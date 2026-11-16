import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/theme.css'
import './index.css'
import App from './App.tsx'
import { registerSW } from 'virtual:pwa-register'

// Service worker (Week 8): keeps the app shell on the phone. When a new
// version is deployed it installs in the background and the page reloads
// once to use it, so a push shows up on the next open.
registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
