import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'
import './styles/global.css'

window.addEventListener('unhandledrejection', (event) => {
  console.error('[unhandledrejection]', event.reason)
})

const root = (
  <App />
)

ReactDOM.createRoot(document.getElementById('root')!).render(
  import.meta.env.DEV ? <React.StrictMode>{root}</React.StrictMode> : root,
)
