import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

// biome-ignore lint/style/noNonNullAssertion: #root は index.html に常に存在する
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
