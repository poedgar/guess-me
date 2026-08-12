describe('Email/password auth', () => {
  // A fresh, randomly-suffixed email per run avoids colliding with a
  // previous run's "already registered" state — this suite runs against
  // real production Firebase, not an emulator.
  const uniqueSuffix = Date.now();
  const testEmail = `cy-test-${uniqueSuffix}@example.com`;
  const testPassword = 'password123';
  const testDisplayName = `Cy Test ${uniqueSuffix}`;

  beforeEach(() => {
    cy.visit('/');
  });

  it('shows the Sign In tab by default with email/password fields and the Google button', () => {
    cy.get('[data-cy=signin-tab]').should('exist');
    cy.get('[data-cy=email-input]').should('exist');
    cy.get('[data-cy=password-input]').should('exist');
    cy.get('[data-cy=confirm-password-input]').should('not.exist');
    cy.get('[data-cy=google-signin-button]').should('exist');
  });

  it('switching to Register reveals the display-name and confirm-password fields', () => {
    cy.get('[data-cy=register-tab]').click();
    cy.get('[data-cy=display-name-input]').should('exist');
    cy.get('[data-cy=confirm-password-input]').should('exist');
    cy.get('[data-cy=forgot-password-link]').should('not.exist');
  });

  it('registers a new account, signs out, and signs back in with the same credentials', () => {
    cy.get('[data-cy=register-tab]').click();
    cy.get('[data-cy=display-name-input]').type(testDisplayName);
    cy.get('[data-cy=email-input]').type(testEmail);
    cy.get('[data-cy=password-input]').type(testPassword);
    cy.get('[data-cy=confirm-password-input]').type(testPassword);
    cy.get('[data-cy=register-submit-button]').click();

    // Successful registration lands past the sign-in screen, on the
    // join-game screen (JoinScreen.tsx), which is where the sign-out
    // button added in Step 1 lives.
    cy.get('[data-cy=google-signin-button]').should('not.exist');
    cy.get('[data-cy=sign-out-button]').click();

    cy.visit('/');
    cy.get('[data-cy=signin-tab]').should('exist');
    cy.get('[data-cy=email-input]').type(testEmail);
    cy.get('[data-cy=password-input]').type(testPassword);
    cy.get('[data-cy=email-signin-submit-button]').click();
    cy.get('[data-cy=google-signin-button]').should('not.exist');
  });

  it('shows a client-side error and does not submit when Register passwords do not match', () => {
    cy.get('[data-cy=register-tab]').click();
    cy.get('[data-cy=display-name-input]').type('Mismatch Test');
    cy.get('[data-cy=email-input]').type(`cy-mismatch-${uniqueSuffix}@example.com`);
    cy.get('[data-cy=password-input]').type('password123');
    cy.get('[data-cy=confirm-password-input]').type('different123');
    cy.get('[data-cy=register-submit-button]').click();
    cy.contains(/match/i).should('exist');
    // Still on the sign-in screen, not signed in.
    cy.get('[data-cy=register-tab]').should('exist');
  });

  it('forgot-password flow shows the single email field and a confirmation after sending', () => {
    cy.get('[data-cy=forgot-password-link]').click();
    cy.get('[data-cy=password-input]').should('not.exist');
    cy.get('[data-cy=reset-email-input]').type(testEmail);
    cy.get('[data-cy=send-reset-button]').click();
    cy.contains(/reset|email/i).should('exist');
  });
});
