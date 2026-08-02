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
3. `test1` starts the game. `Math.random` is stubbed (same technique as the mirror test) so the Fisher-Yates-shuffled basket schedule is deterministic.
4. All three participants write their round-1 comment (admin does not write one, per `adminWritesComments` being off).
5. Admin reveals comments — this is the path the just-fixed bug blocked; the test asserts it succeeds and transitions to `basket_guessing`.
6. All three participants complete both guessing steps (which comment is mine → who wrote it), confirming through the shared `alert-button` confirm dialog on each guess.
7. Points are awarded/asserted for at least one correct and one incorrect guess (matching the existing mirror test's approach of covering both outcomes).
8. Test asserts round 2 begins (basket runs `n-1` rounds for `n` participants — 2 rounds for 3 participants).

### `clash-round.cy.ts`

1. `test1` signs in as admin and creates a clash game.
2. Using `ClashSetupPanel`, admin assigns groups: **Team A = test1** (admin also plays, as the sole member and leader of Team A), **Team B = test2 + test3** (test2 as the first-added member, expected to be Team B's leader per the deterministic array-order scheduling — confirmed against `clashSchedule.ts` at implementation time rather than assumed here).
3. `test1` starts the game. No `Math.random` stub needed — `generateClashSchedule` is deterministic.
4. All participants write their comments for round 1.
5. Guessing phase: Team A's leader (test1) guesses against Team B's comments on behalf of the whole team; admin's advance control passes control to Team B's leader (test2), who guesses against Team A's comments.
6. Test asserts both `clashData.teamScores` (team-level) and the acting leaders' individual `scores` update.
7. Test asserts the round/game-end transition begins after both leaders finish (advance button's dynamic label — "next leader" → "next round"/"finish game" — reflects this).

Both tests stop after one full round each (not driving either mode to `finished`), matching `mirror-round.cy.ts`'s existing scope. Multi-round-to-completion coverage is Chunk B's concern (currently scoped for mirror mode only).

### Verification

Both specs run via the project's existing `cypress run` workflow (local and the GitHub Actions CI already wired up) against real production Firebase, cleaned up automatically by the existing `cleanupTestGames` before/after hooks — no new test infrastructure needed.

## Out of Scope

- Full multi-round-to-`finished` runs for basket or clash (Chunk B territory, and currently only planned for mirror mode).
- A 4th test account — the 1-vs-2 team split uses only the existing `test1`/`test2`/`test3`.
- Admin settings toggles specific to basket/clash beyond what's needed to run one round (Chunk C).
- Any app code changes beyond adding `data-cy` attributes (the basket reveal-comments bug fix already shipped separately, ahead of this spec).
