describe('Auto-scroll on phase transitions', () => {
  it('calls scrollIntoView when a new phase mounts', () => {
    const SETTLE_MS = 1500;

    // ── Set up: admin creates the game, test2 joins. 2 participants are
    // required — start-game-button is disabled below that. ────────────────
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

      // ── Switch back to test1 (a full page load — any stub installed
      // before this point would be wiped by the fresh JS context). Once on
      // this final page, WaitingPhase mounts and fires its own initial
      // scrollIntoView call — irrelevant, the stub goes in AFTER this. ────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=participant-row]').should('have.length', 2);
      cy.wait(SETTLE_MS);

      // ── Install the stub on the already-loaded page, immediately before
      // the action whose resulting call we want to observe. Testing the
      // scrollIntoView call itself (not the transient 900ms pulse CSS
      // class) avoids animation-timing fragility — see this chunk's design
      // spec. ──────────────────────────────────────────────────────────────
      cy.window().then((win) => {
        cy.stub(win.HTMLElement.prototype, 'scrollIntoView').as('scrollIntoView');
      });

      // ── Trigger the smallest possible phase transition: waiting → active.
      // useScrollIntoViewOnChange's trigger-key mechanism is phase- and
      // mode-agnostic by construction (it only cares that its string key
      // changed), so this one transition is representative. ───────────────
      cy.get('[data-cy=start-game-button]').click();
      cy.get('[data-cy=start-game-button]').should('not.exist');

      cy.get('@scrollIntoView').should('have.been.called');
    });
  });
});
