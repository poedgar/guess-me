# Cypress Tests: Mirror-Mode Wrong-Guess & Multi-Round

**Date:** 2026-08-02
**Scope:** `apps/web` only (Cypress E2E suite). One small, targeted app-code addition (a single `data-cy` attribute), otherwise test-only. This is Chunk B of the ongoing Cypress suite expansion — Chunk A (basket & clash full rounds) already shipped; Chunks C (settings & lifecycle) and D (locale/animations/admin-left) remain, each with their own later spec.

## Problem

`mirror-round.cy.ts` (the existing suite's original test) only covers a single round with a correct guess, then checks results via the separate aggregate Results tab — it never actually drives a mirror game to its own `finished` status, and never exercises a wrong guess. This leaves two real gaps: the wrong-guess scoring path (does a target who guesses wrong still get their reciprocal points but no guess point?) and the multi-round cascade that ends a mirror game (each "finalize" action both finalizes the current round and starts the next, until every eligible participant has been a target once).

## Behavior

### Prerequisite: one `data-cy` attribute

Add `data-cy="target-selection-mode-toggle"` to the `targetSelectionMode` checkbox input in `apps/web/src/components/game/mirror/WaitingPhase.tsx` (inside the admin settings block, one of 4 undifferentiated `<input type="checkbox">` elements built from a shared `.map()`). In practice, all 4 toggles get a `data-cy` attribute as a natural consequence of the shared render code (see the implementation plan's Task 1 for why — special-casing just one of the 4 out of the shared `.map()` would have been more awkward than giving all 4 a `data-cy`), but this chunk's test only uses `target-selection-mode-toggle` — the other 3 (`adminWritesComments`/`showSurnames`/`showGuessResults`) remain available for Chunk C to use directly.

### `mirror-multi-round.cy.ts`

1. `test1` signs in, creates a mirror game (default game type), toggles `targetSelectionMode` to `chronological` via the new checkbox. This replaces the existing test's `Math.random` stub technique for target selection — chronological mode picks the earliest-joined eligible participant deterministically, which stays deterministic across any number of rounds without needing to track a call counter against the Firestore SDK's own internal `Math.random` use (a fragility the existing single-round test already works around, and which would compound across multiple rounds).
2. `test2` and `test3` join. `test1` starts the game. `adminWritesComments` stays off (the default) — this makes both `test2` and `test3` eligible targets and excludes `test1`, giving exactly 2 rounds total before the game reaches `finished`.
3. **Round 1** (chronological target = `test2`, the earlier joiner): `test3` writes a comment about `test2`; `test1` reveals; `test2` (target) awards the comment a point and finishes; `test3` awards a reciprocal point to `test2`; `test1` starts guessing; `test2` **deliberately selects the wrong author** (not `test3`) — exercising the previously-untested incorrect-guess path, where the guess is recorded as incorrect and contributes nothing to `guessResults`, but doesn't affect either side's already-awarded game points; `test1` clicks the finalize action (which internally runs `finalizeGuessingPhase()` then `startNextRound()` in the same click). Since one eligible target (`test3`) remains, this starts round 2 — the test asserts round 2's writing UI appears, not the results screen.
4. **Round 2** (target = `test3`): `test2` writes about `test3`; reveal; points both directions; `test1` starts guessing; `test3` **guesses correctly**; `test1` clicks finalize. This time no eligible targets remain, so the same finalize action sets `status: 'finished'` directly — no separate "end game" step exists in mirror mode, unlike basket/clash's explicit last-round handling.
5. **Assertion**: with the game now `finished` in-game (not via the separate Results tab the existing test uses), assert the in-game leaderboard (`leaderboard-row`/`leaderboard-total-points`, the same selectors `basket-round.cy.ts`/`clash-round.cy.ts` already use for their own finished-state checks) shows the exact point multiset `[3, 2, 0]`:
   - `test3`: 1 (comment point, round 1) + 2 (1 reciprocal + 1 correct-guess point, round 2) = 3
   - `test2`: 1 (reciprocal point, round 1) + 1 (comment point, round 2) = 2
   - `test1` (admin, never wrote/guessed): 0

## Out of Scope

- The other 3 admin settings toggles (`adminWritesComments`, `showSurnames`, `showGuessResults`) — Chunk C.
- A 4th test account — this test uses the same `test1`/`test2`/`test3` as every other spec in this suite.
- Reload/rejoin mid-game, locale switching, animations, admin-left handling — separate chunks.
