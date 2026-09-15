import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore'

// This adapter is only resolved by tests/config.mjs, never the production build.
export const app = initializeApp({
  projectId: 'demo-bank-checks',
  apiKey: 'emulator-only',
  authDomain: 'localhost',
}, `checks-${crypto.randomUUID()}`)
export const auth = getAuth(app)
export const db = getFirestore(app)
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
connectFirestoreEmulator(db, '127.0.0.1', 8080)
export const adminDb = db
export const adminAuth = auth
export const firestoreCircuitBreaker = { canOperate: () => true }
