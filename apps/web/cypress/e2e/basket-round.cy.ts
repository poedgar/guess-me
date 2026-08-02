describe('Full basket-mode round', () => {
  it('plays the only round end-to-end and reaches finished with correct scores', () => {
    // See mirror-round.cy.ts for why this delay exists: Firestore's client
    // SDK resolves writes against the local optimistic cache immediately,
    // well before the write reaches the server, and a same-page account
    // switch can cancel an in-flight write. This gives each write time to
    // land before cy.signInAsTestUser's hard cy.visit('/') for the next
    // account.
    const SETTLE_MS = 1500;

    // ── Set up: admin creates the game, switches it to basket, both players join ──
    cy.signInAsTestUser('test1');
    cy.get('[data-cy=game-input]').type('YR20RZ67FKy88HQVF6yW3');
    cy.get('[data-cy=game-input-submit]').click();
    cy.url().should('match', /\/game\/[^/]+$/);
    cy.get('[data-cy=game-type-button][data-cy-type=basket]').click();

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

      // ── Admin starts the game (adminWritesComments stays off, the default —
      // this excludes the admin from `writers`, leaving exactly 2 writers and
      // a single-round schedule; see this plan's Global Constraints). No
      // Math.random stub is needed here (unlike mirror-round.cy.ts): with
      // exactly 2 writers, generateBasketSchedule's Fisher-Yates shuffle can
      // only ever produce the 2 writers in one order or the other, and its
      // rotation (subjectId = ids[(i+r+1)%n], n=2) makes each writer the
      // other's subject either way — the shuffle's outcome cannot change who
      // writes about whom when there are only 2 people to rotate. ───────────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=participant-row]').should('have.length', 3);
      cy.get('[data-cy=start-game-button]').click();
      cy.get('[data-cy=start-game-button]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── Both writers submit their comment ───────────────────────────────────
      cy.signInAsTestUser('test2');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=basket-comment-input]').type('You have a great sense of humor.');
      cy.get('[data-cy=basket-submit-comment-button]').click();
      cy.get('[data-cy=basket-comment-input]').should('not.exist');
      cy.wait(SETTLE_MS);

      cy.signInAsTestUser('test3');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=basket-comment-input]').type('You are always so encouraging.');
      cy.get('[data-cy=basket-submit-comment-button]').click();
      cy.get('[data-cy=basket-comment-input]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── Admin reveals comments — this is the exact path the reveal-comments
      // bug fix (comparing against the round's writers, not every
      // participant) unblocked. Before that fix this button never became
      // clickable under default settings. ─────────────────────────────────────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=basket-reveal-comments-button]').should('not.be.disabled');
      cy.get('[data-cy=basket-reveal-comments-button]').click();
      cy.get('[data-cy=basket-reveal-comments-button]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── test2 guesses: sees test3's comment (the only comment about test2),
      // correctly identifies it as about them, then correctly names test3 as
      // the author (only one other writer exists) ────────────────────────────
      cy.signInAsTestUser('test2');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=basket-guess-comment-button]').should('have.length', 2);
      cy.get('[data-cy=basket-guess-comment-button]').contains('encouraging').click();
      cy.get('[data-cy=alert-button][data-cy-style=primary]').click();
      cy.get('[data-cy=basket-guess-author-button]').should('have.length', 1);
      cy.get('[data-cy=basket-guess-author-button]').click();
      cy.get('[data-cy=alert-button][data-cy-style=primary]').click();
      cy.get('[data-cy=basket-guess-author-button]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── test3 guesses: the comment actually about test3 is test2's "great
      // sense of humor" one, but this deliberately clicks the OTHER comment
      // ("encouraging", written by test3 about test2) to exercise the
      // incorrect-guess path, matching mirror-round.cy.ts's approach of
      // covering both outcomes. ────────────────────────────────────────────────
      cy.signInAsTestUser('test3');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=basket-guess-comment-button]').should('have.length', 2);
      cy.get('[data-cy=basket-guess-comment-button]').contains('encouraging').click();
      cy.get('[data-cy=alert-button][data-cy-style=primary]').click();
      // Wrong guess: no author-guess step follows; the card shows "wrong" and
      // basket-guess-author-button never appears for test3 this round.
      cy.get('[data-cy=basket-guess-author-button]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── Admin advances — this is the schedule's only round (2 writers →
      // n-1=1 round), so this flips status straight to 'finished' ────────────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=basket-next-round-button]').should('not.be.disabled');
      cy.get('[data-cy=basket-next-round-button]').click();
      cy.wait(SETTLE_MS);

      // ── Finished: test2 earned 2 points (correct comment guess + correct
      // author guess), test3 earned 0 (wrong comment guess), test1 (admin,
      // never wrote or guessed) earned 0. ─────────────────────────────────────
      cy.get('[data-cy=leaderboard-row]').should('have.length', 3);
      // Assert by point-value multiset (as mirror-round.cy.ts does), not by
      // correlating rows to specific participants: exactly one row has 2
      // points (test2), the other two have 0 (test3, test1).
      cy.get('[data-cy=leaderboard-total-points]').should(($points) => {
        const values = $points.toArray().map((el) => Number(el.textContent)).sort((a, b) => b - a);
        expect(values).to.deep.equal([2, 0, 0]);
      });
    });
  });
});
