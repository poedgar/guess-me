describe('adminWritesComments toggled on', () => {
  it('lets the admin become an eligible target and writer', () => {
    const SETTLE_MS = 1500;

    // ── Set up: admin creates the game, turns on adminWritesComments and
    // switches target selection to chronological, test2 joins ─────────────
    cy.signInAsTestUser('test1');
    cy.get('[data-cy=game-input]').type('YR20RZ67FKy88HQVF6yW3');
    cy.get('[data-cy=game-input-submit]').click();
    cy.url().should('match', /\/game\/[^/]+$/);
    cy.get('[data-cy=admin-writes-comments-toggle]').click();
    cy.get('[data-cy=admin-writes-comments-toggle]').should('be.checked');
    cy.get('[data-cy=target-selection-mode-toggle]').click();
    cy.get('[data-cy=target-selection-mode-toggle]').should('be.checked');
    cy.wait(SETTLE_MS);

    cy.url().then((url) => {
      const gameId = decodeURIComponent(url.split('/game/')[1]);

      cy.signInAsTestUser('test2');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=participant-row]').should('have.length', 2);
      cy.wait(SETTLE_MS);

      // ── Admin starts the game. With adminWritesComments on,
      // startNextRound()'s availableParticipants filter no longer excludes
      // test1 — both test1 and test2 are now eligible targets. ────────────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=participant-row]').should('have.length', 2);
      cy.get('[data-cy=start-game-button]').click();
      cy.get('[data-cy=start-game-button]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── Determine round 1's actual roles at runtime — chronological mode
      // isn't perfectly reliable in practice (see mirror-multi-round.cy.ts),
      // so this can't be hardcoded. This is also the test's core claim: it
      // doesn't matter which of test1/test2 ends up in which role, only
      // that test1 (the admin) is legitimately eligible for either. ───────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      // participant-row is WaitingPhase-only — waiting for it to be gone is
      // a real condition-based proof that *this specific client* has
      // received status: 'active' from Firestore, not a guess about how
      // long that takes. An arbitrary cy.wait() here was found to
      // intermittently race the status update on this exact client,
      // misidentifying a still-loading WaitingPhase view as "no
      // comment-input, so this must be the target" before the round data
      // had actually arrived.
      cy.get('[data-cy=game-input]').should('not.exist');
      cy.get('[data-cy=participant-row]').should('not.exist');
      cy.get('body').then(($body) => {
        const test1IsCommenter = $body.find('[data-cy=comment-input]').length > 0;
        const round1TargetRole: 'test1' | 'test2' = test1IsCommenter ? 'test2' : 'test1';
        const round1CommenterRole: 'test1' | 'test2' = test1IsCommenter ? 'test1' : 'test2';
        const commenterPlayerNumber = round1CommenterRole === 'test1' ? 1 : 2;

        // ── Round 2's target will be round 1's commenter (the only
        // remaining eligible participant once round 1's target has been
        // used) — asserted after finalize, not assumed here. ──────────────

        // ── Commenter writes about the target ────────────────────────────
        cy.signInAsTestUser(round1CommenterRole);
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=comment-input]').type('You always bring great energy to the group.');
        cy.get('[data-cy=submit-comment-button]').click();
        cy.get('[data-cy=comment-input]').should('not.exist');
        cy.wait(SETTLE_MS);

        // ── Admin reveals comments (test1 acts as admin regardless of its
        // own round role) ─────────────────────────────────────────────────
        cy.signInAsTestUser('test1');
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=show-comments-button]').click();
        cy.get('[data-cy=show-comments-button]').should('not.exist');
        cy.wait(SETTLE_MS);

        // ── Target awards the comment a point, then finishes — this is the
        // test's other core claim: whichever account is the target
        // (possibly test1, the admin) completes a normal target's flow ────
        cy.signInAsTestUser(round1TargetRole);
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=award-comment-points-button]').click();
        cy.get('[data-cy=finish-awarding-points-button]').click();
        cy.get('[data-cy=finish-awarding-points-button]').should('not.exist');
        cy.wait(SETTLE_MS);

        // ── Commenter gives a reciprocal point ────────────────────────────
        cy.signInAsTestUser(round1CommenterRole);
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=give-points-to-target-button][data-cy-points=1]').click();
        cy.get('[data-cy=alert-button][data-cy-style=primary]').click();
        cy.get('[data-cy=give-points-to-target-button]').should('not.exist');
        cy.wait(SETTLE_MS);

        // ── Admin starts guessing, target guesses correctly ───────────────
        cy.signInAsTestUser('test1');
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=start-guessing-button]').click();
        cy.get('[data-cy=start-guessing-button]').should('not.exist');
        cy.wait(SETTLE_MS);

        cy.signInAsTestUser(round1TargetRole);
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=guess-author-button]').should('have.length', 2);
        cy.contains('[data-cy=guess-author-button]', `${commenterPlayerNumber}.`).click();
        cy.get('[data-cy=submit-guesses-button]').click();
        cy.get('[data-cy=submit-guesses-button]').should('not.exist');
        cy.wait(SETTLE_MS);

        // ── Admin finalizes — round 1's commenter is the only remaining
        // eligible target, so this starts round 2 (not 'finished': with
        // only 2 eligible participants, one round's finalize can never
        // finish the game — the other one still needs a turn). ───────────
        cy.signInAsTestUser('test1');
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=finalize-button]').click();
        cy.wait(SETTLE_MS);

        // ── Round 2: sign in as round 1's target (now round 2's commenter,
        // since round 1's commenter is round 2's target) — comment-input
        // existing proves round 2 started with the roles correctly
        // flipped, and the round-1-frozen leaderboard shows the target
        // earning 2 (1 reciprocal + 1 correct guess) and the commenter
        // earning 1 (1 comment point). ─────────────────────────────────────
        cy.signInAsTestUser(round1TargetRole);
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=comment-input]').should('exist');
        cy.get('[data-cy=leaderboard-row]').should('have.length', 2);
        cy.get('[data-cy=leaderboard-total-points]').should(($points) => {
          const values = $points.toArray().map((el) => Number(el.textContent)).sort((a, b) => b - a);
          expect(values).to.deep.equal([2, 1]);
        });

        // ── Directly confirm round 2's target (round 1's commenter — which
        // in the test1-commenter branch is test1, the admin) does NOT see
        // the commenter's writing UI. Combined with the comment-input
        // assertion above (proving round 2's commenter role), this makes
        // the admin-as-target claim directly observable in the browser in
        // both runtime branches, not just provable by elimination logic. ──
        cy.signInAsTestUser(round1CommenterRole);
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=comment-input]').should('not.exist');
      });
    });
  });
});
