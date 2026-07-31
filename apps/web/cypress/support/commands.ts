export type TestUserRole = 'test1' | 'test2' | 'test3';

declare global {
  namespace Cypress {
    interface Chainable {
      signInAsTestUser(role: TestUserRole): Chainable<void>;
    }
  }
}

Cypress.Commands.add('signInAsTestUser', (role: TestUserRole) => {
  const account = Cypress.env('testAccounts')[role];
  if (!account) {
    throw new Error(`No test account configured for role "${role}" in cypress.env.json`);
  }

  cy.session(
    role,
    () => {
      cy.visit('/');
      cy.window().should('have.property', '__cypressSignInWithEmail');
      cy.window().then((win) => {
        return win.__cypressSignInWithEmail!(account.email, account.password);
      });
      // Wait until the sign-in button is gone — proof onAuthStateChanged
      // fired and the app moved past the sign-in screen — before
      // cy.session snapshots storage.
      cy.get('[data-cy=google-signin-button]').should('not.exist');
    },
    {
      validate: () => {
        cy.visit('/');
        cy.get('[data-cy=google-signin-button]').should('not.exist');
      },
      cacheAcrossSpecs: false,
    },
  );

  cy.visit('/');
});
