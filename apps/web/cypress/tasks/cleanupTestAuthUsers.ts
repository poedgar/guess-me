import admin from 'firebase-admin';
import { readFileSync } from 'node:fs';

let cachedApp: admin.app.App | null = null;

function getAdminApp(serviceAccountPath: string): admin.app.App {
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

// Matches the throwaway emails email-password-auth.cy.ts registers against
// real production Firebase Auth on every run (`cy-test-<timestamp>@example.com`,
// `cy-mismatch-<timestamp>@example.com`), and nothing else — in particular not
// the persistent test1/test2/test3 accounts the rest of the suite signs in as.
const TEST_AUTH_USER_EMAIL_PATTERN = /^cy-(test|mismatch)-\d+@example\.com$/;

const AUTH_USER_DELETE_BATCH_SIZE = 1000;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Deletes every Firebase Auth user whose email matches the throwaway
 * `cy-test-*`/`cy-mismatch-*` pattern created by email-password-auth.cy.ts,
 * so production Firebase Auth doesn't accumulate a new real account on every
 * run (and every 6-hour cron run) forever. Paginates through the full user
 * list rather than looking accounts up by email, since there's no query-by-
 * pattern API and the exact emails (with their timestamp suffixes) aren't
 * known ahead of time.
 */
export async function cleanupTestAuthUsers(
  serviceAccountPath: string,
): Promise<{ deleted: number }> {
  const app = getAdminApp(serviceAccountPath);
  const auth = admin.auth(app);

  const matchingUids: string[] = [];
  let pageToken: string | undefined;
  do {
    const result = await auth.listUsers(1000, pageToken);
    for (const user of result.users) {
      if (user.email && TEST_AUTH_USER_EMAIL_PATTERN.test(user.email)) {
        matchingUids.push(user.uid);
      }
    }
    pageToken = result.pageToken;
  } while (pageToken);

  let deleted = 0;
  for (const uidBatch of chunk(matchingUids, AUTH_USER_DELETE_BATCH_SIZE)) {
    const result = await auth.deleteUsers(uidBatch);
    deleted += result.successCount;
  }

  return { deleted };
}
