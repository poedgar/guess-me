describe('Mirror mode wrong guess and multi-round completion', () => {
  it('plays 2 rounds (one wrong guess, one correct) and reaches finished', () => {
    const SETTLE_MS = 1500;

    // ── Set up: admin creates the game, switches target selection to
    // chronological, both players join ──────────────────────────────────────
    cy.signInAsTestUser('test1');
    cy.get('[data-cy=game-input]').type('YR20RZ67FKy88HQVF6yW3');
    cy.get('[data-cy=game-input-submit]').click();
    cy.url().should('match', /\/game\/[^/]+$/);
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

      cy.signInAsTestUser('test3');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=participant-row]').should('have.length', 3);
      cy.wait(SETTLE_MS);

      // ── Admin starts the game ────────────────────────────────────────────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=participant-row]').should('have.length', 3);
      cy.get('[data-cy=start-game-button]').click();
      cy.get('[data-cy=start-game-button]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── Determine round 1's actual target at runtime. Even with
      // targetSelectionMode set to chronological, the earliest-joined
      // participant isn't reliably picked in practice under real Firestore
      // write timing — so this can't be hardcoded. Use the same defensive
      // technique mirror-round.cy.ts uses for its own (Math.random-based)
      // target selection: sign in as test2 and check which UI renders.
      // comment-input present means test2 is the commenter/non-target for
      // round 1; its absence means test2 is the target.
      //
      // Note: because target detection is now done at runtime regardless of
      // mode, the toggle click above no longer needs to succeed for this
      // test's correctness — but it's kept anyway because it still biases
      // target order toward chronological (worth exercising) and exercises
      // the admin-settings write path end to end.
      cy.signInAsTestUser('test2');
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
        const test2IsCommenter = $body.find('[data-cy=comment-input]').length > 0;
        const round1TargetRole: 'test2' | 'test3' = test2IsCommenter ? 'test3' : 'test2';
        const round1CommenterRole: 'test2' | 'test3' = test2IsCommenter ? 'test2' : 'test3';
        // Only test2/test3 are eligible targets — adminWritesComments is
        // off (default), so test1 (the admin) never writes and is never
        // targeted. With exactly 2 eligible targets, each targeted once
        // across 2 rounds: round 2's target is deterministically whichever
        // of test2/test3 wasn't round 1's target (i.e. round 1's
        // commenter), and round 2's commenter is round 1's target — the
        // only other non-admin participant, since the admin never writes.
        const round2TargetRole: 'test2' | 'test3' = round1CommenterRole;
        const round2CommenterRole: 'test2' | 'test3' = round1TargetRole;
        // playerNumbers is assigned once at startGame() via
        // buildJoinIndexById(currentGame.participants) in join order:
        // test1 (admin) = 1, test2 = 2, test3 = 3. Used below to pick the
        // round 2 commenter's own guess-author-button without needing
        // their uid.
        const round2CommenterPlayerNumber = round2CommenterRole === 'test2' ? 2 : 3;

        // ══════════════════════ ROUND 1 ══════════════════════

        // ── The non-target writes a comment about the target ────────────────
        cy.signInAsTestUser(round1CommenterRole);
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=comment-input]').type('You always bring great energy to the group.');
        cy.get('[data-cy=submit-comment-button]').click();
        cy.get('[data-cy=comment-input]').should('not.exist');
        cy.wait(SETTLE_MS);

        // ── Admin reveals comments ────────────────────────────────────────────
        cy.signInAsTestUser('test1');
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=show-comments-button]').click();
        cy.get('[data-cy=show-comments-button]').should('not.exist');
        cy.wait(SETTLE_MS);

        // ── Target awards the comment a point, then finishes ─────────────────
        cy.signInAsTestUser(round1TargetRole);
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=award-comment-points-button]').click();
        cy.get('[data-cy=finish-awarding-points-button]').click();
        cy.get('[data-cy=finish-awarding-points-button]').should('not.exist');
        cy.wait(SETTLE_MS);

        // ── Non-target gives a reciprocal point to the target, confirms in
        // the alert ────────────────────────────────────────────────────────
        cy.signInAsTestUser(round1CommenterRole);
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=give-points-to-target-button][data-cy-points=1]').click();
        cy.get('[data-cy=alert-button][data-cy-style=primary]').click();
        cy.get('[data-cy=give-points-to-target-button]').should('not.exist');
        cy.wait(SETTLE_MS);

        // ── Admin starts guessing phase ───────────────────────────────────────
        cy.signInAsTestUser('test1');
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=start-guessing-button]').click();
        cy.get('[data-cy=start-guessing-button]').should('not.exist');
        cy.wait(SETTLE_MS);

        // ── Target DELIBERATELY guesses wrong — picks player 1 (test1,
        // the admin), who never wrote anything. possibleAuthors includes
        // every participant regardless of who actually wrote, so this
        // button always exists and is guaranteed incorrect, since the admin
        // never writes comments (adminWritesComments is off). ────────────────
        cy.signInAsTestUser(round1TargetRole);
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=guess-author-button]').should('have.length', 3);
        cy.contains('[data-cy=guess-author-button]', '1.').click();
        cy.get('[data-cy=submit-guesses-button]').click();
        cy.get('[data-cy=submit-guesses-button]').should('not.exist');
        cy.wait(SETTLE_MS);

        // ── Admin finalizes round 1 — since the other non-admin
        // participant is still an eligible target, this starts round 2
        // rather than finishing the game. The writing phase for round 2
        // should appear. ───────────────────────────────────────────────────
        cy.signInAsTestUser('test1');
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=finalize-button]').click();
        cy.wait(SETTLE_MS);

        // ══════════════════════ ROUND 2 ══════════════════════

        // ── Round 1's target now writes a comment about round 2's target
        // (round 1's commenter) ────────────────────────────────────────────
        cy.signInAsTestUser(round2CommenterRole);
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=comment-input]').should('exist');
        cy.get('[data-cy=comment-input]').type('You have a great sense of humor.');
        cy.get('[data-cy=submit-comment-button]').click();
        cy.get('[data-cy=comment-input]').should('not.exist');
        cy.wait(SETTLE_MS);

        // ── Admin reveals comments ────────────────────────────────────────────
        cy.signInAsTestUser('test1');
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=show-comments-button]').click();
        cy.get('[data-cy=show-comments-button]').should('not.exist');
        cy.wait(SETTLE_MS);

        // ── Target awards the comment a point, then finishes ─────────────────
        cy.signInAsTestUser(round2TargetRole);
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=award-comment-points-button]').click();
        cy.get('[data-cy=finish-awarding-points-button]').click();
        cy.get('[data-cy=finish-awarding-points-button]').should('not.exist');
        cy.wait(SETTLE_MS);

        // ── Round 2 commenter gives a reciprocal point to round 2's target ───
        cy.signInAsTestUser(round2CommenterRole);
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=give-points-to-target-button][data-cy-points=1]').click();
        cy.get('[data-cy=alert-button][data-cy-style=primary]').click();
        cy.get('[data-cy=give-points-to-target-button]').should('not.exist');
        cy.wait(SETTLE_MS);

        // ── Admin starts guessing phase ───────────────────────────────────────
        cy.signInAsTestUser('test1');
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=start-guessing-button]').click();
        cy.get('[data-cy=start-guessing-button]').should('not.exist');
        cy.wait(SETTLE_MS);

        // ── Target guesses CORRECTLY — picks round 2's commenter's own
        // player number, the real author. ─────────────────────────────────────
        cy.signInAsTestUser(round2TargetRole);
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=guess-author-button]').should('have.length', 3);
        cy.contains('[data-cy=guess-author-button]', `${round2CommenterPlayerNumber}.`).click();
        cy.get('[data-cy=submit-guesses-button]').click();
        cy.get('[data-cy=submit-guesses-button]').should('not.exist');
        cy.wait(SETTLE_MS);

        // ── Admin finalizes round 2 — no eligible targets remain (both
        // non-admin participants have now been targeted once), so this sets
        // the game straight to 'finished'. ─────────────────────────────────────
        cy.signInAsTestUser('test1');
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=finalize-button]').click();
        cy.wait(SETTLE_MS);

        // ── Confirm the game actually reached 'finished'. In mirror mode
        // (unlike basket/clash), the leaderboard-row/leaderboard-total-points
        // selectors also render during active/guessing_phase (they show a
        // live leaderboard from game.roundStartScores ?? game.scores in
        // ActivePhase.tsx/GuessingPhase.tsx). Since roundStartScores snapshots
        // at round start, an unexpected round 3 starting could still show the
        // same [3, 2, 0] values and let the leaderboard assertions below pass
        // green without the game ever reaching 'finished'. This selector only
        // renders in the finished-state container in ResultsPhase.tsx, so it
        // proves the round cascade actually terminated. ───────────────────────
        cy.get('[data-cy=game-finished]').should('exist');

        // ── Finished: round 2's target earned 3 (1 comment point in round 1
        // as round 1's commenter, + 1 reciprocal point in round 2 + 1
        // correct-guess point in round 2); round 2's commenter earned 2 (1
        // reciprocal point in round 1 as round 1's target + 1 comment point
        // in round 2); the admin (never wrote/guessed) earned 0. This
        // pattern holds regardless of which account (test2/test3) ended up
        // playing which role. ──────────────────────────────────────────────────
        cy.get('[data-cy=leaderboard-row]').should('have.length', 3);
        cy.get('[data-cy=leaderboard-total-points]').should(($points) => {
          const values = $points.toArray().map((el) => Number(el.textContent)).sort((a, b) => b - a);
          expect(values).to.deep.equal([3, 2, 0]);
        });
      });
    });
  });
});
