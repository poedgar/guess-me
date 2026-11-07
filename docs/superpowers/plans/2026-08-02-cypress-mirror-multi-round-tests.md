# Cypress Tests: Mirror-Mode Wrong-Guess & Multi-Round Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Cypress E2E coverage for mirror mode's wrong-guess path and its multi-round cascade to `finished` — neither is covered by the existing `mirror-round.cy.ts`, which only plays one round with a correct guess and checks results via the separate aggregate Results tab.

**Architecture:** One prerequisite task adds a `data-cy` to the `targetSelectionMode` admin-settings checkbox in `WaitingPhase.tsx`. One follow-up task writes `mirror-multi-round.cy.ts`, a single continuous 2-round game that ends in a wrong guess (round 1) then a correct guess that reaches `finished` (round 2), asserting the in-game leaderboard the same way `basket-round.cy.ts`/`clash-round.cy.ts` already do.

**Tech Stack:** Cypress (already configured in `apps/web`), TypeScript, React 19, no new dependencies.

## Global Constraints

- Only 3 Cypress test accounts exist (`test1`/`test2`/`test3`). `test1` administers only, never writes a comment or submits a guess.
- Mirror mode's round cascade: `finalize-button` (already existing, data-cy already present in `GuessingPhase.tsx`) triggers `finalizeGuessingPhase()` immediately followed by `startNextRound()` in the same click (`GuessingPhase.tsx`'s `handleFinalizeAndNextRound`). `startNextRound()` picks the next eligible target (excluding admin when `adminWritesComments` is off, excluding anyone already targeted) or, if none remain, sets `status: 'finished'` directly — there is no separate "end game" action in mirror mode.
- With `adminWritesComments` off (the default, used by this test) and 3 accounts, there are exactly 2 eligible targets (`test2`, `test3`), so the schedule is exactly 2 rounds before `finished`.
- `targetSelectionMode: 'chronological'` picks `sortParticipantsByJoin(availableParticipants)[0]` — the earliest-joined eligible participant — making target order fully deterministic without any `Math.random` stub. This setting can only be changed while `game.status === 'waiting'` (same guard pattern as the other admin settings toggles), so it must be set before `test1` clicks `start-game-button`.
- `possibleAuthors` in the guessing phase is every participant, admin included (`guess-author-button` has one button per participant, each carrying `data-cy-author-id={author.userId}`) — confirmed already true from `mirror-round.cy.ts`'s own comments. Player numbers are assigned once at `startGame()` in join order: `test1` (admin) = 1, `test2` = 2, `test3` = 3 — reused here to pick a definitively-wrong author (the admin, player 1, who never wrote anything) for the deliberate wrong guess.
- Do not touch `apps/expo` — this plan is `apps/web`-only.
- The only acceptable `tsc --noEmit -p apps/web/tsconfig.json` errors are the 3 pre-existing baseline ones (`PostCommentPointsPanel.tsx:69`, one in `GameContext.tsx`, `packages/shared/src/i18n.ts:2`).
- This spec runs against real production Firebase (`https://in-the-mirror.vercel.app`) like every other spec in this suite — `apps/web/cypress.env.json` must already exist locally with `test1`/`test2`/`test3` credentials.

---

## Task 1: `data-cy` for the admin settings toggles

**Files:**
- Modify: `apps/web/src/components/game/mirror/WaitingPhase.tsx`

**Interfaces:**
- Produces (consumed by Task 2): `data-cy="target-selection-mode-toggle"` on the `targetSelectionMode` checkbox. The other 3 toggles (`admin-writes-comments-toggle`, `show-surnames-toggle`, `show-guess-results-toggle`) are added too, as a natural consequence of the code shape below (all 4 settings are built from one shared array + `.map()` — see Step 1's rationale) — Task 2 only uses `target-selection-mode-toggle`; the other 3 names are recorded here for whichever future chunk writes settings-toggle tests, so that work doesn't reinvent or rename them.

- [ ] **Step 1: Add an `id` field to each settings entry and `data-cy` to the checkbox**

All 4 admin-settings checkboxes render from one shared array mapped to one `<input type="checkbox">` — there is no way to add a `data-cy` to only one of the four without either duplicating that shared render block (more code, more risk) or giving every entry a stable `id` and templating the attribute from it (one line, no behavioral change). This step does the latter.

In `apps/web/src/components/game/mirror/WaitingPhase.tsx`, find:

```tsx
              {[
                {
                  label: t('game.ui.adminWritesCommentsTitle'),
                  desc: t('game.ui.adminWritesCommentsDescription'),
                  checked: game.adminWritesComments ?? false,
                  onChange: handleToggleAdminComments,
                },
                {
                  label: t('game.ui.showSurnamesTitle'),
                  desc: t('game.ui.showSurnamesDescription'),
                  checked: game.showSurnames ?? false,
                  onChange: handleToggleShowSurnames,
                },
                {
                  label: t('game.ui.targetSelectionModeTitle'),
                  desc: t('game.ui.targetSelectionModeDescription'),
                  checked: (game.targetSelectionMode ?? 'random') === 'chronological',
                  onChange: handleToggleTargetMode,
                },
                {
                  label: t('game.ui.showGuessResultsTitle'),
                  desc: t('game.ui.showGuessResultsDescription'),
                  checked: game.showGuessResults ?? false,
                  onChange: handleToggleShowGuessResults,
                },
              ].map(({ label, desc, checked, onChange }) => (
                <label key={label} className="flex items-center justify-between gap-4 cursor-pointer">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={onChange}
                    className="w-5 h-5 accent-game-green"
                  />
                </label>
              ))}
```

Replace with:

```tsx
              {[
                {
                  id: 'admin-writes-comments',
                  label: t('game.ui.adminWritesCommentsTitle'),
                  desc: t('game.ui.adminWritesCommentsDescription'),
                  checked: game.adminWritesComments ?? false,
                  onChange: handleToggleAdminComments,
                },
                {
                  id: 'show-surnames',
                  label: t('game.ui.showSurnamesTitle'),
                  desc: t('game.ui.showSurnamesDescription'),
                  checked: game.showSurnames ?? false,
                  onChange: handleToggleShowSurnames,
                },
                {
                  id: 'target-selection-mode',
                  label: t('game.ui.targetSelectionModeTitle'),
                  desc: t('game.ui.targetSelectionModeDescription'),
                  checked: (game.targetSelectionMode ?? 'random') === 'chronological',
                  onChange: handleToggleTargetMode,
                },
                {
                  id: 'show-guess-results',
                  label: t('game.ui.showGuessResultsTitle'),
                  desc: t('game.ui.showGuessResultsDescription'),
                  checked: game.showGuessResults ?? false,
                  onChange: handleToggleShowGuessResults,
                },
              ].map(({ id, label, desc, checked, onChange }) => (
                <label key={id} className="flex items-center justify-between gap-4 cursor-pointer">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    data-cy={`${id}-toggle`}
                    checked={checked}
                    onChange={onChange}
                    className="w-5 h-5 accent-game-green"
                  />
                </label>
              ))}
```

(Note: `key={label}` changed to `key={id}` — `id` is a stable identifier the way `label`, a translated string, technically isn't across locale changes; this is a strict improvement, not a behavior change, since both are unique per item today.)

- [ ] **Step 2: Verify with `tsc`**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx tsc --noEmit -p apps/web/tsconfig.json
```

Expected: exactly the 3 pre-existing baseline errors, nothing new.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/game/mirror/WaitingPhase.tsx
git commit -m "$(cat <<'EOF'
Add data-cy attributes to the 4 admin settings toggles

Prerequisite for mirror-multi-round.cy.ts (added in a follow-up
commit), which needs target-selection-mode-toggle specifically. The
other 3 (admin-writes-comments-toggle, show-surnames-toggle,
show-guess-results-toggle) come along for free since all 4 render
from one shared array + map — no behavioral change.
EOF
)"
```

---

## Task 2: `mirror-multi-round.cy.ts`

**Files:**
- Create: `apps/web/cypress/e2e/mirror-multi-round.cy.ts`

**Interfaces:**
- Consumes: `target-selection-mode-toggle` from Task 1, plus the already-existing selectors `game-input`, `game-input-submit`, `participant-row`, `start-game-button`, `comment-input`, `submit-comment-button`, `show-comments-button`, `award-comment-points-button`, `finish-awarding-points-button`, `give-points-to-target-button`/`data-cy-points`, `alert-button`/`data-cy-style`, `start-guessing-button`, `guess-author-button`/`data-cy-author-id`, `submit-guesses-button`, `finalize-button`, `leaderboard-row`, `leaderboard-total-points`, and the global `cy.signInAsTestUser` command — all used unchanged from `mirror-round.cy.ts`.

- [ ] **Step 1: Write the spec**

```typescript
describe('Mirror mode wrong guess and multi-round completion', () => {
  it('plays 2 rounds (one wrong guess, one correct) and reaches finished', () => {
    const SETTLE_MS = 1500;

    // ── Set up: admin creates the game, switches target selection to
    // chronological (deterministic target order, no Math.random stub needed
    // even across multiple rounds), both players join ──────────────────────
    cy.signInAsTestUser('test1');
    cy.get('[data-cy=game-input]').type('YR20RZ67FKy88HQVF6yW3');
    cy.get('[data-cy=game-input-submit]').click();
    cy.url().should('match', /\/game\/[^/]+$/);
    cy.get('[data-cy=target-selection-mode-toggle]').click();
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

      // ── Admin starts the game. targetSelectionMode is chronological and
      // adminWritesComments is off (default), so startNextRound() picks the
      // earliest-joined eligible participant — test2 — as round 1's target,
      // deterministically, with no stub. ───────────────────────────────────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=participant-row]').should('have.length', 3);
      cy.get('[data-cy=start-game-button]').click();
      cy.get('[data-cy=start-game-button]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ══════════════════════ ROUND 1 (target: test2) ══════════════════════

      // ── test3 (the non-target) writes a comment about test2 ─────────────
      cy.signInAsTestUser('test3');
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

      // ── Target (test2) awards the comment a point, then finishes ─────────
      cy.signInAsTestUser('test2');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=award-comment-points-button]').click();
      cy.get('[data-cy=finish-awarding-points-button]').click();
      cy.get('[data-cy=finish-awarding-points-button]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── test3 awards a reciprocal point to test2, confirms in the alert ──
      cy.signInAsTestUser('test3');
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

      // ── Target (test2) DELIBERATELY guesses wrong — picks player 1
      // (test1, the admin), who never wrote anything. possibleAuthors
      // includes every participant regardless of who actually wrote, so
      // this button always exists and is guaranteed incorrect (test3 wrote
      // the comment, not test1). ────────────────────────────────────────────
      cy.signInAsTestUser('test2');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=guess-author-button]').should('have.length', 3);
      cy.contains('[data-cy=guess-author-button]', '1.').click();
      cy.get('[data-cy=submit-guesses-button]').click();
      cy.get('[data-cy=submit-guesses-button]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── Admin finalizes round 1 — since test3 is still an eligible
      // target, this starts round 2 rather than finishing the game. The
      // writing phase for round 2 should appear. ──────────────────────────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=finalize-button]').click();
      cy.wait(SETTLE_MS);

      // ══════════════════════ ROUND 2 (target: test3) ══════════════════════

      // ── test2 writes a comment about test3 ────────────────────────────────
      cy.signInAsTestUser('test2');
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

      // ── Target (test3) awards the comment a point, then finishes ─────────
      cy.signInAsTestUser('test3');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=award-comment-points-button]').click();
      cy.get('[data-cy=finish-awarding-points-button]').click();
      cy.get('[data-cy=finish-awarding-points-button]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── test2 awards a reciprocal point to test3 ──────────────────────────
      cy.signInAsTestUser('test2');
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

      // ── Target (test3) guesses CORRECTLY — picks player 2 (test2, the
      // real author). ───────────────────────────────────────────────────────
      cy.signInAsTestUser('test3');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=guess-author-button]').should('have.length', 3);
      cy.contains('[data-cy=guess-author-button]', '2.').click();
      cy.get('[data-cy=submit-guesses-button]').click();
      cy.get('[data-cy=submit-guesses-button]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── Admin finalizes round 2 — no eligible targets remain (both test2
      // and test3 have now been targeted once), so this sets the game
      // straight to 'finished'. ─────────────────────────────────────────────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=finalize-button]').click();
      cy.wait(SETTLE_MS);

      // ── Finished: test3 earned 3 (1 comment point round 1 + 1 reciprocal
      // + 1 correct-guess point round 2); test2 earned 2 (1 reciprocal round
      // 1 + 1 comment point round 2); test1 (admin, never wrote/guessed)
      // earned 0. ────────────────────────────────────────────────────────────
      cy.get('[data-cy=leaderboard-row]').should('have.length', 3);
      cy.get('[data-cy=leaderboard-total-points]').should(($points) => {
        const values = $points.toArray().map((el) => Number(el.textContent)).sort((a, b) => b - a);
        expect(values).to.deep.equal([3, 2, 0]);
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
npx cypress run --browser chrome --spec cypress/e2e/mirror-multi-round.cy.ts
```

Expected: 1 passing test. Before running, check for and kill any stray Cypress processes (`ps aux | grep -i cypress`) — a stray process caused confusing intermittent failures in an earlier plan's work on this same suite. If the spec fails at a step whose assumption doesn't hold (e.g. round 1's target isn't actually `test2`, or a `data-cy` value doesn't match), open `npx cypress open` on this spec and inspect the actual rendered DOM before changing anything — do not guess blindly.

If this is the first run after Task 1's commit, the `target-selection-mode-toggle` selector needs to be live on production before this suite (which always tests `https://in-the-mirror.vercel.app`) can find it — if the very first assertion after the toggle click fails oddly, check whether Task 1's commit has been pushed and deployed yet (poll the production JS bundle for `target-selection-mode-toggle` the same way earlier plans in this session confirmed deploys, or just ask the controller to push and wait).

- [ ] **Step 3: Commit**

```bash
git add apps/web/cypress/e2e/mirror-multi-round.cy.ts
git commit -m "$(cat <<'EOF'
Add Cypress test for mirror mode's wrong-guess path and multi-round completion

Plays a continuous 2-round game: round 1 ends in a deliberate wrong
guess, round 2 ends in a correct guess that reaches 'finished' via
mirror mode's normal round cascade (finalize both completes the
current round and starts the next, until no eligible targets remain).
Neither the wrong-guess path nor the finished transition was covered
by the existing mirror-round.cy.ts. Uses targetSelectionMode:
chronological for deterministic target order across both rounds,
instead of stubbing Math.random.
EOF
)"
```
