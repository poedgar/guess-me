import { defineConfig } from 'cypress';
import { cleanupTestGames } from './cypress/tasks/cleanupTestGames';

export default defineConfig({
  e2e: {
    baseUrl: 'https://in-the-mirror.vercel.app',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
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
