# Cypress Tests: Settings & Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Cypress E2E coverage for the `adminWritesComments` on-path (never exercised by any existing test) and for reload/rejoin mid-game (the app's real, verified behavior: auto-rejoin via the URL, not a blank `JoinScreen`).

**Architecture:** Two independent spec files, no app-code changes and no new `data-cy` attributes — every selector this chunk needs already exists (`admin-writes-comments-toggle` and `target-selection-mode-toggle` from Chunk B; everything else pre-existing from Chunk A/B and the original suite).

**Tech Stack:** Cypress (already configured in `apps/web`), TypeScript, no new dependencies.

## Global Constraints

- Only 3 Cypress test accounts exist (`test1`/`test2`/`test3`).
- `admin-writes-comments.cy.ts` uses only `test1`+`test2` (2 participants) — deliberately minimal, since its purpose is proving the toggle itself works, not re-testing round mechanics already covered by Chunk B.
- `reload-rejoin.cy.ts` uses all 3 accounts — with `adminWritesComments` off (its default, left off in this spec), a 2-participant mirror game has no eligible commenter once the sole non-admin participant becomes the target, so 3 accounts are required here.
- With only 2 eligible participants (as in `admin-writes-comments.cy.ts`), one round's finalize starts round 2 — it does NOT reach `finished`. Do not assert `finished` in that spec.
- `targetSelectionMode: 'chronological'` is not perfectly reliable in practice (discovered in Chunk B) — every test that needs to know a specific role uses runtime DOM detection (sign in, check for `comment-input`), never a hardcoded assumption about who ends up in which role.
- Reload is tested via `cy.reload()` while the browser is already on `/game/<gameId>` (the URL `enterGame`/`GameJoinPage` already navigated to) — this is what triggers `GameJoinPage.tsx`'s auto-rejoin `useEffect`, which calls `enterGame(gameId)` again using the URL's game ID. Do not sign out or navigate to `/` as part of the reload step; that would exercise a different (untested, out-of-scope) code path.
- Do not touch `apps/expo` or any app source file — this plan is `apps/web` Cypress-spec-only.
- This spec runs against real production Firebase (`https://in-the-mirror.vercel.app`) like every other spec in this suite — `apps/web/cypress.env.json` must already exist locally with `test1`/`test2`/`test3` credentials.
- Before running any Cypress command, check for and kill stray Cypress/Chrome-headless processes (`ps aux | grep -i cypress`) — concurrent runs against the same shared test accounts have caused misleading failures in earlier chunks of this suite. Never start a second Cypress run while one is already in flight.

---

## Task 1: `admin-writes-comments.cy.ts`

**Files:**
- Create: `apps/web/cypress/e2e/admin-writes-comments.cy.ts`

**Interfaces:**
- Consumes: `game-input`, `game-input-submit`, `admin-writes-comments-toggle`, `target-selection-mode-toggle`, `participant-row`, `start-game-button`, `comment-input`, `submit-comment-button`, `show-comments-button`, `award-comment-points-button`, `finish-awarding-points-button`, `give-points-to-target-button`/`data-cy-points`, `alert-button`/`data-cy-style`, `start-guessing-button`, `guess-author-button`, `submit-guesses-button`, `finalize-button`, `leaderboard-row`, `leaderboard-total-points` — all pre-existing, used unchanged from `mirror-round.cy.ts`/`mirror-multi-round.cy.ts`. The global `cy.signInAsTestUser` command.

- [ ] **Step 1: Write the spec**

```typescript
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
      cy.get('[data-cy=game-input]').should('not.exist');
      cy.wait(SETTLE_MS);
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
      });
    });
  });
});
```

- [ ] **Step 2: Run the spec locally**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror/apps/web
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
unset ELECTRON_RUN_AS_NODE
npx cypress run --browser chrome --spec cypress/e2e/admin-writes-comments.cy.ts
```

Expected: 1 passing test. If a step's assumption doesn't hold (e.g. `guess-author-button` count, or which role ends up where), open `npx cypress open` on this spec and inspect the actual DOM before changing anything — do not guess blindly.

- [ ] **Step 3: Commit**

```bash
git add apps/web/cypress/e2e/admin-writes-comments.cy.ts
git commit -m "$(cat <<'EOF'
Add Cypress test for adminWritesComments toggled on

Every existing mirror-mode spec deliberately leaves adminWritesComments
off; this is the first to exercise the on-path, where the admin
becomes a legitimate writer and target candidate. Roles are detected
at runtime (chronological target selection isn't perfectly reliable
in practice, per the discovery in mirror-multi-round.cy.ts) rather
than assumed. With only 2 eligible participants, the test stops after
round 1's finalize starts round 2 (finishing the game isn't reachable
in a single round here) and asserts the round-1-frozen leaderboard.
EOF
)"
```

---

## Task 2: `reload-rejoin.cy.ts`

**Files:**
- Create: `apps/web/cypress/e2e/reload-rejoin.cy.ts`

**Interfaces:**
- Consumes: `game-input`, `game-input-submit`, `participant-row`, `start-game-button`, `comment-input`, and the global `cy.signInAsTestUser` command — all pre-existing.

- [ ] **Step 1: Write the spec**

```typescript
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
```

- [ ] **Step 2: Run the spec locally**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror/apps/web
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
unset ELECTRON_RUN_AS_NODE
npx cypress run --browser chrome --spec cypress/e2e/reload-rejoin.cy.ts
```

Expected: 1 passing test. `cy.reload()` preserves the current Cypress-controlled browser tab's session (the signed-in Firebase user doesn't change) — it should not require a `cy.signInAsTestUser` call afterward. If the reload doesn't auto-rejoin as expected, open `npx cypress open` on this spec and inspect the actual DOM/URL before changing anything — do not guess blindly, and do not modify any app source file to make this test pass.

- [ ] **Step 3: Run both new specs plus the existing suite together, to confirm no interference**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror/apps/web
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
unset ELECTRON_RUN_AS_NODE
npx cypress run --browser chrome
```

Expected: all specs (`smoke.cy.ts`, `mirror-round.cy.ts`, `mirror-multi-round.cy.ts`, `basket-round.cy.ts`, `clash-round.cy.ts`, `admin-writes-comments.cy.ts`, `reload-rejoin.cy.ts`) pass. The existing `cleanupTestGames` hooks cover the two new specs' games the same way they cover every other spec's — no new cleanup logic needed.

- [ ] **Step 4: Commit**

```bash
git add apps/web/cypress/e2e/reload-rejoin.cy.ts
git commit -m "$(cat <<'EOF'
Add Cypress test for reload/rejoin mid-game

Tests the app's real, verified behavior: GameJoinPage.tsx's useEffect
auto-rejoins using the URL's game ID on every fresh mount (not the
originally-assumed "drops to a blank JoinScreen" behavior — see the
correction in this chunk's design spec). Covers both a pre-game
(waiting) reload and a mid-round (active) reload, asserting the
correct phase resumes each time rather than getting stuck on a stale
one.
EOF
)"
```
