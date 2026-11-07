# Cypress Tests: Locale, Animations & Admin-Left Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Cypress E2E coverage for the last three gaps in the mirror-mode test suite: admin-left handling, locale switching, and the auto-scroll mechanism used across every phase transition.

**Architecture:** One prerequisite task adds 3 small `data-cy` attributes across 3 files. Three independent spec files follow, each proving one thing, minimally.

**Tech Stack:** Cypress (already configured in `apps/web`), TypeScript, no new dependencies.

## Global Constraints

- Only 3 Cypress test accounts exist (`test1`/`test2`/`test3`).
- `admin-left.cy.ts` needs only `test1` (admin, leaves) and `test2` (remaining participant, observes the transition).
- `locale-switching.cy.ts` needs only `test1` — it doesn't need a second participant at all, since locale is a per-user UI preference, not shared game state.
- `auto-scroll.cy.ts` needs `test1` and `test2` (2 participants are required for `start-game-button` to be enabled — `WaitingPhase.tsx`'s button is `disabled={game.participants.length < 2 ...}`).
- `useScrollIntoViewOnChange`'s pulse CSS class (`active-section-pulse`) exists for only 900ms — do not assert on it directly (timing-fragile). Assert on `scrollIntoView` being called instead, via a `cy.stub()` on `window.HTMLElement.prototype.scrollIntoView` installed on the already-loaded page, immediately before the action whose resulting call you want to observe — a `cy.signInAsTestUser`/page-visit after installing the stub wipes it out (fresh JS context), so the stub must be the last setup step before the triggering action, not before an intervening account switch.
- Locale persists via `localStorage.setItem('app_locale', ...)` (`LanguageContext.tsx`) and is restored on load — `locale-switching.cy.ts`'s reload step is testing real persistence, not asserting something that resets by default.
- Do not touch `apps/expo` — this plan is `apps/web`-only.
- The only acceptable `tsc --noEmit -p apps/web/tsconfig.json` errors are the 3 pre-existing baseline ones (`PostCommentPointsPanel.tsx:69`, one in `GameContext.tsx`, `packages/shared/src/i18n.ts:2`).
- This spec runs against real production Firebase (`https://in-the-mirror.vercel.app`) like every other spec in this suite — `apps/web/cypress.env.json` must already exist locally with `test1`/`test2`/`test3` credentials.
- Before running any Cypress command, check for and kill stray Cypress/Chrome-headless processes (`ps aux | grep -i cypress`) — concurrent runs against the same shared test accounts have caused misleading failures in earlier chunks of this suite. Never start a second Cypress run while one is already in flight; if a background run appears to hang (no log progress for several minutes despite the process still existing), check its CPU time (`ps aux` — near-zero accumulated CPU time on an old process is a stall, not slowness) before waiting further.
- New `data-cy` selectors added to `apps/web/src` need to be live on production before a Cypress spec that uses them can find them — after pushing, poll the deployed JS bundle for the literal new string (works for plain string `data-cy="..."` attributes; does NOT work for template-literal-constructed ones like `` data-cy={`${id}-toggle`} ``, which never appear as a literal substring in built source no matter how fresh the deploy — verify those via the actual rendered DOM in a real Cypress run instead).

---

## Task 1: `data-cy` attributes for admin-left, language selector, and leave-game button

**Files:**
- Modify: `apps/web/src/components/game/mirror/ResultsPhase.tsx`
- Modify: `apps/web/src/components/ui/LanguageSelector.tsx`
- Modify: `apps/web/src/components/game/GameHeader.tsx`

**Interfaces:**
- Produces (consumed by Tasks 2-4): `data-cy="admin-left"` on `ResultsPhase.tsx`'s admin-left branch container; `data-cy="language-button"` + `data-cy-lang={lang}` on `LanguageSelector.tsx`'s buttons; `data-cy="leave-game-button"` on `GameHeader.tsx`'s leave button.

- [ ] **Step 1: `ResultsPhase.tsx` — admin-left branch**

Find:
```tsx
  if (game.adminLeft) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border-2 border-game-gold text-center space-y-2" ref={scrollRef}>
```

Replace with:
```tsx
  if (game.adminLeft) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border-2 border-game-gold text-center space-y-2" ref={scrollRef} data-cy="admin-left">
```

- [ ] **Step 2: `LanguageSelector.tsx` — language buttons**

Find:
```tsx
      {(['uk', 'en'] as SupportedLocale[]).map((lang) => (
        <button type="button"
          key={lang}
          onClick={() => setLocale(lang)}
          className={`px-3 py-2 rounded-lg font-semibold transition-all ${
            locale === lang
              ? 'bg-game-blue text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          {lang.toUpperCase()}
        </button>
      ))}
```

Replace with:
```tsx
      {(['uk', 'en'] as SupportedLocale[]).map((lang) => (
        <button type="button"
          key={lang}
          onClick={() => setLocale(lang)}
          data-cy="language-button"
          data-cy-lang={lang}
          className={`px-3 py-2 rounded-lg font-semibold transition-all ${
            locale === lang
              ? 'bg-game-blue text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          {lang.toUpperCase()}
        </button>
      ))}
```

- [ ] **Step 3: `GameHeader.tsx` — leave-game button**

Find:
```tsx
      <button type="button"
        onClick={onLeave}
        className="w-full bg-game-danger text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity"
      >
        {t('game.leaveGame') || 'Leave Game'}
      </button>
```

Replace with:
```tsx
      <button type="button"
        onClick={onLeave}
        data-cy="leave-game-button"
        className="w-full bg-game-danger text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity"
      >
        {t('game.leaveGame') || 'Leave Game'}
      </button>
```

- [ ] **Step 4: Verify with `tsc`**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx tsc --noEmit -p apps/web/tsconfig.json
```

Expected: exactly the 3 pre-existing baseline errors, nothing new.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/game/mirror/ResultsPhase.tsx apps/web/src/components/ui/LanguageSelector.tsx apps/web/src/components/game/GameHeader.tsx
git commit -m "$(cat <<'EOF'
Add data-cy attributes for admin-left, language selector, leave-game button

Prerequisite for admin-left.cy.ts, locale-switching.cy.ts, and
auto-scroll.cy.ts (added in follow-up commits) — none of these three
elements had any data-cy coverage before this. No behavioral change.
EOF
)"
```

---

## Task 2: `admin-left.cy.ts`

**Files:**
- Create: `apps/web/cypress/e2e/admin-left.cy.ts`

**Interfaces:**
- Consumes: `game-input`, `game-input-submit`, `participant-row`, `leave-game-button` (Task 1), `alert-button`/`data-cy-style`, `admin-left` (Task 1) — all reused from existing selectors plus Task 1's additions.

- [ ] **Step 1: Write the spec**

```typescript
describe('Admin leaves the game', () => {
  it('transitions the game to finished with the admin-left view for remaining participants', () => {
    const SETTLE_MS = 1500;

    // ── Set up: admin creates the game, test2 joins ────────────────────────
    cy.signInAsTestUser('test1');
    cy.get('[data-cy=game-input]').type('YR20RZ67FKy88HQVF6yW3');
    cy.get('[data-cy=game-input-submit]').click();
    cy.url().should('match', /\/game\/[^/]+$/);

    cy.url().then((url) => {
      const gameId = decodeURIComponent(url.split('/game/')[1]);

      cy.signInAsTestUser('test2');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=participant-row]').should('have.length', 2);
      cy.wait(SETTLE_MS);

      // ── Admin leaves and confirms via the existing alert-confirm pattern.
      // leaveGame()'s admin branch (GameContext.tsx) immediately marks the
      // game status: 'finished', adminLeft: true — no separate "end game"
      // step exists, this one action does both. ──────────────────────────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=leave-game-button]').click();
      cy.get('[data-cy=alert-button][data-cy-style=danger]').click();
      // leaveGame() clears currentGame locally for the admin, so GameScreen
      // switches back to JoinScreen for test1 — confirms the leave action
      // itself completed, before checking test2's side of the transition.
      cy.get('[data-cy=game-input]').should('be.visible');
      cy.wait(SETTLE_MS);

      // ── test2 is still subscribed via the game's real-time Firestore
      // listener (no reload needed) — the transition should already be
      // reflected. Assert the admin-left view renders, not the normal
      // finished view (game-finished, from Chunk C). ─────────────────────
      cy.signInAsTestUser('test2');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=admin-left]').should('exist');
      cy.get('[data-cy=game-finished]').should('not.exist');
    });
  });
});
```

- [ ] **Step 2: Run the spec locally**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror/apps/web
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
unset ELECTRON_RUN_AS_NODE
npx cypress run --browser chrome --spec cypress/e2e/admin-left.cy.ts
```

Expected: 1 passing test. If Task 1's commit hasn't been pushed/deployed yet, the first `leave-game-button` click will fail to find the element — see the Global Constraints note on deploy timing. If a step's assumption doesn't hold, open `npx cypress open` on this spec and inspect the actual DOM before changing anything — do not guess blindly.

- [ ] **Step 3: Commit**

```bash
git add apps/web/cypress/e2e/admin-left.cy.ts
git commit -m "$(cat <<'EOF'
Add Cypress test for admin-left handling

Proves leaveGame()'s admin branch (GameContext.tsx) — which
immediately marks the game finished with adminLeft: true — correctly
surfaces the dedicated "admin left" view to remaining participants via
their existing real-time listener, distinct from the normal finished
view. Previously flagged as possibly not well-defined; research during
this chunk's brainstorm found the behavior is simple and already
implemented, just untested and un-instrumented (no data-cy existed on
the admin-left branch before Task 1).
EOF
)"
```

---

## Task 3: `locale-switching.cy.ts`

**Files:**
- Create: `apps/web/cypress/e2e/locale-switching.cy.ts`

**Interfaces:**
- Consumes: `game-input`, `game-input-submit`, `language-button`/`data-cy-lang` (Task 1), `leave-game-button` (Task 1, reused here as the known-text element whose content changes with locale) — no new selectors beyond Task 1's.

- [ ] **Step 1: Write the spec**

```typescript
describe('Locale switching', () => {
  it('toggles the UI language and persists the choice across a reload', () => {
    const SETTLE_MS = 1500;

    // ── test1 creates a game — the language selector lives in GameHeader,
    // shown once inside a game (not on the pre-game JoinScreen). No second
    // participant needed — locale is a per-user UI preference, not shared
    // game state. ─────────────────────────────────────────────────────────
    cy.signInAsTestUser('test1');
    cy.get('[data-cy=game-input]').type('YR20RZ67FKy88HQVF6yW3');
    cy.get('[data-cy=game-input-submit]').click();
    cy.url().should('match', /\/game\/[^/]+$/);

    // ── Default locale is Ukrainian (index.html's lang="uk",
    // LanguageContext's default state). The leave-game button's text is a
    // simple, already-instrumented (Task 1) known string that changes with
    // locale. ─────────────────────────────────────────────────────────────
    cy.get('[data-cy=leave-game-button]').should('contain.text', 'Покинути гру');

    // ── Switch to English ────────────────────────────────────────────────
    cy.get('[data-cy=language-button][data-cy-lang=en]').click();
    cy.get('[data-cy=leave-game-button]').should('contain.text', 'Leave Game');
    cy.wait(SETTLE_MS);

    // ── Reload — locale is saved to localStorage (LanguageContext.tsx) and
    // restored on load, so this proves persistence, not just the in-session
    // toggle. ─────────────────────────────────────────────────────────────
    cy.reload();
    cy.get('[data-cy=leave-game-button]').should('contain.text', 'Leave Game');
  });
});
```

- [ ] **Step 2: Run the spec locally**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror/apps/web
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
unset ELECTRON_RUN_AS_NODE
npx cypress run --browser chrome --spec cypress/e2e/locale-switching.cy.ts
```

Expected: 1 passing test. If the initial Ukrainian-text assertion fails, double check the exact string in `packages/shared/src/locales/uk.json`'s `game.leaveGame` key hasn't changed — do not guess a replacement string, read the actual current file content first.

- [ ] **Step 3: Commit**

```bash
git add apps/web/cypress/e2e/locale-switching.cy.ts
git commit -m "$(cat <<'EOF'
Add Cypress test for locale switching

Proves the language toggle (LanguageSelector.tsx) actually changes
rendered text and that the choice persists across a reload (via
LanguageContext.tsx's localStorage round-trip). Does not protect
against a translation key missing from one locale file but not the
other — that's a translation-completeness concern better caught by a
static key-comparison script, out of scope here (see this chunk's
design spec).
EOF
)"
```

---

## Task 4: `auto-scroll.cy.ts`

**Files:**
- Create: `apps/web/cypress/e2e/auto-scroll.cy.ts`

**Interfaces:**
- Consumes: `game-input`, `game-input-submit`, `participant-row`, `start-game-button` — all pre-existing, no new selectors.

- [ ] **Step 1: Write the spec**

```typescript
describe('Auto-scroll on phase transitions', () => {
  it('calls scrollIntoView when a new phase mounts', () => {
    const SETTLE_MS = 1500;

    // ── Set up: admin creates the game, test2 joins. 2 participants are
    // required — start-game-button is disabled below that. ────────────────
    cy.signInAsTestUser('test1');
    cy.get('[data-cy=game-input]').type('YR20RZ67FKy88HQVF6yW3');
    cy.get('[data-cy=game-input-submit]').click();
    cy.url().should('match', /\/game\/[^/]+$/);

    cy.url().then((url) => {
      const gameId = decodeURIComponent(url.split('/game/')[1]);

      cy.signInAsTestUser('test2');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=participant-row]').should('have.length', 2);
      cy.wait(SETTLE_MS);

      // ── Switch back to test1 (a full page load — any stub installed
      // before this point would be wiped by the fresh JS context). Once on
      // this final page, WaitingPhase mounts and fires its own initial
      // scrollIntoView call — irrelevant, the stub goes in AFTER this. ────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=participant-row]').should('have.length', 2);
      cy.wait(SETTLE_MS);

      // ── Install the stub on the already-loaded page, immediately before
      // the action whose resulting call we want to observe. Testing the
      // scrollIntoView call itself (not the transient 900ms pulse CSS
      // class) avoids animation-timing fragility — see this chunk's design
      // spec. ──────────────────────────────────────────────────────────────
      cy.window().then((win) => {
        cy.stub(win.HTMLElement.prototype, 'scrollIntoView').as('scrollIntoView');
      });

      // ── Trigger the smallest possible phase transition: waiting → active.
      // useScrollIntoViewOnChange's trigger-key mechanism is phase- and
      // mode-agnostic by construction (it only cares that its string key
      // changed), so this one transition is representative. ───────────────
      cy.get('[data-cy=start-game-button]').click();
      cy.get('[data-cy=start-game-button]').should('not.exist');

      cy.get('@scrollIntoView').should('have.been.called');
    });
  });
});
```

- [ ] **Step 2: Run the spec locally**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror/apps/web
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
unset ELECTRON_RUN_AS_NODE
npx cypress run --browser chrome --spec cypress/e2e/auto-scroll.cy.ts
```

Expected: 1 passing test. If `@scrollIntoView` was never called, first confirm the stub was actually installed on the right window (open `npx cypress open` and check) before assuming the app itself doesn't call `scrollIntoView` on this transition — `ActivePhase.tsx` uses `useScrollIntoViewOnChange` for its target/non-target/admin sections, so a call is expected as soon as any of those sections mount.

- [ ] **Step 3: Run the full suite together, to confirm no interference**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror/apps/web
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
unset ELECTRON_RUN_AS_NODE
npx cypress run --browser chrome
```

Expected: all specs pass (`smoke.cy.ts`, `mirror-round.cy.ts`, `mirror-multi-round.cy.ts`, `basket-round.cy.ts`, `clash-round.cy.ts`, `admin-writes-comments.cy.ts`, `reload-rejoin.cy.ts`, `admin-left.cy.ts`, `locale-switching.cy.ts`, `auto-scroll.cy.ts`). The existing `cleanupTestGames` hooks cover all three new specs' games the same way they cover every other spec's.

- [ ] **Step 4: Commit**

```bash
git add apps/web/cypress/e2e/auto-scroll.cy.ts
git commit -m "$(cat <<'EOF'
Add Cypress test for the auto-scroll phase-transition mechanism

Proves useScrollIntoViewOnChange fires on a phase transition
(waiting -> active) by stubbing scrollIntoView and asserting it was
called, rather than asserting on the pulse CSS class directly (which
only exists for a 900ms window and would make the test
timing-fragile — see this chunk's design spec). One transition is
representative since the hook's trigger-key mechanism is phase- and
mode-agnostic by construction.
EOF
)"
```
