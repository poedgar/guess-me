import { defineConfig } from 'cypress';
import { cleanupTestGames } from './cypress/tasks/cleanupTestGames';

export default defineConfig({
  e2e: {
    baseUrl: 'https://in-the-mirror.vercel.app',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    // Real production Firestore in this headless Electron browser falls
    // back to long-polling (no WebSocket), which is visibly slower to
    // propagate a write from one signed-in account to another account's
    // fresh page load than the 4s default — mirror-round.cy.ts drives
    // three real accounts cross-reading each other's writes throughout.
    defaultCommandTimeout: 15000,
    // mirror-round.cy.ts drives ~15 real account switches against real
    // production Firebase Auth + Firestore. One retry absorbs an
    // occasional one-off network/auth blip without masking a real
    // assertion failure, which still fails after retrying.
    retries: {
      runMode: 1,
      openMode: 0,
    },
    setupNodeEvents(on, config) {
      on('after:run', async () => {
        const serviceAccountPath = config.env.firebaseServiceAccountPath as string;
        const adminEmail = (config.env.testAccounts as { test1: { email: string } }).test1.email;
        const result = await cleanupTestGames(serviceAccountPath, adminEmail);
        // eslint-disable-next-line no-console
        console.log(`[cleanupTestGames] Deleted ${result.deleted} test game(s).`);
      });
    },
  },
});
