export const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
};
export const firebaseConfigured = Object.entries(firebaseConfig)
  .filter(([key]) => key !== 'storageBucket')
  .every(([, value]) => !!value);
export const siteId = /^[A-Za-z0-9_-]{1,80}$/.test(process.env.NEXT_PUBLIC_NEXUS_SITE_ID || '')
  ? process.env.NEXT_PUBLIC_NEXUS_SITE_ID!
  : 'main';
const age = Number(process.env.NEXT_PUBLIC_NEXUS_FRESHNESS_MS);
export const freshnessMs = Number.isFinite(age) && age >= 1000 && age <= 86400000 ? age : 60000;
export const useEmulators = process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === 'true';
