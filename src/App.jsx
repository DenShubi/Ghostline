import { useEffect, useState } from 'react'
import Navbar from './components/Navbar.jsx'
import HomePage from './pages/HomePage.jsx'
import { getNanoAvailability } from './services/localNanoService.js'

const NANO_MISSING = new Set(['unsupported', 'unavailable'])

export default function App() {
  const [nanoStatus, setNanoStatus] = useState('checking')

  useEffect(() => {
    getNanoAvailability().then(({ status }) => setNanoStatus(status))
  }, [])

  const nanoMissing = NANO_MISSING.has(nanoStatus)
  const mode = nanoStatus === 'checking' ? 'checking' : nanoMissing ? 'fallback' : 'local'

  return (
    <div className="min-h-dvh">
      <Navbar mode={mode} />
      <HomePage nanoMissing={nanoMissing} />
    </div>
  )
}
