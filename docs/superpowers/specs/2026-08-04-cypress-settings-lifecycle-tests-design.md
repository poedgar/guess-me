# Cypress Tests: Settings & Lifecycle

**Date:** 2026-08-04
**Scope:** `apps/web` only (Cypress E2E suite). No app code changes — every selector this chunk needs already exists (`admin-writes-comments-toggle` from Chunk B; everything else is pre-existing). This is Chunk C of the ongoing Cypress suite expansion — Chunks A (basket & clash) and B (mirror wrong-guess & multi-round) already shipped; Chunk D (locale/animations/admin-left) remains.

## Problem

Two real gaps remain in the mirror-mode test suite:
1. `adminWritesComments` has only ever been exercised in its default (off) state across every existing test — the on-path (admin becomes an eligible writer/target) has no coverage.
2. Reloading the page mid-game has never been tested. **Correction (found while writing the implementation plan):** the original premise here — that a reload always drops back to a blank `JoinScreen` requiring manual re-entry — is wrong. `GameContext.tsx`'s own `currentGame` state does have no persistence layer in isolation, but `GameJoinPage.tsx` (rendered at the `/game/:gameId` route) has its own `useEffect` that automatically calls `enterGame(gameId)` using the game ID already present in the URL, on every fresh mount (guarded by a `useRef` that resets on reload, not by anything persistence-related). And `HomePage.tsx` navigates the browser to `/game/<id>` (`replace: true`) the moment a game becomes active. So in real usage, once a user is mid-game, their address bar already shows `/game/<id>` — reloading lands them back on `GameJoinPage`, which **automatically rejoins the same game** via the URL, no manual re-entry needed. The actual gap is proving this auto-rejoin correctly resumes at the right in-progress phase, not that it fails to restore at all.

**Scope correction (not part of this chunk's testing work):** while researching this chunk, a search across `apps/web/src` confirmed `showSurnames` and `showGuessResults` are stored and toggleable (`GameContext.tsx`, `WaitingPhase.tsx`'s own checkbox) but read by no other component — toggling either currently has zero observable effect anywhere in the web app. This looks like a dormant bug (settings that silently do nothing) rather than a testing gap, so no test is written against behavior that doesn't exist. Flagged here for a separate fix, out of scope for this plan.

## Behavior

### `admin-writes-comments.cy.ts`

1. `test1` signs in, creates a mirror game with just `test1` and `test2` (2 participants — keeps the schedule minimal and focused on proving the toggle itself works, not re-testing round mechanics already covered elsewhere).
2. `test1` toggles `adminWritesComments` on (`admin-writes-comments-toggle`, already exists) and `targetSelectionMode` to `chronological` (`target-selection-mode-toggle`, from Chunk B) for deterministic target order.
3. `test1` starts the game. With `adminWritesComments` on, `startNextRound()`'s `availableParticipants` filter no longer excludes the admin — `test1` becomes a legitimate target candidate. With only 2 participants and chronological ordering, `test1` (the game's creator) is expected to be round 1's target — confirmed via the same runtime-detection technique established in Chunk B (sign in, check which UI renders) rather than assumed, since Chunk B already found chronological ordering isn't perfectly reliable in practice.
4. Whichever participant is NOT round 1's target writes a comment about the target; reveal; points both directions; guessing phase; a guess (correct, to keep this test focused on proving the toggle rather than re-covering the wrong-guess path from Chunk B).
5. **Assertion:** the test's core claim is proven by `test1` successfully appearing as a target and completing a normal target's flow (awarding points, appearing in `guess-author-button`'s possible-authors list is no longer the only way `test1` shows up — `test1` is now the one being written about) — not by reaching `finished` (with only 2 eligible participants, one round's finalize starts round 2, it doesn't finish the game). The round-1-frozen leaderboard (`roundStartScores`, visible inline on `ActivePhase` without navigating anywhere) is asserted for completeness once round 2 begins, but is secondary to proving the admin-as-target path executed at all.

### `reload-rejoin.cy.ts`

Tests the real, verified behavior: reloading mid-game auto-rejoins via the URL (`GameJoinPage`'s effect), and the correct in-progress phase renders afterward — not that reload fails to restore anything.

1. `test1` creates a mirror game, `test2` and `test3` join — status `waiting`. (3 participants, not 2 — with `adminWritesComments` off, a 2-participant mirror game has no eligible commenter once the sole non-admin participant becomes the target, so this test needs the same 3-account shape as every other mirror spec.)
2. As `test3`, reload the page while still on `/game/<gameId>` (the URL `enterGame` already navigated to on joining). Assert the correct `waiting` state resumes afterward (`participant-row` count still 3, no `start-game-button` for a non-admin) — confirms auto-rejoin works correctly before the game has even started, not just mid-round.
3. `test1` starts the game — status `active`.
4. Determine which of `test2`/`test3` is this round's commenter (not the target) at runtime, using the same defensive sign-in-and-check-the-DOM technique established in Chunk B — the commenter's correct post-reload state (`comment-input` present) has a concrete, assertable selector, unlike the target's pre-reveal state (plain waiting text with no dedicated `data-cy`).
5. As the detected commenter, reload the page again. Assert the correct phase resumes afterward: `comment-input` exists (the writing phase, not `WaitingPhase`'s start-game button or any stale state) — this is the test's central claim, that auto-rejoin resumes the actual current phase correctly.

## Out of Scope

- Fixing the dormant `showSurnames`/`showGuessResults` bug — flagged for separate work, not this plan.
- `targetSelectionMode`'s own dedicated test — already exercised (functionally, if not by name) in Chunk B.
- Reload testing for basket/clash modes, or reload during `guessing_phase`/`finished` specifically — mirror's `waiting`/`active` phases are sufficient to prove the auto-rejoin mechanism works; the mechanism itself (`GameJoinPage`'s URL-driven `enterGame` call) is mode-agnostic and phase-agnostic by construction (it only depends on the URL's `gameId` and calls the same `enterGame` every manual join already uses).
- Admin-leaves-game (`adminLeft`) handling, locale switching, animations — Chunk D.
