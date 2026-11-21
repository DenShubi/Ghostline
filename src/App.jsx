import { useState } from 'react'
import Navbar from './components/Navbar.jsx'
import HomePage from './pages/HomePage.jsx'
import { useNanoModel } from './hooks/useNanoModel.js'

function badgeMode(status, busy) {
  if (busy) return 'redacting'
  if (status === 'checking') return 'checking'
  if (status === 'available') return 'local'
  if (status === 'downloadable' || status === 'downloading') return 'downloading'
  return 'fallback'
}

export default function App() {
  const nano = useNanoModel()
  const [busy, setBusy] = useState(false)

  return (
    <div className="min-h-dvh">
      <Navbar mode={badgeMode(nano.status, busy)} progress={nano.progress} />
      <HomePage nano={nano} onBusyChange={setBusy} />
    </div>
  )
}
