# Laravel Port — Phase 1: Mirror Mode (Design Spec)

**Status:** Approved for implementation planning
**Scope:** First sub-project of a multi-phase migration from Firebase to a Laravel backend. This phase covers auth, game creation/join, admin round controls, and the Mirror game mode only. Basket, Clash, and Ideas modes are explicitly out of scope and will get their own specs once this phase is validated.

## Background

`in-the-mirror` is currently an npm-workspaces monorepo with two independently-implemented frontends (`apps/expo`, `apps/web`) sharing a Firebase (Firestore + Auth) backend. This spec adds a third, backend-owning implementation under `/laravel` at the repo root: a Laravel application that **replaces Firebase entirely** for the features it covers — its own database, its own auth, its own real-time transport. It does not read from or write to Firestore. It is a full re-implementation of the Mirror game mode against a relational schema, informed by (but not literally translating) `apps/web/src/contexts/GameContext.tsx` and `docs/game-mechanics.md`.

`/laravel` is a standalone Laravel project — its own `composer.json`, not part of the npm workspace, no dependency on `packages/shared` (its TypeScript types/i18n strings are reference material for parity, not an import).

## Goals

- Full auth parity with `apps/web`: Google sign-in (Socialite) + email/password (register, login, password reset).
- Full Mirror-mode game flow parity: waiting → active (comment submission) → guessing_phase → post-guessing point phase → next round / finished, per `docs/game-mechanics.md`.
- Real-time updates across all connected players' screens, replacing Firestore's `onSnapshot`.
- Same admin-password gate for game creation as the existing apps.

## Non-Goals (Phase 1)

- Basket, Clash, and Ideas game modes.
- `AdminCleanupPage` parity — Firestore-specific stale-game sweep; deferred to a future Artisan command if/when needed.
- Making `showSurnames`/`showGuessResults` functionally gate rendering — per `docs/game-mechanics.md`, these are stored-but-inert (or partially inert) in the source apps today. Phase 1 stores and toggles them identically but does not newly implement missing behavior that doesn't exist upstream either.
- Sound effects, QR-code join, and full i18n-js parity beyond reusing existing translation strings for the UI text this phase covers.
- Cypress-equivalent E2E coverage — Pest feature tests only in this phase; full E2E parity is a later addition once the UI stabilizes.

## Stack

| Concern | Choice |
|---|---|
| Framework | Latest stable Laravel (resolved at implementation time, not pinned here) |
| Frontend | Inertia.js + Vue 3 — controllers return Inertia responses (Vue page components), no separate JSON API layer |
| Real-time | Laravel Reverb (self-hosted WebSocket server) + Laravel Echo |
| Database | SQLite for local dev (Laravel's current default), swappable to MySQL/Postgres via `.env` — no code depends on the specific driver |
| Auth | Laravel's standard scaffolding (register/login/logout/password-reset) + Laravel Socialite for Google |
| Testing | Pest — unit tests for the game state machine, feature tests over HTTP endpoints |

## Data Model

Normalize entities that need relations or queries; keep transient phase-tracking bags as JSON columns — mirroring the fact that those fields are opaque, wholesale-read/write blobs in the current Firestore documents too, never queried into.

### `users`
Laravel's default columns, plus:
- `google_id` (nullable, unique) — set when signing in via Google
- `photo_url` (nullable)

### `games`
- `id` (internal PK)
- `code` (string, unique, public join ID — ported from `packages/shared/src/utils/gameIdGenerator.ts`'s word-based generation scheme)
- `admin_id` → `users.id`
- `status` enum: `waiting | active | guessing_phase | finished`
- `admin_writes_comments` (bool, default false)
- `show_surnames` (bool, default false)
- `show_guess_results` (bool, default false)
- `target_selection_mode` enum: `random | chronological`
- `post_guessing_point_phase` (bool, default false)
- `players_who_awarded_post_guess_points` (json, array of user IDs)
- `admin_awards` (json — `{ [userId]: { recipientId, points, awardedBy, awardedAt }[] }`)
- `players_who_completed_post_comment_phase` (json, array of user IDs)
- `admin_left` (bool, default false)
- `admin_next_target_preference` (nullable, FK-shaped but stored loosely — string user ID)
- `admin_skipped_targets` (json, array of user IDs)
- timestamps

### `game_participants`
- `game_id`, `user_id` (composite unique)
- `joined_at`
- `has_been_target` (bool, default false)
- `player_number` (nullable int — assigned once when the game starts, frozen for the game's lifetime, per the `playerNumbers` behavior in `types.ts`)

### `rounds`
- `game_id`, `round_number`
- `target_user_id` → `users.id`
- `comments_visible` (bool)
- `points_given` (bool)
- `guesses_finalized` (bool)
- `target_points` (nullable int)
- `target_points_given_by` (json, array of user IDs)
- `target_points_by_player` (json — `{ [userId]: points }`)
- `target_correct_guesses` (nullable int)
- `started_at`
- `start_scores_snapshot` (json — `{ [userId]: points }`, taken the instant the round begins; leaderboard displays this instead of live scores while a round is in progress, per the `roundStartScores` behavior)
- `start_guess_results_snapshot` (json — same idea for `guessResults`)

### `comments`
- `round_id`, `author_id` → `users.id`
- `text`
- `points` (nullable int)
- timestamps (`submitted_at` via `created_at`)

### `guesses`
- `round_id`, `comment_id`, `guesser_id`, `guessed_author_id` → `users.id`
- `correct` (bool)
- timestamps

### `game_scores`
- `game_id`, `user_id` (composite unique)
- `points` (int) — replaces the `scores` map

### `game_guess_results`
- `game_id`, `user_id` (composite unique)
- `correct_guesses` (int)

### `guessing_data` (per-round, JSON on `rounds`)
- `possible_authors` (json — `{ userId, userName }[]`)
- `players_who_submitted_guesses` (json, array of user IDs)
- `all_players_submitted` (bool)

This is stored per-round rather than as a single game-level blob (the Firestore shape had it keyed loosely by round) since `rounds` already exists as the natural per-round container here.

## Auth

- Standard Laravel register/login/logout/password-reset (email + password), matching `AuthContext.tsx`'s `registerWithEmail`/`signInWithEmail`/`resetPassword`.
- Laravel Socialite for "Sign in with Google," matching `signIn()`'s `signInWithPopup`. On first Google sign-in, create or match a `users` row by `google_id` (falling back to email match, same as Firebase Auth's linking behavior).
- Session-based auth (Laravel's default), not token-based — this is a server-rendered Inertia app, not a separate API consumer.

## Admin Password Gate

Game creation requires a shared password, matching the current apps' behavior exactly: it gates the *action* of creating a game, not a persistent role — any signed-in user who enters it correctly becomes that game's admin for that game only. Stored as `ADMIN_GAME_PASSWORD` in `.env`, checked in the create-game controller. This replaces the current Firestore-doc-by-ID lookup (`password/YR20RZ67FKy88HQVF6yW`) with a normal config value — there's no equivalent need for a separate document once this isn't shared cross-app.

## Real-Time Strategy

Firestore's `onSnapshot` gave every client a live push of the full updated document. The Laravel equivalent, deliberately kept asymmetric from that:

- Every game-mutating action (in `MirrorGameService`, see below) broadcasts a lightweight event — `GameUpdated` — on a private channel `game.{gameId}`. The event payload is **just the game ID**, not the game state.
- Vue listens via Echo (`Echo.private('game.' + gameId).listen('GameUpdated', () => router.reload({ only: ['game'] }))`).
- The reload re-invokes the same controller action that renders the page normally, re-fetching and re-shaping fresh state through one code path.

This trades a small round-trip latency (negligible — comment writing/reading happens over tens of seconds, not a chat-app cadence) for a single source of truth on how game state is shaped for the client, instead of maintaining parallel serializations in the initial page load and the broadcast payload.

Private channel authorization (`routes/channels.php`): a user may listen on `game.{gameId}` only if they're a participant or the admin of that game.

## Routes & Pages

Inertia pages under `resources/js/Pages/`:

- `/`, `/login`, `/register`, `/forgot-password` — auth + home/join screen
- `/rules` — static rules page (ported copy from `RulesPage.tsx`)
- `POST /games` — create (admin password + initial settings) → redirect to the new game
- `POST /games/join` — join by code
- `GET /games/{game}` — orchestrator page, mirroring `GameScreen.tsx`'s role: server determines which phase component to render based on `status`/`post_guessing_point_phase`, rendering one of `Pages/Game/Mirror/{Waiting,Active,Guessing,PostGuessingPoints,Results}.vue`. The leaderboard (`ResultsPage.tsx`'s content) is folded into this page rather than a separate route — the original `/results` route has no game ID in its own URL either; it just reads whatever game is already in context.

Action endpoints, `POST /games/{game}/...`, one thin controller method per action delegating into `MirrorGameService`:
`start`, `comments` (submit), `show-comments`, `start-guessing`, `guesses` (submit), `mark-guesses-submitted`, `finalize-guessing`, `next-round`, `target-points`, `comment-points/{comment}`, `post-guessing-awards`, `skip-post-comment-phase`, plus settings-update endpoints (`admin-writes-comments`, `show-surnames`, `target-selection-mode`, `show-guess-results`).

`MirrorGameService` (in `app/Services/`) owns the state-machine transitions and scoring rules — the relational-DB equivalent of `GameContext.tsx`'s methods (`startGame`, `submitComment`, `showComments`, `awardCommentPoints`, `finishAwardingPoints`, `startNextRound`, `givePointsToTarget`, `startGuessingPhase`, `finalizeGuessingPhase`, `submitGuess`, `markPlayerGuessesSubmitted`, `startPostGuessingPointPhase`, `awardPointsToPlayers`, `skipPostCommentPhase`, target-selection logic for `random`/`chronological` modes, and the admin-leaves-mid-game handling described in `docs/game-mechanics.md`'s "Admin-Less Flow" section). Each mutating method wraps its writes in a DB transaction and fires `GameUpdated` on success.

## Testing

- Pest unit tests for `MirrorGameService`: every state transition, scoring calculation, and the admin-left flow.
- Pest feature tests over the HTTP endpoints: full round-trip flows (create → join → start → comment → guess → finalize → next round → finish) as multi-user scenarios.
- No Cypress-equivalent E2E in this phase.

## Open Items For The Implementation Plan

- Exact Google OAuth linking behavior when an email already has a password-based account (mirror Firebase Auth's default linking, or require explicit merge — needs a decision during planning, not blocking the spec).
- Whether `code` (public join ID) reuses `gameIdGenerator.ts`'s Ukrainian-word scheme via a small PHP port, or a different generator — cosmetic, decide during planning.
