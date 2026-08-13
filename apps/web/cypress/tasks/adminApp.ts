import admin from 'firebase-admin';
import { readFileSync } from 'node:fs';

let cachedApp: admin.app.App | null = null;

/**
 * Returns the single process-wide Firebase Admin app shared by every
 * cleanup task. `admin.initializeApp()` registers a app-name-keyed
 * singleton and throws `app/invalid-app-options` if called again while a
 * default app already exists — since both cleanupTestGames and
 * cleanupTestAuthUsers run in the same before:run/after:run cycle, they
 * must share one cached instance here rather than each keeping its own.
 */
export function getAdminApp(serviceAccountPath: string): admin.app.App {
  if (cachedApp) return cachedApp;
  // `apps/web/package.json` sets `"type": "module"`, so cypress.config.ts
  // (and everything it imports) loads as ESM under ts-node — `require` is
  // not defined in that scope. Read and parse the JSON file directly
  // instead of relying on CommonJS's `require`.
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
  cachedApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  return cachedApp;
}
