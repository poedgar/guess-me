# Cypress Tests: Basket & Clash Full Rounds

**Date:** 2026-08-02
**Scope:** `apps/web` only (Cypress E2E suite). No app code changes beyond adding `data-cy` attributes to existing basket/clash components. This is Chunk A of a 4-chunk expansion of the Cypress suite (Chunks B/C/D — mirror-mode extensions, settings/lifecycle, locale/animations/admin-left — are separate, later specs).

## Problem

The existing Cypress suite (`apps/web/cypress/e2e/mirror-round.cy.ts`) only covers mirror mode. Basket mode and clash mode — the app's other two game types — have zero E2E coverage and zero `data-cy` attributes on their components, so no test can even select their elements today. This leaves regressions in either mode's full write→reveal→guess→score flow undetected until a human manually tests them.

This work follows directly from fixing a real bug found while researching this chunk: `revealBasketComments()` compared submitted comment count against every participant (including a non-writing admin), permanently blocking basket's reveal step under default settings. That fix is already shipped; this spec covers the tests that would have caught it.

## Behavior

### Prerequisite: `data-cy` attributes

Add `data-cy` attributes to every interactive element needed by the two tests below, across:
- `apps/web/src/components/game/basket/` (writing phase, guessing phase — which-comment-is-mine and who-wrote-it steps)
- `apps/web/src/components/game/clash/` (`ClashSetupPanel`, writing phase, guessing phase, the admin advance control)

Follow the existing naming convention already used elsewhere in the app (`participant-row`, `start-game-button`, `alert-button`, etc.) — kebab-case, describing the element's role, not its visual styling. This is one combined task covering both modes, done before either spec file is written.

### `basket-round.cy.ts`

Mirrors the structure of `mirror-round.cy.ts`:

1. `test1` signs in, creates a basket game with default settings (`adminWritesComments` left off — the default, and the exact configuration the reveal-comments bug was hiding under).
2. `test2` and `test3` join via game ID.
3. `test1` starts the game. `Math.random` is stubbed (same technique as the mirror test) so the Fisher-Yates-shuffled basket schedule is deterministic. **Correction (found while writing the implementation plan):** `startBasketGame()` excludes the admin from `writers` whenever `adminWritesComments` is off ([GameContext.tsx:1655-1657](../../../apps/web/src/contexts/GameContext.tsx)), so with only `test1`/`test2`/`test3` available, `writers = [test2, test3]` — just 2 writers, producing `generateBasketSchedule`'s `n-1 = 1` round total, not 2. The admin never becomes a subject/guesser either, since the rotation only covers `writers`. `test1` participates only as the reveal/next-round administrator.
4. `test2` and `test3` write their round-1 comment (the only round; admin does not write one).
5. Admin reveals comments — this is the path the just-fixed bug blocked; the test asserts it succeeds and transitions to `basket_guessing`.
6. `test2` and `test3` complete both guessing steps (which comment is mine → who wrote it), confirming through the shared `alert-button` confirm dialog on each guess.
7. Points are awarded/asserted for at least one correct and one incorrect guess (matching the existing mirror test's approach of covering both outcomes).
8. Since this is the schedule's only round, admin's "next round" action flips `status` straight to `finished` — the test asserts the game reaches `finished` rather than confirming a round 2 (there isn't one).

### `clash-round.cy.ts`

1. `test1` signs in as admin and creates a clash game.
2. Using `ClashSetupPanel`, admin assigns groups: **Team A = test2** (solo member and, by the panel's auto-leader-on-first-assignment behavior, its leader), **Team B = test3** (same). **Correction (found while writing the implementation plan):** `generateClashSchedule` throws if the two groups aren't equal length, and `ClashSetupPanel`'s start button is disabled unless `groupAIds.length === groupBIds.length` — a 1-vs-2 split (the original idea) is not achievable at all. `test1` (admin) is never added to either group and never plays; `eligibleParticipants` already excludes the admin whenever `adminWritesComments` is off, so this falls out naturally. With `groupA.length === 1`, `generateClashSchedule` also produces exactly `n = 1` round total (not the multi-round case), so "one full round" and "the whole game" are the same thing here too.
3. `test1` starts the game. No `Math.random` stub needed — `generateClashSchedule` is deterministic.
4. `test2` and `test3` each write their one comment (about each other, per the round's assignment).
5. Guessing phase: the test controls submission order so `test2` (Team A) submits first and `test3` (Team B) submits second, making `lastGroupToFinish = 'b'` and thus `currentGuessingGroup` starts as `'b'` — `test3` (Team B's leader) guesses first, against `test2`'s comment; admin's advance control then passes control to `test2` (Team A's leader), who guesses against `test3`'s comment.
6. Test asserts both `clashData.teamScores` (team-level) and the acting leaders' individual `scores` update on each correct guess.
7. Since `groupA.length === 1` makes this the schedule's only round, admin's advance action (once both leaders are done) flips `status` straight to `finished` — the test asserts the game reaches `finished`.

Both tests necessarily play out their entire game rather than stopping mid-way — an unavoidable consequence of only 3 Cypress test accounts existing today, not a scope change from the original "one round" intent. Chunk B's mirror-mode multi-round-to-`finished` coverage remains a separate, mirror-specific concern.

### Verification

Both specs run via the project's existing `cypress run` workflow (local and the GitHub Actions CI already wired up) against real production Firebase, cleaned up automatically by the existing `cleanupTestGames` before/after hooks — no new test infrastructure needed.

## Out of Scope

- A 4th test account — both tests use only the existing `test1`/`test2`/`test3` (`test1` administers only, never writes/guesses in either mode).
- Admin settings toggles specific to basket/clash beyond what's needed to run one round (Chunk C).
- Any app code changes beyond adding `data-cy` attributes (the basket reveal-comments bug fix already shipped separately, ahead of this spec).
