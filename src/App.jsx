import { useState } from 'react'
import Navbar from './components/Navbar.jsx'
import HomePage from './pages/HomePage.jsx'
import { useNanoModel } from './hooks/useNanoModel.js'
import { isCloudConfigured } from './services/auditHandoff.js'

function badgeMode(status, activity) {
  if (activity === 'redacting') return 'redacting'
  if (activity === 'auditing') return isCloudConfigured ? 'cloud' : 'auditing-local'
  if (status === 'checking') return 'checking'
  if (status === 'available') return 'local'
  if (status === 'downloadable' || status === 'downloading') return 'downloading'
  return 'fallback'
}

export default function App() {
  const nano = useNanoModel()
  const [activity, setActivity] = useState(null)

  return (
    <div className="min-h-dvh">
      <Navbar mode={badgeMode(nano.status, activity)} progress={nano.progress} />
      <HomePage nano={nano} onActivityChange={setActivity} />
    </div>
  )
}
