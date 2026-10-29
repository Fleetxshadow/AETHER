import 'server-only';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
export function getNexusAdmin() {
  if (process.env.NEXUS_FIREBASE_ADMIN_ENABLED !== 'true') return null;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId || process.env.NEXUS_FIREBASE_PROJECT_ID !== projectId)
    throw new Error('Dedicated AETHER server project must match client configuration.');
  for (const key of ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST'])
    if (process.env[key] && !/^127\.0\.0\.1:\d+$/.test(process.env[key]!))
      throw new Error('Only loopback emulator endpoints are permitted.');
  const app =
    getApps().find((a) => a.name === 'nexus-server') ??
    initializeApp({ projectId, credential: applicationDefault() }, 'nexus-server');
  if (app.options.projectId !== projectId) throw new Error('AETHER server project mismatch.');
  return { auth: getAuth(app), firestore: getFirestore(app) };
}
