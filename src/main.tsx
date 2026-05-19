import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from '#/App.tsx'
import { registerPwa } from '#/lib/pwa.ts'
import './styles.css'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found')

registerPwa()

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
