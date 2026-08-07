describe('Admin leaves the game', () => {
  it('transitions the game to finished with the admin-left view for remaining participants', () => {
    const SETTLE_MS = 1500;

    // ── Set up: admin creates the game, test2 joins ────────────────────────
    cy.signInAsTestUser('test1');
    cy.get('[data-cy=game-input]').type('YR20RZ67FKy88HQVF6yW3');
    cy.get('[data-cy=game-input-submit]').click();
    cy.url().should('match', /\/game\/[^/]+$/);

    cy.url().then((url) => {
      const gameId = decodeURIComponent(url.split('/game/')[1]);

      cy.signInAsTestUser('test2');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=participant-row]').should('have.length', 2);
      cy.wait(SETTLE_MS);

      // ── Admin leaves and confirms via the existing alert-confirm pattern.
      // leaveGame()'s admin branch (GameContext.tsx) immediately marks the
      // game status: 'finished', adminLeft: true — no separate "end game"
      // step exists, this one action does both. ──────────────────────────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=leave-game-button]').click();
      cy.get('[data-cy=alert-button][data-cy-style=danger]').click();
      // Verified via a diagnostic run (DOM dumped at 500ms/3500ms/+SETTLE_MS
      // after this click) that admin's own still-mounted GameScreen also
      // reacts to the same real-time Firestore update before anything
      // unmounts it: GameScreen.tsx's currentGame?.adminLeft effect
      // self-fires the "admin has left" alert (alert-button,
      // data-cy-style=primary) on top of admin's own now-finished
      // admin-left ResultsPhase view. There is no return to JoinScreen for
      // the admin — dismiss that alert, then confirm the leave action
      // completed by finding admin on their own admin-left view, before
      // checking test2's side of the transition.
      cy.get('[data-cy=alert-button][data-cy-style=primary]').click();
      cy.get('[data-cy=admin-left]').should('exist');
      cy.wait(SETTLE_MS);

      // ── test2 is still subscribed via the game's real-time Firestore
      // listener (no reload needed) — the transition should already be
      // reflected. Assert the admin-left view renders, not the normal
      // finished view (game-finished, from Chunk C). ─────────────────────
      cy.signInAsTestUser('test2');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=admin-left]').should('exist');
      cy.get('[data-cy=game-finished]').should('not.exist');
    });
  });
});
