import { useCallback, useEffect, useRef, useState } from 'react'
import { createNanoSession, getNanoAvailability } from '../services/localNanoService.js'

/**
 * Gemini Nano availability for the whole app, plus `prepare()` to start the
 * model download. Chrome only allows that download inside a user gesture, so
 * call `prepare()` synchronously from a click handler.
 */
export function useNanoModel() {
  const [status, setStatus] = useState('checking')
  const [progress, setProgress] = useState(null)
  const started = useRef(false)

  useEffect(() => {
    let alive = true
    getNanoAvailability().then(({ status: next }) => alive && setStatus(next))
    return () => {
      alive = false
    }
  }, [])

  const prepare = useCallback(() => {
    if (started.current || (status !== 'downloadable' && status !== 'downloading')) return
    started.current = true
    setStatus('downloading')
    createNanoSession({ onDownloadProgress: setProgress })
      .then((session) => {
        session.destroy()
        setStatus('available')
        setProgress(null)
      })
      .catch(async (err) => {
        console.warn('[nano] model download did not finish', err)
        started.current = false
        setProgress(null)
        setStatus((await getNanoAvailability()).status)
      })
  }, [status])

  return { status, progress, prepare }
}
