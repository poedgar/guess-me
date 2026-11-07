# Admin Game Cleanup Tool

**Date:** 2026-08-02
**Scope:** `apps/web` only. This is a project-owner maintenance utility, not a player-facing feature — no Expo equivalent.

## Problem

Manual testing (and now automated Cypress runs, though those already self-clean) has left small test games scattered in the real production Firestore project. The project owner needs a way to find likely-test games (identified by having fewer participants than a real game would), review the actual details of each one to confirm it's really a test artifact and not a real user's game, and delete only the confirmed ones — without any risk of silently deleting real data.

## Behavior

A hidden route, `/admin/cleanup`, not linked from anywhere in the app's normal navigation — reachable only by typing the URL directly. It is a project-owner-only tool, not a per-game-admin feature (this app's existing "admin" role is scoped to whoever created a specific game; this tool operates across every game in the database, a different and more powerful capability).

**Access gate:** on load, the page prompts for the admin password before showing anything else — the same password already used to create games, checked against the same Firestore `password/{docId}` document and `password` field `GameContext.enterGame` already reads. A wrong password shows an error and the page stays locked; there is no separate "site admin" credential to manage.

**Scan:** once unlocked, a numeric input ("fewer than ___ participants", defaulting to 4, adjustable) plus a "Scan" button. Scanning fetches every document in the `games` collection (no per-user filter — this is the one place in the app that queries across all users' data) and filters client-side to games whose `participants.length` is below the threshold.

**Review table:** results render sorted newest-first (by `createdAt`), one row per candidate game, each with an unchecked-by-default checkbox and: game ID, admin name, admin email, every participant's name and email, created date, game type (mirror/basket/clash), status, and round count. This is deliberately everything potentially useful for telling a real small game apart from a test one at a glance (e.g. recognizing the project owner's own test-account emails) — no candidate game is ever deleted automatically by the filter alone.

**Delete:** a "Delete selected (N)" button, disabled until at least one row is checked. Clicking it opens the app's existing confirmation-alert component (the same `useAlert`/`FancyAlert` pattern already used elsewhere, e.g. confirming point awards) showing the count and asking for a final "yes." Only on confirmation are the checked games actually deleted.

## Architecture

Two new methods on `GameContext` (both platforms already funnel all Firestore access through this context per the project's existing convention — this tool follows the same rule even though it's an unusual, cross-user use case):

- `listAllGames(): Promise<Game[]>` — a plain, unscoped `getDocs(collection(db, 'games'))`. Every other `GameContext` method reads/writes only the signed-in user's own `currentGame`; this is the sole exception, gated entirely by the page-level password prompt rather than by Firestore security rules (see Security Model below).
- `deleteGames(gameIds: string[]): Promise<void>` — deletes each listed `games/{gameId}` document. Comments, guesses, and round data all live as nested arrays inside the game document itself (confirmed from this session's earlier exploration of `GameContext`'s write patterns) — there are no separate subcollections or standalone documents per game, so deleting the top-level document is sufficient; nothing is left orphaned.

The `/admin/cleanup` route is added to `App.tsx`'s `<Routes>` alongside the existing routes, rendering a new page component that owns its own password-prompt state, scan/filter logic, and selection state — it does not reuse `GameScreen`/`JoinScreen`/any existing game-flow component, since this isn't a game-flow screen.

## Security Model

There is no dedicated Firestore security rule change for this feature, and no new backend (no Cloud Function, no service-account-in-the-browser). The design relies on an already-true fact about this app: any signed-in user's browser can already read and write an arbitrary `games/{gameId}` document directly via the client SDK today — that's how joining a game by typing its ID works, for a user who isn't yet a participant. Whatever the actual (not version-controlled in this repo) Firestore rules currently allow for that flow, they're being relied on here too, for a collection-level list instead of a single-document get. If that assumption is wrong, `listAllGames()` will fail with a clear Firestore permission error rather than silently returning nothing — this plan does not add error-masking around that call, specifically so a permissions gap is loud and diagnosable rather than swallowed.

**Correction (found during the final review of the implementation, verified against the real production bundle):** the route is not actually "not otherwise discoverable" — it's a static import in the main bundle, so both the path string and the page's visible text ship to every visitor and are found by a single `grep` on the built JS. The password check is also done client-side (the real password value round-trips to the browser to be compared), so a signed-in user with devtools access could read it the same way `enterGame` already exposes it, or simply flip the component's `unlocked` state directly. None of this is a regression — any signed-in client can already read/write/delete an arbitrary `games/{gameId}` document today, with or without this page, so this tool adds convenience over an existing capability rather than a new one. But the real safety of this tool is **not** "hard to find" — it is only (1) the password gate as a speed bump against casual discovery, and (2) the two-step review-then-confirm deletion flow. If stronger access control is ever wanted, the actual lever is a Firestore security rule restricting `delete` on `games` to the document's own `adminId` — deliberately out of scope for this plan.

## Testing

- `apps/web` has a Cypress E2E suite (added in a separate, earlier plan) — this feature does not yet have its own spec, verified instead via `tsc --noEmit`, live manual/headless-browser walkthroughs during code review (using the same `window.__cypressSignInWithEmail` hook the Cypress suite relies on, without necessarily running through `cypress run` itself), and careful code-level tracing of the delete-gating logic. Note: `cypress.config.ts`'s `before:run`/`after:run` cleanup hooks delete real production documents, so running the existing Cypress suite is itself a destructive operation against production — a future spec for this page should account for that rather than assuming a plain `cypress run` is side-effect-free.

## Out of Scope

- No Expo equivalent.
- No Firestore security rules changes.
- No new backend/Cloud Functions infrastructure.
- No "undo" — deletion is immediate once confirmed. The review table is the safety mechanism, not a soft-delete/trash system.
- No automatic identification of "which games are definitely test games" beyond the participant-count filter — the human review step is load-bearing, not a formality.
