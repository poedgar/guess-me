describe('Reload mid-game auto-rejoins via the URL', () => {
  it('resumes the correct phase after a reload, both pre-game and mid-round', () => {
    const SETTLE_MS = 1500;

    // ── Set up: admin creates the game, test2 and test3 join. 3 accounts,
    // not 2 — with adminWritesComments off (default), a 2-participant
    // mirror game has no eligible commenter once the sole non-admin
    // participant becomes the target. ───────────────────────────────────
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

      cy.signInAsTestUser('test3');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=participant-row]').should('have.length', 3);
      cy.wait(SETTLE_MS);

      // ── test3 is already on /game/<gameId> (enterGame navigated there
      // on join) — reload it directly. GameJoinPage.tsx's useEffect reads
      // the gameId already in the URL and auto-calls enterGame(gameId)
      // again on this fresh mount; no manual re-entry needed. ────────────
      cy.reload();
      cy.get('[data-cy=participant-row]').should('have.length', 3);
      cy.get('[data-cy=start-game-button]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── Admin starts the game ────────────────────────────────────────────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=start-game-button]').click();
      cy.get('[data-cy=start-game-button]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── Determine which of test2/test3 is this round's commenter (not
      // the target) at runtime, same defensive technique as Chunk B. The
      // commenter is the more useful role to reload-test: its correct
      // post-reload state (comment-input present) has a concrete,
      // assertable selector, unlike the target's pre-reveal state (plain
      // waiting text, no dedicated data-cy). ─────────────────────────────
      cy.signInAsTestUser('test2');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=game-input]').should('not.exist');
      cy.wait(SETTLE_MS);
      cy.get('body').then(($body) => {
        const test2IsCommenter = $body.find('[data-cy=comment-input]').length > 0;
        const commenterRole: 'test2' | 'test3' = test2IsCommenter ? 'test2' : 'test3';

        // ── If test3 is the commenter, switch to it — test2 is already
        // signed in and on the right page otherwise. ────────────────────
        if (commenterRole === 'test3') {
          cy.signInAsTestUser('test3');
          cy.get('[data-cy=game-input]').type(gameId);
          cy.get('[data-cy=game-input-submit]').click();
          cy.get('[data-cy=comment-input]').should('exist');
          cy.wait(SETTLE_MS);
        }

        // ── Reload mid-'active' phase — this is the test's central claim:
        // GameJoinPage's auto-rejoin must resume the actual current phase
        // (comment-writing), not WaitingPhase's start-game button or any
        // other stale state. ─────────────────────────────────────────────
        cy.reload();
        cy.get('[data-cy=start-game-button]').should('not.exist');
        cy.get('[data-cy=comment-input]').should('exist');
      });
    });
  });
});
