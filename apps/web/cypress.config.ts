import { defineConfig } from 'cypress';
import { cleanupTestAuthUsers } from './cypress/tasks/cleanupTestAuthUsers';
import { cleanupTestGames } from './cypress/tasks/cleanupTestGames';

export default defineConfig({
  e2e: {
    baseUrl: 'https://in-the-mirror.vercel.app',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    // Real production Firestore's long-polling fallback (used by both the
    // headless Electron browser this suite originally validated against,
    // and Chrome, which CI now uses) is visibly slower to propagate a
    // write from one signed-in account to another account's fresh page
    // load than the 4s default — mirror-round.cy.ts drives three real
    // accounts cross-reading each other's writes throughout.
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
      // Sweeps any leftover test games out of production Firestore. Registered
      // on both before:run and after:run: after:run only fires on a run that
      // completes naturally, so a run that's killed mid-spec (or `cypress open`
      // closed without finishing) would otherwise leave a test game behind
      // until some later run's after:run happened to sweep it up. Running the
      // same sweep at the start of every run means each run cleans up after
      // whatever the previous one left, regardless of how that one ended.
      const runCleanup = async (label: string) => {
        const serviceAccountPath = config.env.firebaseServiceAccountPath as string;
        const adminEmail = (config.env.testAccounts as { test1: { email: string } }).test1.email;
        const result = await cleanupTestGames(serviceAccountPath, adminEmail);
        // eslint-disable-next-line no-console
        console.log(`[cleanupTestGames:${label}] Deleted ${result.deleted} test game(s).`);

        const authResult = await cleanupTestAuthUsers(serviceAccountPath);
        // eslint-disable-next-line no-console
        console.log(
          `[cleanupTestAuthUsers:${label}] Deleted ${authResult.deleted} test auth user(s).`,
        );
      };
      on('before:run', async () => {
        await runCleanup('before:run');
      });
      on('after:run', async () => {
        await runCleanup('after:run');
      });
    },
  },
});
