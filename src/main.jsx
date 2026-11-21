import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Dev only: run `await ghostline.testNano()` in the console to verify local inference (T02).
if (import.meta.env.DEV) {
  import('./services/localNanoService.js').then(({ runLocalSmokeTest, getNanoAvailability }) => {
    window.ghostline = { testNano: runLocalSmokeTest, nanoStatus: getNanoAvailability }
  })
}
