import { useState } from 'react'
import Navbar from './components/Navbar.jsx'
import HomePage from './pages/HomePage.jsx'
import ReportPage from './pages/ReportPage.jsx'
import { useNanoModel } from './hooks/useNanoModel.js'

function badgeMode(status, localBusy, cloudBusy, isSharedReport) {
  if (localBusy) return 'redacting'
  if (cloudBusy || isSharedReport) return 'cloud'
  if (status === 'checking') return 'checking'
  if (status === 'available') return 'local'
  if (status === 'downloadable' || status === 'downloading') return 'downloading'
  return 'fallback'
}

function getSharedReportId() {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('report')?.trim() || null
}

export default function App() {
  const nano = useNanoModel()
  const [busy, setBusy] = useState(false)
  const [cloudBusy, setCloudBusy] = useState(false)
  const sharedReportId = getSharedReportId()

  return (
    <div className="min-h-dvh">
      <Navbar mode={badgeMode(nano.status, busy, cloudBusy, Boolean(sharedReportId))} progress={nano.progress} />
      {sharedReportId ? (
        <ReportPage reportId={sharedReportId} />
      ) : (
        <HomePage nano={nano} onBusyChange={setBusy} onCloudBusyChange={setCloudBusy} />
      )}
    </div>
  )
}
