import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App.jsx'
import { applyViewportPolicy } from './mobileViewport'
import './index.css'

// P2-4: production error monitoring.
// Sentry is initialized only when VITE_SENTRY_DSN is set, so the SDK is
// a no-op cost (just bundle size) until you provision a Sentry project.
// See README "Production monitoring" section for setup instructions.
const sentryDsn = import.meta.env.VITE_SENTRY_DSN
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    environment: import.meta.env.MODE,
    // Capture 10% of routine traces to stay within free-tier limits;
    // bump up if you need more granular performance data.
    tracesSampleRate: 0.1,
    // Don't send PII by default — TextFlow stores user notes in plaintext
    // and we should not leak them to a third-party error tracker.
    sendDefaultPii: false,
  })
}

applyViewportPolicy()

// Mount only after the root node is present.
const rootElement = document.getElementById('root')

if (!rootElement) {
  console.error("Cannot find #root. Check index.html for <div id='root'></div>.")
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <Sentry.ErrorBoundary fallback={<div style={{ padding: 20 }}>页面遇到错误，请刷新重试。</div>}>
        <App />
      </Sentry.ErrorBoundary>
    </React.StrictMode>,
  )
}
