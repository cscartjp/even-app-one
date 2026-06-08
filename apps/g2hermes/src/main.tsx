import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './App'

// useGlasses(even-toolkit) は内部で react-router の useLocation/useNavigate を使うため
// BrowserRouter で包む（単一画面でも必須）。
// biome-ignore lint/style/noNonNullAssertion: #root は index.html に常に存在する
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
