# Cypress E2E Tests for the Web App

**Date:** 2026-07-31
**Scope:** `apps/web` only. Cypress drives a real browser against a real web app — it has no equivalent for `apps/expo` (a React Native app), so this plan does not touch Expo.

## Problem

`apps/web` has no automated test coverage of any kind today (no test runner is configured for the package). The goal is a first, focused pass of end-to-end tests covering the most essential flows, run against the live deployment at https://in-the-mirror.vercel.app, backed by the real production Firebase project (`spygame-2fce3`) — not a local emulator.

## Test Scope

**Smoke tests:**
1. Sign in with a dedicated test account → the join screen renders.
2. Create a game by entering the admin password → a game ID is returned and the waiting-room screen renders.
3. A second dedicated test account joins that game via its ID → the admin's waiting-room participant list shows them.

**One full mirror-mode round**, using three dedicated test accounts (`e2e-admin`, `e2e-player2`, `e2e-player3` — see Test Accounts below for why three, not one):
4. All three join the game; the admin starts it. `Math.random` is stubbed via `cy.window()` immediately after `cy.visit()` (before "Start Game" is clicked), so target selection is deterministic instead of actually random.
5. The non-target seeded participant's comment is written directly into Firestore (via the service account — see Seeding & Cleanup below), in the exact document shape `GameContext.submitComment` itself writes.
6. The admin (the real, Cypress-driven browser) reveals comments, starts the guessing phase, and submits a guess. The other seeded participant's guess is written directly the same way.
7. The admin finalizes the round. Assertions: the round actually transitions (a new round starts, or the UI reflects round completion), and the Results tab shows the correct leaderboard for the now-completed round — which also exercises the "freeze leaderboard until round end" feature shipped just before this one.

**Out of scope for this pass:** basket mode, clash mode, admin settings toggles, guess-accuracy edge cases, reconnect/adminLeft handling, and any Expo/mobile testing. These are all reasonable candidates for a later pass once this first slice is in place and proven reliable.

## Test Accounts & Auth

The app's UI only offers Google sign-in, which Cypress cannot drive reliably against Google's real OAuth flow (Google actively blocks scripted browsers). Instead:

- **Manual, one-time setup in the Firebase console (not automatable by an agent — you'll need to do this yourself):**
  1. Enable the **Email/Password** provider in Firebase Authentication (Google sign-in stays enabled and unchanged for real users).
  2. Create three dedicated test accounts under that provider: `e2e-admin@<your-test-domain>`, `e2e-player2@...`, `e2e-player3@...`, each with a password you'll store as a Cypress secret (never committed).
  3. Generate a Firebase service account key (Project Settings → Service Accounts → Generate new private key), save the JSON file somewhere outside the repo or in a gitignored path, and note its location for the Cypress config.
- Three accounts, not one, because Firestore's `participants` array is keyed by real Firebase Auth `userId` — one account cannot occupy two participant slots in the same game, so a meaningful round (someone besides the admin writing a comment, someone besides the author guessing) needs at least two non-admin identities.
- The admin's own actions run through **real Firebase Auth in the actual browser** (`signInWithEmailAndPassword`, called from a Cypress custom command) — this is the path genuinely under test, so it goes through the real Firebase SDK, real security rules, everything.
- The other two accounts' actions (joining, commenting, guessing) are **not** driven through a second/third real browser session — Cypress doesn't support genuinely concurrent multi-session browser control in one spec. Instead they're simulated as direct Firestore writes from a Node-side Cypress task, using the service account, in the exact shapes the real client code would write. This bypasses security rules for those specific background writes (a deliberate, scoped trade-off — the thing under test is the admin's real, rule-respecting browser session; the other participants are test fixtures, not what's being verified).

## Seeding & Cleanup

- `apps/web/cypress.config.ts` registers Node-side Cypress tasks (via `setupNodeEvents`), implemented with `firebase-admin` initialized from the service account key path (read from a Cypress env var, never hardcoded):
  - `seedParticipantJoin({ gameId, userId, userName })` — writes a `Participant` into the game's `participants` array, matching `GameContext.joinGame`'s write shape.
  - `seedComment({ gameId, roundNumber, authorId, text })` — writes a `Comment` into the current round, matching `GameContext.submitComment`'s write shape.
  - `seedGuess({ gameId, roundNumber, commentId, guesserId, guessedAuthorId })` — writes a guess, matching `GameContext.submitGuess`'s write shape.
  - `cleanupTestGames()` — deletes every `games` document whose `adminId` matches the `e2e-admin` test account's uid. Registered to run once after the full spec run (a global `after()` hook), so production Firestore doesn't accumulate test games run over run.
- The exact document shapes these tasks write are pinned to what `GameContext.tsx` currently writes at the time the implementation plan is written — the plan will reference the real, current field names directly rather than re-deriving them from the design doc.

## Project Structure & Tooling

- New devDependencies in `apps/web/package.json`: `cypress`, `firebase-admin` (Node-side only, used by `cypress.config.ts`'s tasks — never bundled into the app itself).
- `apps/web/cypress.config.ts` — `baseUrl: 'https://in-the-mirror.vercel.app'`, `setupNodeEvents` registering the tasks above.
- `apps/web/cypress/e2e/smoke.cy.ts` — the 3 smoke-test scenarios.
- `apps/web/cypress/e2e/mirror-round.cy.ts` — the full-round scenario.
- `apps/web/cypress/support/commands.ts` — a `cy.signInAsTestUser(role: 'admin' | 'player2' | 'player3')` custom command wrapping `signInWithEmailAndPassword` against the real Firebase SDK loaded in the test browser.
- Test account emails/passwords and the service account key path are read from `apps/web/cypress.env.json` (gitignored) — never committed, never hardcoded in spec files.
- New npm scripts on `apps/web/package.json`: `cypress:open` (interactive) and `cypress:run` (headless, what you'd run locally or wire into CI later).
- `data-cy` attributes are added to the handful of elements each test touches (sign-in button, game-ID input/submit, participant list items, start-game/show-comments/start-guessing/finalize buttons, guess-selection controls, leaderboard rows) — the codebase has no existing test hooks, and the default locale (Ukrainian) makes text-based selectors fragile, so `data-cy` is the stable selector strategy throughout.

## Out of Scope

- CI wiring (a GitHub Actions workflow to run these on push/PR) — not requested; can be a fast follow-up once this first pass is proven reliable locally.
- Any Expo/React Native testing — Cypress doesn't apply there.
- Basket mode, clash mode, and every flow not explicitly listed under Test Scope above.
- Firebase Emulator Suite — deliberately not used; tests run against the real deployed app and real production Firebase project, per explicit decision.
