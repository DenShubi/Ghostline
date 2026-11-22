/**
 * Core Firebase initialization for Ghostline.
 *
 * Exports the initialized Firebase App, Firestore database (`db`),
 * Firebase AI Logic client (`ai`), and App Check instance (`appCheck`).
 *
 * PRIVACY CONTRACT: Only anonymised / PII-redacted procurement line items
 * may ever be sent to `ai` (Cloud Gemini) or stored in `db` (Firestore).
 */

import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAI, GoogleAIBackend } from 'firebase/ai'
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check'
import { getFirestore } from 'firebase/firestore'

const env = import.meta.env ?? {}

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
)

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)

/**
 * Initialize Firebase App Check in browser environments.
 * In Vite dev mode (`import.meta.env.DEV`), enables the App Check debug token
 * so local testing against Firebase AI Logic and Firestore works smoothly.
 */
function setupAppCheck(firebaseApp) {
  if (typeof window === 'undefined') return null

  const debugEnv = env.VITE_FIREBASE_APPCHECK_DEBUG_TOKEN
  if (env.DEV) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN =
      debugEnv && debugEnv !== 'true' ? debugEnv : true
  }

  const recaptchaSiteKey = env.VITE_FIREBASE_RECAPTCHA_SITE_KEY
  if (!env.DEV && !recaptchaSiteKey) {
    console.warn(
      '[firebase] App Check skipped in production: set VITE_FIREBASE_RECAPTCHA_SITE_KEY to enforce App Check.',
    )
    return null
  }

  return initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey || 'dev-debug-token-placeholder'),
    isTokenAutoRefreshEnabled: true,
  })
}

export const appCheck = setupAppCheck(app)
export const db = getFirestore(app)
export const ai = getAI(app, { backend: new GoogleAIBackend() })
