# Cypress Tests: Settings & Lifecycle

**Date:** 2026-08-04
**Scope:** `apps/web` only (Cypress E2E suite). No app code changes — every selector this chunk needs already exists (`admin-writes-comments-toggle` from Chunk B; everything else is pre-existing). This is Chunk C of the ongoing Cypress suite expansion — Chunks A (basket & clash) and B (mirror wrong-guess & multi-round) already shipped; Chunk D (locale/animations/admin-left) remains.

## Problem

Two real gaps remain in the mirror-mode test suite:
1. `adminWritesComments` has only ever been exercised in its default (off) state across every existing test — the on-path (admin becomes an eligible writer/target) has no coverage.
2. Reloading the page mid-game has never been tested. `GameContext.tsx`'s `currentGame` state has no persistence layer (`useState<Game | null>(null)`, no localStorage/sessionStorage, and its real-time listener effect only activates `if (currentGame?.id)` — which is never true on a fresh mount), so a reload always drops back to `JoinScreen` regardless of game phase. This is expected, existing behavior — the gap is that nothing proves rejoining afterward actually resumes the game correctly rather than getting stuck.

**Scope correction (not part of this chunk's testing work):** while researching this chunk, a search across `apps/web/src` confirmed `showSurnames` and `showGuessResults` are stored and toggleable (`GameContext.tsx`, `WaitingPhase.tsx`'s own checkbox) but read by no other component — toggling either currently has zero observable effect anywhere in the web app. This looks like a dormant bug (settings that silently do nothing) rather than a testing gap, so no test is written against behavior that doesn't exist. Flagged here for a separate fix, out of scope for this plan.

## Behavior

### `admin-writes-comments.cy.ts`

1. `test1` signs in, creates a mirror game with just `test1` and `test2` (2 participants — keeps the schedule minimal and focused on proving the toggle itself works, not re-testing round mechanics already covered elsewhere).
2. `test1` toggles `adminWritesComments` on (`admin-writes-comments-toggle`, already exists) and `targetSelectionMode` to `chronological` (`target-selection-mode-toggle`, from Chunk B) for deterministic target order.
3. `test1` starts the game. With `adminWritesComments` on, `startNextRound()`'s `availableParticipants` filter no longer excludes the admin — `test1` becomes a legitimate target candidate. With only 2 participants and chronological ordering, `test1` (the game's creator) is expected to be round 1's target — confirmed via the same runtime-detection technique established in Chunk B (sign in, check which UI renders) rather than assumed, since Chunk B already found chronological ordering isn't perfectly reliable in practice.
4. Whichever participant is NOT round 1's target writes a comment about the target; reveal; points both directions; guessing phase; a guess (correct, to keep this test focused on proving the toggle rather than re-covering the wrong-guess path from Chunk B).
5. **Assertion:** the test's core claim is proven by `test1` successfully appearing as a target and completing a normal target's flow (awarding points, appearing in `guess-author-button`'s possible-authors list is no longer the only way `test1` shows up — `test1` is now the one being written about) — not just a final score number. The final leaderboard is asserted for completeness but is secondary to proving the admin-as-target path executed at all.

### `reload-rejoin.cy.ts`

1. `test1` creates a mirror game, `test2` joins — status `waiting`.
2. As `test2`, reload the page (`cy.reload()` or equivalent). Assert `JoinScreen` renders (`game-input` visible) — not auto-restored to the game view.
3. Re-enter the game ID. Assert the game renders correctly at `waiting` (`participant-row` count matches, `start-game-button` visible to admin only — from `test2`'s perspective, no start button).
4. `test1` starts the game — status `active`.
5. As `test2` again, reload. Assert `JoinScreen` renders again.
6. Re-enter the game ID. Assert the *correct* in-progress phase renders — `ActivePhase`'s comment-writing or waiting-for-comments view (depending on whether `test2` is the round's target), not `WaitingPhase`'s start-game button or any other stale/incorrect state. This is the test's real claim: rejoining resumes the actual current phase, it doesn't get stuck showing an earlier one.

## Out of Scope

- Fixing the dormant `showSurnames`/`showGuessResults` bug — flagged for separate work, not this plan.
- `targetSelectionMode`'s own dedicated test — already exercised (functionally, if not by name) in Chunk B.
- Reload testing for basket/clash modes, or reload during `guessing_phase`/`finished` specifically — mirror's `active` phase is sufficient to prove the rejoin mechanism works; the mechanism itself (a blank `currentGame` on mount, restored only via explicit rejoin) is mode-agnostic and phase-agnostic by construction (confirmed by reading `GameContext.tsx` — nothing about the listener setup is mode- or phase-specific).
- Admin-leaves-game (`adminLeft`) handling, locale switching, animations — Chunk D.
