# Cypress Tests: Locale, Animations & Admin-Left

**Date:** 2026-08-04
**Scope:** `apps/web` only (Cypress E2E suite). Two small, targeted `data-cy` additions, otherwise test-only. This is Chunk D, the last of the ongoing Cypress suite expansion — Chunks A (basket & clash), B (mirror wrong-guess & multi-round), and C (settings & lifecycle) already shipped.

## Problem

Three loosely-related gaps were flagged at the start of this suite-expansion effort, each with a real feasibility question that needed research before committing to a design (this section records what that research found):

1. **Admin-left handling** — originally flagged as "unclear whether well-defined correct behavior exists yet." Research found this is wrong: `GameContext.tsx`'s `leaveGame()` has clear, simple, already-implemented behavior — if the leaving user is the admin, the game is immediately marked `status: 'finished'` with `adminLeft: true`, and `ResultsPhase.tsx` has a dedicated (but currently un-instrumented) branch that renders an "admin left" message instead of the normal finished view. This is genuinely testable and worth testing.

2. **Locale switching** — originally flagged as lower-value due to a translation-completeness concern. That concern still stands: an E2E test that reads one string after switching locale does not protect against a translation key being missing from one locale file but not the other — a static script comparing `en.json`/`uk.json` keys would catch that far more directly. That's a good idea for separate, cheap future work, but out of scope here; this chunk still writes the E2E test as originally scoped (proving the toggle itself works and persists), since that's a different, real thing worth proving on its own.

3. **Animations/auto-scroll** — originally flagged as low signal-to-effort because the pulse CSS class (`active-section-pulse`, in `useScrollIntoViewOnChange.ts`) only exists for a 900ms window, making a direct-assertion test inherently timing-fragile. The mechanism's other effect — calling `scrollIntoView()` — has no such timing window and can be verified with a stub, which is the standard, non-fragile way to test scroll behavior in Cypress. This chunk tests that instead of the transient CSS class.

## Behavior

### Prerequisite: two `data-cy` attributes

- `apps/web/src/components/game/mirror/ResultsPhase.tsx`: add `data-cy="admin-left"` to the admin-left branch's container (the `<div>` at the top of the `if (game.adminLeft)` block, currently un-instrumented — the normal finished view already has `data-cy="game-finished"` from Chunk C).
- `apps/web/src/components/ui/LanguageSelector.tsx`: add `data-cy="language-button"` and `data-cy-lang={lang}` to the mapped language buttons (the same shared-attribute-plus-discriminator pattern already used for `game-type-button`/`data-cy-type`, `guess-author-button`/`data-cy-author-id`, etc.).
- `apps/web/src/components/game/GameHeader.tsx`: add `data-cy="leave-game-button"` to the existing leave-game button (currently un-instrumented).

### `admin-left.cy.ts`

1. `test1` creates a game, `test2` joins — status `waiting`.
2. `test1` clicks the leave-game button and confirms via the existing alert-confirm pattern (`alert-button`/`data-cy-style`, already used throughout the suite).
3. As `test2` (still subscribed via the game's real-time Firestore listener — no reload needed), assert the game transitions to `finished` and the new `admin-left` branch renders (not the normal `game-finished` view from Chunk C).

### `locale-switching.cy.ts`

1. Sign in. Assert a known Ukrainian string is visible by default (the app's default locale, per `index.html`'s `lang="uk"` and `LanguageContext.tsx`'s default state).
2. Click the English language button (`language-button`/`data-cy-lang=en`). Assert the same UI element now shows its English equivalent.
3. Reload the page. Assert English persisted — `LanguageContext.tsx` saves the selected locale (confirmed by reading the code, which restores it on load), so this proves the persistence path works too, not just the in-session toggle.

### `auto-scroll.cy.ts`

1. Before triggering any phase transition, stub `window.HTMLElement.prototype.scrollIntoView` (via `cy.window().then(win => cy.stub(win.HTMLElement.prototype, 'scrollIntoView').as('scrollIntoView'))`).
2. Drive the smallest possible phase transition that exercises `useScrollIntoViewOnChange` — `waiting` → `active` (game creation, one participant joining, admin starting the game) — rather than a full round, since the hook's trigger-key mechanism is phase- and mode-agnostic by construction (confirmed by reading the hook: it only cares that its `triggerKey` string changed, not what triggered the change).
3. Assert the stub was called at least once during that transition (`cy.get('@scrollIntoView').should('have.been.called')`).

## Out of Scope

- A static locale-key-completeness check (comparing `en.json`/`uk.json` keys) — a good, cheap idea for separate future work, not part of this E2E-testing chunk.
- Testing the pulse CSS class's actual visual appearance/color — the `scrollIntoView` stub is the test's real claim; the pulse itself is decorative and out of scope per the feasibility research above.
- Non-admin participants leaving mid-game (already implicitly covered — `leaveGame()`'s non-admin branch just filters the participant out, no special handling to verify beyond what basic Firestore writes already prove elsewhere in this suite).
- Admin leaving during basket/clash modes specifically, or mid-round rather than during `waiting` — the `adminLeft` mechanism itself is mode- and phase-agnostic by construction (it's a flat `leaveGame()` check against `adminId`, not gated on game type or status), so `waiting`-phase mirror mode is sufficient to prove it works.
