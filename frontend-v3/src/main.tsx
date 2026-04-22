import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from '@/App'
import { installDashboardV3ErrorReporting } from '@/lib/dashboard-api'

document.documentElement.classList.add('dark')
installDashboardV3ErrorReporting()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
