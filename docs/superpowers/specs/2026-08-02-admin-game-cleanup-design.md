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

The actual safety of this tool comes entirely from: (1) the route being unlinked and its path not otherwise discoverable, (2) the password gate, and (3) the two-step review-then-confirm deletion flow — not from any database-level access restriction beyond what already exists.

## Testing

- `apps/web` has no test runner (established in prior work) — verified via `tsc --noEmit` and a manual walkthrough: unlock the page, scan, confirm the review table shows accurate data for at least one known real game and one known test game, select only the test one, delete it, confirm it's gone from a re-scan.

## Out of Scope

- No Expo equivalent.
- No Firestore security rules changes.
- No new backend/Cloud Functions infrastructure.
- No "undo" — deletion is immediate once confirmed. The review table is the safety mechanism, not a soft-delete/trash system.
- No automatic identification of "which games are definitely test games" beyond the participant-count filter — the human review step is load-bearing, not a formality.
