describe('Full clash-mode round', () => {
  it('plays the only round end-to-end (1v1 teams) and reaches finished with correct scores', () => {
    const SETTLE_MS = 1500;

    // ── Set up: admin creates the game, switches it to clash, both players join ──
    cy.signInAsTestUser('test1');
    cy.get('[data-cy=game-input]').type('YR20RZ67FKy88HQVF6yW3');
    cy.get('[data-cy=game-input-submit]').click();
    cy.url().should('match', /\/game\/[^/]+$/);
    cy.get('[data-cy=game-type-button][data-cy-type=clash]').click();
    // Same in-flight-write-cancellation risk documented in
    // basket-round.cy.ts's SETTLE_MS comment: signInAsTestUser's hard
    // cy.visit('/') for test2 below can race and cancel this type-switch
    // write before it reaches the server, leaving the game on the default
    // 'mirror' type when test1 later reopens it for group assignment.
    cy.wait(SETTLE_MS);

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

      // ── Admin assigns groups: test2 → Team A (auto-leader, sole member),
      // test3 → Team B (auto-leader, sole member). test1 (admin) is never
      // eligible while adminWritesComments is off, so it never appears in
      // ClashSetupPanel's pool at all — no assignment action needed for it.
      // generateClashSchedule requires equal group sizes, so 1v1 is the only
      // split possible with 3 accounts. ────────────────────────────────────────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get(`[data-cy=clash-assign-button][data-cy-group=a][data-cy-user-id]`).first().click();
      cy.wait(500);
      cy.get(`[data-cy=clash-assign-button][data-cy-group=b][data-cy-user-id]`).first().click();
      cy.get('[data-cy=clash-start-game-button]').should('not.be.disabled');
      cy.wait(SETTLE_MS);
      cy.get('[data-cy=clash-start-game-button]').click();
      cy.get('[data-cy=clash-start-game-button]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── With groupA=[test2], groupB=[test3], generateClashSchedule's single
      // round (n=1) assigns: test2 (Team A) writes about test3 (Team B);
      // test3 (Team B) writes about test2 (Team A). Submission order is
      // controlled below (test2 first, test3 second) so lastGroupToFinish
      // ends up 'b', making Team B's leader (test3) act first in guessing. ──

      cy.signInAsTestUser('test2');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=clash-comment-input]').type('You always ask great questions.');
      cy.get('[data-cy=clash-submit-comment-button]').click();
      cy.get('[data-cy=clash-comment-input]').should('not.exist');
      cy.wait(SETTLE_MS);

      cy.signInAsTestUser('test3');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=clash-comment-input]').type('You are a great listener.');
      cy.get('[data-cy=clash-submit-comment-button]').click();
      cy.get('[data-cy=clash-comment-input]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── Admin reveals — currentGuessingGroup becomes lastGroupToFinish
      // ('b', since test3/Team B submitted last), so Team B's leader (test3)
      // acts first. ────────────────────────────────────────────────────────────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=clash-reveal-comments-button]').should('not.be.disabled');
      cy.get('[data-cy=clash-reveal-comments-button]').click();
      cy.get('[data-cy=clash-reveal-comments-button]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── test3 (Team B leader) guesses against Team A's one comment
      // (test2's "great questions" comment, about test3). Team B has only
      // one member, so both the subject guess and the author guess are
      // unambiguous — both come out correct by construction. ─────────────────
      cy.signInAsTestUser('test3');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=clash-guess-comment-button]').should('have.length', 1);
      cy.get('[data-cy=clash-guess-comment-button]').click();
      cy.get('[data-cy=clash-guess-subject-button]').should('have.length', 1);
      cy.get('[data-cy=clash-guess-subject-button]').click();
      cy.get('[data-cy=alert-button][data-cy-style=primary]').click();
      cy.get('[data-cy=clash-guess-author-button]').should('have.length', 1);
      cy.get('[data-cy=clash-guess-author-button]').click();
      cy.get('[data-cy=alert-button][data-cy-style=primary]').click();
      cy.get('[data-cy=clash-guess-author-button]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── Admin advances — Team A hasn't guessed yet, so this only switches
      // the active leader (test2 next), it does not finish the round. ────────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=clash-advance-button]').should('not.be.disabled');
      cy.get('[data-cy=clash-advance-button]').click();
      cy.wait(SETTLE_MS);

      // ── test2 (Team A leader) guesses against Team B's one comment
      // (test3's "great listener" comment, about test2) — also unambiguous. ──
      cy.signInAsTestUser('test2');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=clash-guess-comment-button]').should('have.length', 1);
      cy.get('[data-cy=clash-guess-comment-button]').click();
      cy.get('[data-cy=clash-guess-subject-button]').should('have.length', 1);
      cy.get('[data-cy=clash-guess-subject-button]').click();
      cy.get('[data-cy=alert-button][data-cy-style=primary]').click();
      cy.get('[data-cy=clash-guess-author-button]').should('have.length', 1);
      cy.get('[data-cy=clash-guess-author-button]').click();
      cy.get('[data-cy=alert-button][data-cy-style=primary]').click();
      cy.get('[data-cy=clash-guess-author-button]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── Admin advances again — Team B is already done and this is the
      // schedule's only round (groupA.length === 1 → n === 1), so this flips
      // status straight to 'finished'. ─────────────────────────────────────────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=clash-advance-button]').should('not.be.disabled');
      cy.get('[data-cy=clash-advance-button]').click();
      cy.wait(SETTLE_MS);

      // ── Finished: both test2 and test3 earned 2 points each (correct
      // subject guess + correct author guess); test1 (admin, never in a
      // group) earned 0. ───────────────────────────────────────────────────────
      cy.get('[data-cy=leaderboard-row]').should('have.length', 3);
      cy.get('[data-cy=leaderboard-total-points]').should(($points) => {
        const values = $points.toArray().map((el) => Number(el.textContent)).sort((a, b) => b - a);
        expect(values).to.deep.equal([2, 2, 0]);
      });
    });
  });
});
