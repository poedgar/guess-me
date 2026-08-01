describe('Full mirror-mode round', () => {
  it('plays one round end-to-end and shows correct results after it ends', () => {
    // Firestore's client SDK applies writes to the local optimistic cache
    // the instant updateDoc()/etc. is called — well before the actual
    // network request reaches the server. A `.should('not.exist')` (or
    // similar) check right after an action only proves that local,
    // optimistic update landed, not that the write actually reached the
    // server yet. cy.signInAsTestUser() below does a hard cy.visit('/')
    // for the next account, which can cancel a same-page write that's still
    // in flight over the network and never lands at all. This settle delay
    // is inserted after each such action, before switching accounts, to
    // give the real network round-trip time to finish.
    const SETTLE_MS = 1500;

    // ── Set up: admin creates the game, both players join ──────────────
    cy.signInAsTestUser('test1');
    cy.get('[data-cy=game-input]').type('YR20RZ67FKy88HQVF6yW3');
    cy.get('[data-cy=game-input-submit]').click();
    cy.url().should('match', /\/game\/[^/]+$/);

    cy.url().then((url) => {
      // Game IDs are two Cyrillic words joined by a space, which the
      // browser percent-encodes in the URL — decode before typing it back
      // into the join input, or joinGame() throws "game_not_found".
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

      // ── Admin starts the game; force a deterministic target ──────────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.window().then((win) => {
        // selectRandomParticipant picks index Math.floor(Math.random() * n)
        // from the non-admin participants — stub to always pick index 0.
        // Only the FIRST call is forced; a global, permanent stub of
        // Math.random can also affect the Firestore SDK's own internal use
        // of it (e.g. backoff jitter) for the rest of this page's lifetime.
        // Delegate every call after the first back to the real Math.random
        // so only selectRandomParticipant is affected.
        const realRandom = win.Math.random.bind(win.Math);
        let callCount = 0;
        cy.stub(win.Math, 'random').callsFake(() => {
          callCount += 1;
          return callCount === 1 ? 0 : realRandom();
        });
      });
      cy.get('[data-cy=participant-row]').should('have.length', 3);
      cy.get('[data-cy=start-game-button]').click();
      // WaitingPhase (with its start-game-button) is gone once active.
      cy.get('[data-cy=start-game-button]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── Determine who became the target ───────────────────────────────
      // The target sees "write a comment about yourself" is not offered to
      // them; the non-target participant sees the comment form. Sign in as
      // test2 first and check which UI renders to find out.
      cy.signInAsTestUser('test2');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      // ActivePhase can render with no data-cy at all for a target still
      // waiting on comments (commentsVisible false), so there's no single
      // positive selector to wait on here. Wait for the join form to clear
      // (proof ActivePhase mounted) plus a settle beat for its
      // target-vs-non-target branch to finish its conditional re-render
      // before doing a one-shot DOM read below — catching that render
      // mid-transition would misidentify a real non-target as the target.
      cy.get('[data-cy=game-input]').should('not.exist');
      cy.wait(SETTLE_MS);
      cy.get('body').then(($body) => {
        const test2IsCommenter = $body.find('[data-cy=comment-input]').length > 0;
        const commenterRole: 'test2' | 'test3' = test2IsCommenter ? 'test2' : 'test3';
        const targetRole: 'test2' | 'test3' = test2IsCommenter ? 'test3' : 'test2';
        // playerNumbers is assigned once at startGame() via
        // buildJoinIndexById(currentGame.participants) in join order:
        // test1 (admin) = 1, test2 = 2, test3 = 3. Used below to pick the
        // commenter's own guess-author-button without needing their uid.
        const commenterPlayerNumber = commenterRole === 'test2' ? 2 : 3;

        // ── Non-target writes a comment ─────────────────────────────────
        cy.signInAsTestUser(commenterRole);
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=comment-input]').type('You always bring great energy to the group.');
        cy.get('[data-cy=submit-comment-button]').click();
        // Once the comment is recorded, the form is replaced by a
        // "waiting" message.
        cy.get('[data-cy=comment-input]').should('not.exist');
        cy.wait(SETTLE_MS);

        // ── Admin reveals comments ──────────────────────────────────────
        cy.signInAsTestUser('test1');
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=show-comments-button]').click();
        cy.get('[data-cy=show-comments-button]').should('not.exist');
        cy.wait(SETTLE_MS);

        // ── Target awards the comment a point, then finishes ────────────
        cy.signInAsTestUser(targetRole);
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=award-comment-points-button]').click();
        cy.get('[data-cy=finish-awarding-points-button]').click();
        // Otherwise the admin, signed into next, may still see
        // targetFinishedPoints as false.
        cy.get('[data-cy=finish-awarding-points-button]').should('not.exist');
        cy.wait(SETTLE_MS);

        // ── Non-target awards points to the target, confirms in the alert ─
        cy.signInAsTestUser(commenterRole);
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=give-points-to-target-button][data-cy-points=1]').click();
        cy.get('[data-cy=alert-button][data-cy-style=primary]').click();
        // The admin (signed into next, after the freeze check below) needs
        // allPlayersCompletedPointsPhase to already be true so
        // start-guessing-button isn't clicked while still disabled.
        cy.get('[data-cy=give-points-to-target-button]').should('not.exist');
        cy.wait(SETTLE_MS);

        // ── Freeze-until-round-end check: inline leaderboard still 0 ────
        cy.get('[data-cy=leaderboard-row]').each(($row) => {
          cy.wrap($row).find('[data-cy=leaderboard-total-points]').should('have.text', '0');
        });

        // ── Admin starts guessing phase ─────────────────────────────────
        cy.signInAsTestUser('test1');
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=start-guessing-button]').click();
        // Once status flips to 'guessing_phase', ActivePhase (and this
        // button) is replaced by GuessingPhase entirely.
        cy.get('[data-cy=start-guessing-button]').should('not.exist');
        cy.wait(SETTLE_MS);

        // ── Target guesses the (known, deterministic) real author ──────
        // possibleAuthors in GuessingPhase is every participant (not just
        // comment writers — see startGuessingPhase() in GameContext.tsx),
        // so there's one guess-author-button per participant (3 here), not
        // one. Pick the commenter's own button by player number instead of
        // assuming a single button exists.
        cy.signInAsTestUser(targetRole);
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=guess-author-button]').should('have.length', 3);
        cy.contains('[data-cy=guess-author-button]', `${commenterPlayerNumber}.`).click();
        cy.get('[data-cy=submit-guesses-button]').click();
        // Otherwise the admin, signed into next, may see
        // guessingData.playersWhoSubmittedGuesses as not-yet-including the
        // target, and finalize-button falls back to the force-finalize
        // confirmation-alert branch instead of the normal one-click
        // finalize this test expects.
        cy.get('[data-cy=submit-guesses-button]').should('not.exist');
        cy.wait(SETTLE_MS);

        // ── Admin finalizes the round ───────────────────────────────────
        cy.signInAsTestUser('test1');
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=finalize-button]').click();

        // ── Results tab shows round 1's real totals ─────────────────────
        cy.get('[data-cy=nav-results]').click();
        cy.get('[data-cy=results-leaderboard-row]').should('have.length', 3);
        // The commenter earned 1 comment point; the target earned 1 point
        // from the commenter plus 1 guess point for the correct guess.
        // ResultsPage.tsx computes totalPoints as gamePoints + guessPoints
        // per participant — assert at least one row is now above 0,
        // proving round 1's results made it through.
        // Use the retrying `.should()` callback form, not `.then()`: there is
        // a brief documented window between finalizeGuessingPhase() resolving
        // and startNextRound()'s round-start snapshot write landing, during
        // which the Results leaderboard still renders the previous (all-zero)
        // snapshot while the round history below it already shows the real
        // results. ResultsPage subscribes to a live Firestore listener so the
        // DOM does catch up, but a `.then()` callback runs exactly once and is
        // never retried, so it fails outright if it happens to land in that
        // window.
        cy.get('[data-cy=results-leaderboard-total-points]').should(($points) => {
          const values = $points.toArray().map((el) => Number(el.textContent));
          expect(values.some((v) => v > 0)).to.eq(true);
        });
      });
    });
  });
});
