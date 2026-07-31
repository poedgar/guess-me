import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'https://in-the-mirror.vercel.app',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    setupNodeEvents(_on, _config) {
      // Tasks registered here by later tasks in this plan (Task 4's cleanup task).
    },
  },
});
