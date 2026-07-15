import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/700.css'
import App from './App'
import { ToastProvider } from './hooks/useToast'
import './styles/tokens.css'
import './styles/header.css'
import './styles/home.css'
import './styles/article.css'
import './styles/chat.css'
import './styles/settings.css'
import './styles/base.css'

// biome-ignore lint/style/noNonNullAssertion: #root 元素在 index.html 必然存在
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
