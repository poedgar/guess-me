# Laravel Mirror-Mode UI (Design Spec)

**Status:** Approved for implementation planning
**Scope:** Phase 2 of the Laravel Mirror-mode port. Phase 1 ([2026-08-15-laravel-mirror-port-design.md](2026-08-15-laravel-mirror-port-design.md)) built a complete, tested backend + HTTP surface for the Mirror game mode but no usable UI — three of five spec-named Vue phase pages were never scoped, and there was no create/join form or Google sign-in button. This phase closes that gap: a playable, bilingual (Ukrainian/English) browser UI over the existing, already-reviewed backend.

## Background

Phase 1's final whole-branch review found that `Show.vue` only ever routes to `Waiting`/`Results`; `Active.vue`, `Guessing.vue`, and `PostGuessingPoints.vue` — all named in phase 1's own spec — were never built. The `Dashboard.vue` page is still Breeze's stock placeholder with no create/join form, and `Login.vue`/`Register.vue` have no Google sign-in button despite the backend route existing since phase 1's Task 3. This is a planning gap, not an implementation bug: the backend is sound (112/112 tests passing after phase 1's final-review fix wave), but nothing in the browser can drive it.

Separately, the user wants the new screens bilingual (Ukrainian default + English) from the start, including backend validation error messages — not just static UI copy. Investigation found `packages/shared/src/locales/{en,uk}.json` (used by `apps/web`/`apps/expo`) already contains ~330 verified, production-quality translated strings covering nearly every concept these screens need. This spec treats that file as the primary source of translated copy, ported in rather than rewritten, to avoid introducing unverified Ukrainian text.

## Goals

- Every backend action built in phase 1 is reachable from a real screen: create game, join game, start game, submit/reveal/award comments, give target points, skip post-comment phase, start guessing, submit guesses, mark submitted, award post-guessing bonus points, finalize guessing, start next round, leave game, update settings.
- Google sign-in is reachable from the login/register screens.
- Every screen renders in Ukrainian (default) and English, including backend validation error messages.
- Real-time updates (already wired in phase 1 via Echo + Inertia partial reload) work end-to-end once real pages exist to re-render.

## Non-Goals

- Basket, Clash, Ideas modes; `AdminCleanupPage` parity; admin round-tools (`setNextRoundTarget`/`skipNextRoundTarget`/restart/skip-round) — all carried over unchanged from phase 1's Non-Goals.
- Browser-level E2E testing (Cypress-equivalent) — phase 1 established Pest-only test coverage as this project's boundary; this phase keeps it.
- Visual pixel-parity with `apps/web` — behavior and translated copy are ported, visual design is idiomatic Tailwind for this app, per this repo's existing "port behavior, restyle idiomatically" convention.
- Adding new languages beyond Ukrainian/English, or a general-purpose translation-management workflow.

## Localization Architecture

### Locale resolution

- `users` gains a nullable `locale` column (`'uk'` or `'en'`).
- Session key `locale` holds the active locale for the current request, working for guests (pre-login) and authenticated users alike.
- A `SetLocale` middleware (registered early, before route handling) resolves locale in this order: session value if present → authenticated user's stored `locale` if present → default `'uk'` (matching the sibling apps' Ukrainian-default convention) — then calls `app()->setLocale($resolved)` and writes it to session if not already there.
- `POST /locale` (any authenticated or guest user) updates the session immediately; if authenticated, also persists to `users.locale`. This is what the locale-switcher control calls.
- `HandleInertiaRequests::share()` adds `'locale' => app()->getLocale()` to every Inertia response's shared props.

### Backend translation

- `lang/en.json` and `lang/uk.json` (Laravel's flat-key JSON translation format — the key IS the canonical English string, e.g. `__('You cannot comment about yourself')`).
- Every `RuntimeException`/validation message thrown across `GameLifecycleService`, `CommentPhaseService`, `GuessingPhaseService`, `GameSettingsService` gets wrapped in `__(...)`. Since these exceptions are thrown mid-request, `app()->getLocale()` is already correctly resolved by `SetLocale` by the time they fire — no additional plumbing needed. This means `ValidationException`/`abort(403)` messages arrive at the frontend already in the right language; the frontend never re-translates server-originated error text, only its own static UI copy.
- New Ukrainian text for messages with no existing counterpart in `packages/shared` (i.e., the specific backend validation-rule strings — "Only the target person can give points," "You already gave points to this target this round," etc.) is written using the existing locale files' established vocabulary (ціль for target, коментар for comment, нарахувати бали for award points, etc.) for terminological consistency, not invented independently.

### Frontend translation

- `vue-i18n`, initialized in `resources/js/app.js`, seeded from the Inertia-shared `locale` prop (re-synced on every page visit, so a locale change via `POST /locale` + redirect immediately reflects everywhere).
- `resources/js/locales/en.json` and `resources/js/locales/uk.json` — populated primarily by **porting the relevant subset of keys/values verbatim from `packages/shared/src/locales/{en,uk}.json`** (auth.*, game.waiting, game.activePhase, game.guessingPhase, game.alerts.*, game.ui.* families that apply to Mirror mode — skip Basket/Clash/Ideas-specific keys). Key names may be flattened/renamed to fit this app's own component structure; values are copied verbatim, not retranslated.
- A locale-switcher component (simple toggle, UK/EN) in a shared layout header, posting to `POST /locale`.

## Pages

All under `resources/js/Pages/`. Existing files from phase 1 are extended, not replaced.

### Auth pages (`Pages/Auth/Login.vue`, `Register.vue` — Breeze-generated, phase 1 untouched)
Add a "Sign in with Google" button linking to `GET /auth/google/redirect` (built in phase 1's Task 3, currently unreachable from the UI). Translate existing Breeze-generated labels via the new `auth.*` keys ported from `packages/shared`.

### `Pages/Dashboard.vue` (Breeze-generated, phase 1 untouched)
Replace the placeholder body with the create/join form: one input for either the admin password (creates a game via `POST /games`) or a game code (joins via `POST /games/join`) — mirroring `apps/web`'s single-input "enter game or password" UX (`game.gameIdPlaceholder`/`game.ui.createOrJoin.*` keys already exist in `packages/shared`). On success, redirect follows the existing controller redirects to `/games/{id}`.

### `Pages/Game/Mirror/Waiting.vue` (phase 1 stub — 14 lines, gets rebuilt)
- Participant list (already has data via `GameResource.participants`).
- Admin-only: start button (`POST /games/{id}/start`, disabled until ≥2 participants, matching the backend's own rule so the disabled state and the eventual validation error agree), the four settings toggles (`POST /games/{id}/settings/*`, only shown/enabled while `status === 'waiting'`, matching `GameSettingsService`'s own gate).
- Everyone: leave button (`POST /games/{id}/leave`).

### `Pages/Game/Mirror/Active.vue` (new)
Renders based on `game.currentRound` and whether the current user is the round's target:
- **Non-target, no comment yet**: comment textarea + submit (`POST /games/{id}/comments`), 500-char counter matching the backend's own limit.
- **Non-target, after submitting**: "waiting" state.
- **Target, before reveal**: "waiting for others to comment" state.
- **Target, after admin reveals** (`comments_visible`): comment list with per-comment point input + award button (`POST /games/{id}/comment-points/{comment}`), then a "finish awarding" button (`POST /games/{id}/finish-awarding-points`) once all comments have a point value.
- **Everyone except target, after `points_given`**: give-target-points button (`POST /games/{id}/target-points`) or skip button (`POST /games/{id}/skip-post-comment-phase`), each disabled once that user has already acted (mirroring the backend's own "already did this" checks).
- **Admin only**: show-comments button (`POST /games/{id}/show-comments`, shown once comments exist and aren't yet visible), start-guessing button (`POST /games/{id}/start-guessing`, shown once the backend's own gate — `comments_visible && points_given` and everyone's completed the post-comment phase — would pass; disabled with the exact reason otherwise, reusing the translated backend message rather than re-deriving the rule client-side).

### `Pages/Game/Mirror/Guessing.vue` (new)
- **Target**: per-comment author picker (radio/select from `guessing_possible_authors`) + guess submission (`POST /games/{id}/guesses`), then implicit/explicit mark-submitted (`POST /games/{id}/mark-guesses-submitted`) once every comment has a guess.
- **Everyone else**: waiting state.
- **Once `post_guessing_point_phase` is true** (same page, new state — not a separate route): bonus-points form (pick a recipient + amount, `POST /games/{id}/post-guessing-awards`), disabled once this user has already awarded this phase.
- **Admin only**: finalize-guessing button (`POST /games/{id}/finalize-guessing`).

### `Pages/Game/Mirror/Results.vue` (phase 1 stub — 16 lines, gets polished)
- Leaderboard table (already has data via `GameResource.leaderboard`), medal styling for top 3.
- `adminLeft` banner when set.
- **Admin only, game not finished**: next-round button (`POST /games/{id}/next-round`) — this page is also what renders mid-game between `finalizeGuessingPhase` and `startNextRound`, per phase 1's `GameResource` status logic (`status === 'active'` with the prior round's `guesses_finalized === true` is the "between rounds" state — `Show.vue`'s phase-routing `computed` needs a branch for this, not just `status === 'finished'`).

### `Pages/Game/Show.vue` (phase 1, gets its routing completed)
Currently only routes `finished` → `Results`, everything else → `Waiting`. Gets branches for `active` (→ `Active.vue`, or `Results.vue` if the round is already finalized per above), `guessing_phase` (→ `Guessing.vue`).

## Data Flow

No new backend endpoints beyond `POST /locale`. Every page consumes the existing `GameResource` shape from phase 1 (`game.status`, `game.isAdmin`, `game.settings`, `game.participants`, `game.currentRound`, `game.leaderboard`, `game.postGuessingPointPhase`) plus the new shared `locale` prop. Real-time re-rendering is already correct (phase 1 Task 25) — new pages just need to read the same props the existing Echo-triggered partial reload already refreshes.

## Testing

- Pest feature tests per page-backing route: assert the right Inertia component renders for each `status`/role combination (e.g., a non-admin sees `Active` without the show-comments button data; the admin sees it).
- A locale test: assert `POST /locale` updates the session/user and that a subsequent request's shared `locale` prop reflects it, and that a triggered validation error (e.g. `submitComment`'s self-comment rejection) arrives translated when `locale = 'uk'`.
- No new Cypress/browser E2E, consistent with phase 1.

## Open Items For The Implementation Plan

- Exact `vue-i18n` message-key naming convention (flat vs. nested) — cosmetic, decide during planning.
- Whether the locale switcher lives in a new shared `AppLayout` header or is added per-page — decide during planning based on what Breeze's scaffold already provides.
