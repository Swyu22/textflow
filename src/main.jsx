import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { applyViewportPolicy } from './mobileViewport'
import './index.css'

applyViewportPolicy()

// Mount only after the root node is present.
const rootElement = document.getElementById('root')

if (!rootElement) {
  console.error("Cannot find #root. Check index.html for <div id='root'></div>.")
} else {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}
