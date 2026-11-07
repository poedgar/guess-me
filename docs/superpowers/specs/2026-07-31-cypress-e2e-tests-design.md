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

**One full mirror-mode round**, using three dedicated test accounts (`test1` = admin, `test2` and `test3` = participants — see Test Accounts below for why three, not one):
4. All three join the game (each via `cy.session()`-switched real sign-in and real UI clicks — see Test Accounts & Auth below); the admin starts it. `Math.random` is stubbed via `cy.window()` immediately after `cy.visit()` (before "Start Game" is clicked), so target selection is deterministic instead of actually random.
5. The non-target participant signs in (via `cy.session()`) and submits a comment through the real comment form.
6. The admin reveals comments and starts the guessing phase. Only the round's **target** may award comment points or submit guesses (confirmed in `GameContext.submitGuess`/`awardCommentPoints`, which throw for anyone else) — so the target participant signs in (via `cy.session()`) and, through the real UI, awards points to the comment and submits their guess for who wrote it. The non-target participant separately awards points to the target.
7. The admin signs back in, finalizes the round. Assertions: the round actually transitions (a new round starts, or the UI reflects round completion), and the Results tab shows the correct leaderboard for the now-completed round — which also exercises the "freeze leaderboard until round end" feature shipped just before this one.

Every participant's actions in this scenario go through the real app UI as that real signed-in user — nothing is written directly to Firestore. `cy.session()` caches each account's login after its first sign-in within the spec, so switching back to an account later in the same test doesn't require signing in from scratch again.

**Out of scope for this pass:** basket mode, clash mode, admin settings toggles, guess-accuracy edge cases, reconnect/adminLeft handling, and any Expo/mobile testing. These are all reasonable candidates for a later pass once this first slice is in place and proven reliable.

## Test Accounts & Auth

The app's UI only offers Google sign-in, which Cypress cannot drive reliably against Google's real OAuth flow (Google actively blocks scripted browsers). Instead:

- **Manual, one-time setup in the Firebase console — already done:** the Email/Password provider is enabled (Google sign-in stays enabled and unchanged for real users), three dedicated test accounts exist (`test1@example.com`, `test2@example.com`, `test3@example.com`, all password `12345678`), and a service account key has been downloaded (used for cleanup only — see below).
- Three accounts, not one, because Firestore's `participants` array is keyed by real Firebase Auth `userId` — one account cannot occupy two participant slots in the same game, and a meaningful round needs a non-admin author, a target who can award points and guess, and a second non-admin to award points to the target.
- **The app's UI has no email/password form** (only the Google button), so there's no existing way to drive `signInWithEmailAndPassword` through a click. A small, permanent, always-present hook is added to the app (in `AuthContext.tsx` or `main.tsx`) that exposes this on `window` for any caller — e.g. `window.__cypressSignInWithEmail(email, password)`. This adds no new capability beyond what's already possible (email/password sign-in is standard Firebase functionality, just not surfaced in this app's UI); it only makes it callable from a test. Every participant's real actions — including the admin's — go through this same hook to sign in, then real UI clicks from there. `cy.session(email, setupFn)` wraps this per account so repeated switches back to an already-used account in the same spec restore instantly instead of re-authenticating.

## Cleanup

- `apps/web/cypress.config.ts` registers one Node-side Cypress task (via `setupNodeEvents`), implemented with `firebase-admin` initialized from the service account key path (read from a Cypress env var, never hardcoded): `cleanupTestGames()` — deletes every `games` document whose `adminId` matches `test1`'s uid. Registered to run once after the full spec run (a global `after()` hook), so production Firestore doesn't accumulate test games run over run.
- No other use of the service account or `firebase-admin` — all in-test actions (joining, commenting, awarding points, guessing) go through the real UI as the real signed-in user, not direct Firestore writes.

## Project Structure & Tooling

- New devDependencies in `apps/web/package.json`: `cypress`, `firebase-admin` (Node-side only, used by `cypress.config.ts`'s cleanup task — never bundled into the app itself).
- `apps/web/cypress.config.ts` — `baseUrl: 'https://in-the-mirror.vercel.app'`, `setupNodeEvents` registering the cleanup task.
- `apps/web/cypress/e2e/smoke.cy.ts` — the 3 smoke-test scenarios.
- `apps/web/cypress/e2e/mirror-round.cy.ts` — the full-round scenario.
- `apps/web/cypress/support/commands.ts` — a `cy.signInAsTestUser(role: 'test1' | 'test2' | 'test3')` custom command wrapping `cy.session()` + the `window.__cypressSignInWithEmail` hook.
- Test account emails/password and the service account key path are read from `apps/web/cypress.env.json` (gitignored) — never committed, never hardcoded in spec files.
- New npm scripts on `apps/web/package.json`: `cypress:open` (interactive) and `cypress:run` (headless, what you'd run locally or wire into CI later).
- `data-cy` attributes are added to the handful of elements each test touches (sign-in button, game-ID input/submit, participant list items, start-game/show-comments/start-guessing/finalize buttons, guess-selection controls, leaderboard rows) — the codebase has no existing test hooks, and the default locale (Ukrainian) makes text-based selectors fragile, so `data-cy` is the stable selector strategy throughout.

## Out of Scope

- CI wiring (a GitHub Actions workflow to run these on push/PR) — not requested; can be a fast follow-up once this first pass is proven reliable locally.
- Any Expo/React Native testing — Cypress doesn't apply there.
- Basket mode, clash mode, and every flow not explicitly listed under Test Scope above.
- Firebase Emulator Suite — deliberately not used; tests run against the real deployed app and real production Firebase project, per explicit decision.
