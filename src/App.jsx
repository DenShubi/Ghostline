import { useState } from 'react'
import Navbar from './components/Navbar.jsx'
import HomePage from './pages/HomePage.jsx'
import ReportPage from './pages/ReportPage.jsx'
import { useNanoModel } from './hooks/useNanoModel.js'
import { isCloudConfigured } from './services/auditHandoff.js'

function badgeMode(status, activity, isSharedReport) {
  if (activity === 'redacting') return 'redacting'
  if (activity === 'auditing') return isCloudConfigured ? 'cloud' : 'auditing-local'
  if (isSharedReport) return 'cloud'
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
  const [activity, setActivity] = useState(null)
  const sharedReportId = getSharedReportId()

  return (
    <div className="min-h-dvh">
      <Navbar mode={badgeMode(nano.status, activity, Boolean(sharedReportId))} progress={nano.progress} />
      {sharedReportId ? (
        <ReportPage reportId={sharedReportId} />
      ) : (
        <HomePage nano={nano} onActivityChange={setActivity} />
      )}
    </div>
  )
}
