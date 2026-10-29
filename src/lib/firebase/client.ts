import { getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  setPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { firebaseConfig, firebaseConfigured, useEmulators } from './config';
let client: ReturnType<typeof initialize> | undefined;
function initialize() {
  const app =
    getApps().find((a) => a.name === 'nexus-client') ??
    initializeApp(firebaseConfig, 'nexus-client');
  if (app.options.projectId !== firebaseConfig.projectId)
    throw new Error('Dedicated AETHER project mismatch.');
  const auth = getAuth(app),
    realtime = getDatabase(app),
    firestore = getFirestore(app);
  if (useEmulators) {
    if (!['localhost', '127.0.0.1'].includes(location.hostname))
      throw new Error('Firebase emulators are restricted to local development.');
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectDatabaseEmulator(realtime, '127.0.0.1', 9000);
    connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
  }
  return { app, auth, realtime, firestore };
}
export function getFirebaseClient() {
  if (!firebaseConfigured || typeof window === 'undefined') return null;
  return (client ??= initialize());
}
export async function signIn(email: string, password: string) {
  const c = getFirebaseClient();
  if (!c) throw new Error('Firebase is not configured.');
  await setPersistence(c.auth, browserSessionPersistence);
  const { signInWithEmailAndPassword } = await import('firebase/auth');
  await signInWithEmailAndPassword(c.auth, email, password);
}
export async function signOut() {
  window.dispatchEvent(new Event('nexus:camera-signout'));
  const c = getFirebaseClient();
  try {
    if (c) await (await import('firebase/auth')).signOut(c.auth);
  } finally {
    await fetch('/api/response/cameras', { method: 'DELETE' }).catch(() => {});
  }
}
export async function getFirebaseToken() {
  return getFirebaseClient()?.auth.currentUser?.getIdToken() ?? null;
}
