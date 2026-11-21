import { useEffect, useState } from 'react'
import Navbar from './components/Navbar.jsx'
import HomePage from './pages/HomePage.jsx'
import { canRunNano, getNanoAvailability } from './services/localNanoService.js'

export default function App() {
  const [nanoStatus, setNanoStatus] = useState('checking')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getNanoAvailability().then(({ status }) => setNanoStatus(status))
  }, [])

  const nanoMissing = nanoStatus !== 'checking' && !canRunNano(nanoStatus)
  const mode = busy ? 'redacting' : nanoStatus === 'checking' ? 'checking' : nanoMissing ? 'fallback' : 'local'

  return (
    <div className="min-h-dvh">
      <Navbar mode={mode} />
      <HomePage nanoMissing={nanoMissing} onBusyChange={setBusy} />
    </div>
  )
}
