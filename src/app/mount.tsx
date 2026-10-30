import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

export function mount(rootElement: HTMLElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
