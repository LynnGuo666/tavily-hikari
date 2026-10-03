import React from 'react'
import ReactDOM from 'react-dom/client'
import { installDemoRuntime } from './api/demo'
import { LanguageProvider } from './i18n'
import RegistrationPaused from './pages/RegistrationPaused'
import AgentationToolbar from './components/AgentationToolbar'
import { bootstrapOfflineShellDocument, registerPwaServiceWorker } from './pwa/runtime'
import { ThemeProvider } from './theme-provider'
import './index.css'

installDemoRuntime()
bootstrapOfflineShellDocument()
void registerPwaServiceWorker('public')

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <LanguageProvider>
      <ThemeProvider>
        <RegistrationPaused />
        <AgentationToolbar />
      </ThemeProvider>
    </LanguageProvider>
  </React.StrictMode>,
)
