# Cypress E2E Tests for apps/web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A first pass of Cypress end-to-end tests for `apps/web`: smoke tests (sign-in, create game, join game) plus one full mirror-mode round, run against the live deployment at https://in-the-mirror.vercel.app against the real production Firebase project (`spygame-2fce3`).

**Architecture:** Every participant's actions go through the real app UI as a real signed-in user (`cy.session()` switches between three dedicated test accounts within a spec). A small, permanent, always-present hook on `window` (`__cypressSignInWithEmail`) lets Cypress trigger `signInWithEmailAndPassword` against the app's own Firebase Auth instance, since the production UI only offers Google sign-in. The only server-side/admin-privileged code is a single Cypress task, run once after the full test run via the `after:run` Cypress plugin event, that deletes test-created games from production Firestore using a service account.

**Tech Stack:** Cypress (E2E), `firebase-admin` (Node-side cleanup task only), the app's existing `firebase/auth` SDK (browser-side sign-in), TypeScript.

## Global Constraints

- Scope is `apps/web` only. Do not touch `apps/expo` — Cypress has no equivalent there.
- The three test accounts already exist in the real Firebase project (manual setup already done): `test1@example.com` (used as admin), `test2@example.com`, `test3@example.com`, all password `12345678`.
- The service account key is already downloaded, at `/Users/macbook/Downloads/spygame-2fce3-firebase-adminsdk-vht42-12ac6ee000.json` on this machine. It is a real credential — it must never be committed, and the plan's `.gitignore` entries must actually exclude every file that could contain it or reference its real path with real values.
- No Firebase Emulator Suite — tests run against the real deployed app and real production Firebase project. No `connectAuthEmulator`/`connectFirestoreEmulator` calls anywhere.
- `data-cy` attributes are the only selector strategy for interactive elements Cypress touches — never select by CSS class or text content (the default locale is Ukrainian, and Tailwind classes are not selector-stable).
- The `window.__cypressSignInWithEmail` hook must be unconditional (not gated behind an env flag) since these tests run against the real production build with no separate "test mode" build — but it must be additive only: it must not change any existing behavior for real users, and it must not expose anything beyond what `signInWithEmailAndPassword(auth, email, password)` already does (no admin bypass, no privileged capability).
- `apps/web/cypress/` must be excluded from the main app's `tsconfig.json` (`include: ["src"]` already achieves this — do not change that `include` value) so the existing, tracked `tsc --noEmit -p apps/web/tsconfig.json` baseline (3 pre-existing errors: `PostCommentPointsPanel.tsx:69`, `GameContext.tsx:433`, `packages/shared/src/i18n.ts:2`) is unaffected by anything added in this plan.
- Only the round's target may award comment points (`awardCommentPoints`) or submit guesses (`submitGuess`) — both throw for anyone else. The full-round test must determine at runtime which seeded participant became the target (round-1 target selection excludes only the admin, and with two non-admin participants either could be picked even with `Math.random` stubbed, depending on which order they appear in `game.participants`) rather than assuming a fixed account is always the target.

---

## Task 1: Cypress project setup

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/cypress.config.ts`
- Create: `apps/web/cypress/tsconfig.json`
- Create: `apps/web/cypress/support/e2e.ts`
- Create: `apps/web/cypress.env.json` (real, local, gitignored — not a template)
- Create: `apps/web/cypress.env.json.example` (committed template)
- Modify: `.gitignore` (repo root)

**Interfaces:**
- Produces: a working `cypress.config.ts` with `baseUrl: 'https://in-the-mirror.vercel.app'` and an empty `setupNodeEvents` that later tasks extend. Produces `Cypress.env('testAccounts')` and `Cypress.env('firebaseServiceAccountPath')`, consumed by Task 2's custom command and Task 4's cleanup task.

- [ ] **Step 1: Add devDependencies and npm scripts**

In `apps/web/package.json`, add to `devDependencies` (alongside the existing entries, keep alphabetical order consistent with the existing list):

```json
    "cypress": "^13.17.0",
    "firebase-admin": "^13.0.2",
```

Add to `scripts`:

```json
    "cypress:open": "cypress open",
    "cypress:run": "cypress run"
```

- [ ] **Step 2: Install**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npm install
```

- [ ] **Step 3: `.gitignore` entries**

Append to the repo-root `.gitignore` (create the file if any of these lines aren't already covered by an existing broader pattern — check first with `grep -n "cypress" .gitignore`):

```
# Cypress (apps/web) — local secrets and machine-specific run artifacts
apps/web/cypress.env.json
apps/web/cypress/videos/
apps/web/cypress/screenshots/
apps/web/cypress/downloads/
```

- [ ] **Step 4: `apps/web/cypress.env.json.example` (committed template)**

```json
{
  "testAccounts": {
    "test1": { "email": "test1@example.com", "password": "REPLACE_ME" },
    "test2": { "email": "test2@example.com", "password": "REPLACE_ME" },
    "test3": { "email": "test3@example.com", "password": "REPLACE_ME" }
  },
  "firebaseServiceAccountPath": "/absolute/path/to/your-service-account-key.json"
}
```

- [ ] **Step 5: `apps/web/cypress.env.json` (real, local file — gitignored, not a template)**

```json
{
  "testAccounts": {
    "test1": { "email": "test1@example.com", "password": "12345678" },
    "test2": { "email": "test2@example.com", "password": "12345678" },
    "test3": { "email": "test3@example.com", "password": "12345678" }
  },
  "firebaseServiceAccountPath": "/Users/macbook/Downloads/spygame-2fce3-firebase-adminsdk-vht42-12ac6ee000.json"
}
```

- [ ] **Step 6: `apps/web/cypress.config.ts`**

```typescript
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'https://in-the-mirror.vercel.app',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    setupNodeEvents(_on, _config) {
      // Tasks registered here by later tasks in this plan (Task 4's cleanup task).
    },
  },
});
```

- [ ] **Step 7: `apps/web/cypress/support/e2e.ts`**

```typescript
// Cypress support file — imported before every spec.
// Custom commands are registered in ./commands.ts (added in Task 2).
```

- [ ] **Step 8: `apps/web/cypress/tsconfig.json`**

Scoped to the `cypress/` directory only — deliberately separate from `apps/web/tsconfig.json` (which has `include: ["src"]` and must stay untouched):

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "types": ["cypress", "node"],
    "moduleResolution": "Bundler",
    "module": "ESNext",
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["**/*.ts"]
}
```

- [ ] **Step 9: Verify**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx tsc --noEmit -p apps/web/tsconfig.json
```

Confirm the output is still exactly the 3 pre-existing baseline errors, nothing about `cypress/` — this proves the `cypress/` directory is correctly excluded from the main app's typecheck.

```bash
cd apps/web
npx cypress verify
```

Confirm this prints a success message (Cypress binary installed and runnable). Do not run `cypress run`/`cypress open` yet — there are no spec files until Task 5.

- [ ] **Step 10: Commit**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
git add apps/web/package.json package-lock.json apps/web/cypress.config.ts apps/web/cypress/tsconfig.json apps/web/cypress/support/e2e.ts apps/web/cypress.env.json.example .gitignore
git commit -m "$(cat <<'EOF'
Add Cypress project scaffolding for apps/web E2E tests

baseUrl points at the live Vercel deployment; setupNodeEvents is a
stub extended by a later task's cleanup task. cypress.env.json (real
test-account credentials and the local service-account key path) is
gitignored and created locally, not committed — only its .example
template is.
EOF
)"
```

(Do not `git add apps/web/cypress.env.json` — it must stay untracked, per the `.gitignore` entry added in Step 3. Verify with `git status` that it shows as ignored, not staged, before committing.)

---

## Task 2: Test-only sign-in hook + custom Cypress command

**Files:**
- Modify: `apps/web/src/contexts/AuthContext.tsx`
- Create: `apps/web/cypress/support/commands.ts`
- Modify: `apps/web/cypress/support/e2e.ts`

**Interfaces:**
- Produces: `window.__cypressSignInWithEmail(email, password): Promise<void>` (browser-side, always present). Produces the Cypress custom command `cy.signInAsTestUser(role: 'test1' | 'test2' | 'test3'): Chainable<void>`, consumed by Tasks 5 and 6's spec files.
- Consumes: `Cypress.env('testAccounts')` (Task 1).

- [ ] **Step 1: Expose the sign-in hook in `AuthContext.tsx`**

The imports at the top of the file currently read:

```typescript
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, GoogleAuthProviderInstance } from '@mirror/shared';
import { onAuthStateChanged, signInWithPopup, signOut as firebaseSignOut, User } from 'firebase/auth';
```

Change to:

```typescript
import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, GoogleAuthProviderInstance } from '@mirror/shared';
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut as firebaseSignOut, User } from 'firebase/auth';

// Exposes email/password sign-in on `window` for Cypress E2E tests. The
// production UI only offers Google sign-in (Cypress can't drive a real
// Google OAuth popup reliably), so this is the hook tests use instead.
// This adds no capability beyond what signInWithEmailAndPassword already
// does — no bypass, no elevated access — it's just not surfaced in the UI.
declare global {
  interface Window {
    __cypressSignInWithEmail?: (email: string, password: string) => Promise<void>;
  }
}

if (typeof window !== 'undefined') {
  window.__cypressSignInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };
}
```

Place this new block immediately after the existing imports, before the `AuthContextType` interface declaration. Do not modify anything else in the file — `AuthProvider`, `signIn`, `signOut`, and the context itself are unchanged.

- [ ] **Step 2: Custom Cypress command**

Create `apps/web/cypress/support/commands.ts`:

```typescript
export type TestUserRole = 'test1' | 'test2' | 'test3';

declare global {
  namespace Cypress {
    interface Chainable {
      signInAsTestUser(role: TestUserRole): Chainable<void>;
    }
  }
}

Cypress.Commands.add('signInAsTestUser', (role: TestUserRole) => {
  const account = Cypress.env('testAccounts')[role];
  if (!account) {
    throw new Error(`No test account configured for role "${role}" in cypress.env.json`);
  }

  cy.session(
    role,
    () => {
      cy.visit('/');
      cy.window().should('have.property', '__cypressSignInWithEmail');
      cy.window().then((win) => {
        return win.__cypressSignInWithEmail!(account.email, account.password);
      });
      // Wait until the sign-in button is gone — proof onAuthStateChanged
      // fired and the app moved past the sign-in screen — before
      // cy.session snapshots storage.
      cy.get('[data-cy=google-signin-button]').should('not.exist');
    },
    {
      validate: () => {
        cy.visit('/');
        cy.get('[data-cy=google-signin-button]').should('not.exist');
      },
      cacheAcrossSpecs: false,
    },
  );

  cy.visit('/');
});
```

- [ ] **Step 3: Wire the command into the support file**

`apps/web/cypress/support/e2e.ts` currently reads:

```typescript
// Cypress support file — imported before every spec.
// Custom commands are registered in ./commands.ts (added in Task 2).
```

Change to:

```typescript
// Cypress support file — imported before every spec.
import './commands';
```

- [ ] **Step 4: Verify**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx tsc --noEmit -p apps/web/tsconfig.json
```

Confirm still exactly the 3 pre-existing baseline errors (the `AuthContext.tsx` change must not introduce a new one — pay particular attention to the `declare global { interface Window { ... } }` block compiling cleanly alongside the rest of the file).

Manually verify the hook works against the real deployment:

```bash
cd apps/web
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npm run build
```

Confirm the build succeeds (this doesn't deploy anything — Vercel deployment is out of scope for this plan; this step only confirms the new code is production-buildable). Then, separately, open https://in-the-mirror.vercel.app in a real browser, open the devtools console, and run:

```js
await window.__cypressSignInWithEmail('test1@example.com', '12345678')
```

Confirm the page transitions from the Google sign-in screen to the join-game screen — this is the real proof the hook works end-to-end against production, since the build step alone doesn't verify runtime behavior. Sign out afterward via the app's own sign-out button so you don't leave a stray manual session logged in.

- [ ] **Step 5: Commit**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
git add apps/web/src/contexts/AuthContext.tsx apps/web/cypress/support/commands.ts apps/web/cypress/support/e2e.ts
git commit -m "$(cat <<'EOF'
Add test-only email/password sign-in hook and cy.signInAsTestUser

window.__cypressSignInWithEmail wraps signInWithEmailAndPassword
against the app's own Firebase Auth instance — the production UI
only offers Google sign-in, which Cypress can't drive reliably.
Adds no capability beyond what signInWithEmailAndPassword already
provides. cy.signInAsTestUser(role) wraps it in cy.session() so
switching back to an already-used account within a spec restores
instantly instead of re-authenticating.
EOF
)"
```

---

## Task 3: `data-cy` attributes

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/auth/AuthScreen.tsx`
- Modify: `apps/web/src/components/game/JoinScreen.tsx`
- Modify: `apps/web/src/components/game/mirror/WaitingPhase.tsx`
- Modify: `apps/web/src/components/game/mirror/ActivePhase.tsx`
- Modify: `apps/web/src/components/game/mirror/GuessingPhase.tsx`
- Modify: `apps/web/src/components/game/Leaderboard.tsx`
- Modify: `apps/web/src/components/ui/FancyAlert.tsx`
- Modify: `apps/web/src/pages/ResultsPage.tsx`

**Interfaces:**
- Produces: the exact `data-cy` values listed below, consumed by Tasks 5 and 6's spec files. No other task changes these files further — treat this list as the complete, final selector contract.

- [ ] **Step 1: `App.tsx` — Results nav link**

```tsx
      {hasResults && (
        <NavLink to="/results" className={linkClass}>Results</NavLink>
      )}
```

Change to:

```tsx
      {hasResults && (
        <NavLink to="/results" className={linkClass} data-cy="nav-results">Results</NavLink>
      )}
```

- [ ] **Step 2: `AuthScreen.tsx` — sign-in button**

```tsx
          <button type="button"
            onClick={handleSignIn}
            className="w-full bg-game-blue text-white px-6 py-4 rounded-lg font-semibold hover:opacity-90 transition-opacity mb-8 text-lg"
          >
            {t('auth.signInGoogle') || 'Sign in with Google'}
          </button>
```

Change to:

```tsx
          <button type="button"
            onClick={handleSignIn}
            data-cy="google-signin-button"
            className="w-full bg-game-blue text-white px-6 py-4 rounded-lg font-semibold hover:opacity-90 transition-opacity mb-8 text-lg"
          >
            {t('auth.signInGoogle') || 'Sign in with Google'}
          </button>
```

This is what `cy.signInAsTestUser` (Task 2) checks the absence of to confirm sign-in succeeded — its presence/absence is a locale-independent proxy for "signed in or not," unlike matching on the button's own text.

- [ ] **Step 3: `JoinScreen.tsx` — game-ID input and submit button**

```tsx
              <input
                type="text"
                value={gameInput}
                onChange={e => setGameInput(e.target.value)}
                placeholder={t('game.gameIdPlaceholder')}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-game-blue bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-game-blue text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {t('game.join')}
              </button>
```

Change to:

```tsx
              <input
                type="text"
                value={gameInput}
                onChange={e => setGameInput(e.target.value)}
                placeholder={t('game.gameIdPlaceholder')}
                data-cy="game-input"
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-game-blue bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={isLoading}
                data-cy="game-input-submit"
                className="w-full bg-game-blue text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {t('game.join')}
              </button>
```

- [ ] **Step 4: `WaitingPhase.tsx` — participant rows and start-game button**

```tsx
            {game.participants?.map((p, idx) => (
              <div
                key={p.userId}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                  p.userId === game.adminId
                    ? 'bg-game-orange/10 border border-game-orange/30'
                    : 'bg-gray-50 dark:bg-gray-700'
                }`}
              >
```

Change to:

```tsx
            {game.participants?.map((p, idx) => (
              <div
                key={p.userId}
                data-cy="participant-row"
                data-cy-user-id={p.userId}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                  p.userId === game.adminId
                    ? 'bg-game-orange/10 border border-game-orange/30'
                    : 'bg-gray-50 dark:bg-gray-700'
                }`}
              >
```

And:

```tsx
              <button
                type="button"
                onClick={handleStartGame}
                disabled={game.participants.length < 2 || isStarting || loading}
                className="w-full bg-game-green text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loading || isStarting ? t('common.loading') : t('game.ui.startGame')}
              </button>
```

Change to:

```tsx
              <button
                type="button"
                onClick={handleStartGame}
                disabled={game.participants.length < 2 || isStarting || loading}
                data-cy="start-game-button"
                className="w-full bg-game-green text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loading || isStarting ? t('common.loading') : t('game.ui.startGame')}
              </button>
```

- [ ] **Step 5: `ActivePhase.tsx` — comment form, show-comments, start-guessing, award-points, finish-awarding, give-points-to-target**

The comment textarea and submit button:

```tsx
                      <textarea
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        placeholder={t('game.ui.commentPlaceholder')}
                        maxLength={500}
                        rows={4}
                        disabled={isSubmittingComment}
                        className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-game-green bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none disabled:opacity-50"
                      />
                      <div className="flex justify-between items-center">
                        <span className={`text-sm ${commentText.length >= 450 ? 'text-red-500' : 'text-gray-500'}`}>
                          {commentText.length}/500
                        </span>
                        <button
                          type="submit"
                          disabled={!commentText.trim() || isSubmittingComment}
                          className="bg-game-blue text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          {isSubmittingComment ? t('common.loading') : t('game.ui.submitComment')}
                        </button>
                      </div>
```

Change to:

```tsx
                      <textarea
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        placeholder={t('game.ui.commentPlaceholder')}
                        maxLength={500}
                        rows={4}
                        disabled={isSubmittingComment}
                        data-cy="comment-input"
                        className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-game-green bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none disabled:opacity-50"
                      />
                      <div className="flex justify-between items-center">
                        <span className={`text-sm ${commentText.length >= 450 ? 'text-red-500' : 'text-gray-500'}`}>
                          {commentText.length}/500
                        </span>
                        <button
                          type="submit"
                          disabled={!commentText.trim() || isSubmittingComment}
                          data-cy="submit-comment-button"
                          className="bg-game-blue text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          {isSubmittingComment ? t('common.loading') : t('game.ui.submitComment')}
                        </button>
                      </div>
```

The admin's show-comments and start-guessing buttons:

```tsx
                {!commentsVisible && (
                  <button
                    type="button"
                    onClick={handleShowComments}
                    disabled={loading || (currentRound.comments?.length ?? 0) === 0}
                    className="bg-game-orange text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {loading ? t('common.loading') : t('game.ui.showComments')}
                  </button>
                )}
                {commentsVisible && (
                  <button
                    type="button"
                    onClick={handleStartGuessing}
                    disabled={loading || !targetFinishedPoints || !allPlayersCompletedPointsPhase}
                    className="bg-game-purple text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {loading ? t('common.loading') : t('game.ui.startGuessingPhase')}
                  </button>
                )}
```

Change to:

```tsx
                {!commentsVisible && (
                  <button
                    type="button"
                    onClick={handleShowComments}
                    disabled={loading || (currentRound.comments?.length ?? 0) === 0}
                    data-cy="show-comments-button"
                    className="bg-game-orange text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {loading ? t('common.loading') : t('game.ui.showComments')}
                  </button>
                )}
                {commentsVisible && (
                  <button
                    type="button"
                    onClick={handleStartGuessing}
                    disabled={loading || !targetFinishedPoints || !allPlayersCompletedPointsPhase}
                    data-cy="start-guessing-button"
                    className="bg-game-purple text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {loading ? t('common.loading') : t('game.ui.startGuessingPhase')}
                  </button>
                )}
```

The target's award-comment-points button and finish-awarding button:

```tsx
                        {comment.points === undefined && !pointsGiven[comment.id] ? (
                          <button
                            type="button"
                            onClick={() => handleGivePoints(comment.id)}
                            disabled={!!givingPoints[comment.id] || loading}
                            className="bg-game-green text-white px-4 py-1 rounded-full text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                          >
                            {givingPoints[comment.id] ? t('common.loading') : '+ 1 point'}
                          </button>
```

Change to:

```tsx
                        {comment.points === undefined && !pointsGiven[comment.id] ? (
                          <button
                            type="button"
                            onClick={() => handleGivePoints(comment.id)}
                            disabled={!!givingPoints[comment.id] || loading}
                            data-cy="award-comment-points-button"
                            className="bg-game-green text-white px-4 py-1 rounded-full text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                          >
                            {givingPoints[comment.id] ? t('common.loading') : '+ 1 point'}
                          </button>
```

And:

```tsx
                    <button
                      type="button"
                      onClick={handleFinishGivingPoints}
                      disabled={loading}
                      className="bg-game-purple text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {loading ? t('common.loading') : t('game.ui.finishAwardingPoints')}
                    </button>
```

Change to:

```tsx
                    <button
                      type="button"
                      onClick={handleFinishGivingPoints}
                      disabled={loading}
                      data-cy="finish-awarding-points-button"
                      className="bg-game-purple text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {loading ? t('common.loading') : t('game.ui.finishAwardingPoints')}
                    </button>
```

The give-points-to-target buttons:

```tsx
                        {Array.from({ length: maxPoints + 1 }, (_, i) => i).map(points => (
                          <button
                            key={points}
                            type="button"
                            onClick={() => handleGivePointsToTarget(points)}
                            disabled={givingPointsToTarget || loading}
                            className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-600 border-2 border-gray-300 dark:border-gray-500 text-lg font-semibold hover:border-game-gold hover:bg-game-gold/10 disabled:opacity-50 transition-all"
                          >
                            {points}
                          </button>
                        ))}
```

Change to:

```tsx
                        {Array.from({ length: maxPoints + 1 }, (_, i) => i).map(points => (
                          <button
                            key={points}
                            type="button"
                            onClick={() => handleGivePointsToTarget(points)}
                            disabled={givingPointsToTarget || loading}
                            data-cy="give-points-to-target-button"
                            data-cy-points={points}
                            className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-600 border-2 border-gray-300 dark:border-gray-500 text-lg font-semibold hover:border-game-gold hover:bg-game-gold/10 disabled:opacity-50 transition-all"
                          >
                            {points}
                          </button>
                        ))}
```

- [ ] **Step 6: `GuessingPhase.tsx` — author-selection buttons, submit-guesses, finalize**

The author-selection buttons (target picks who wrote each comment):

```tsx
                      {possibleAuthors.map(author => (
                        <button
                          key={author.userId}
                          type="button"
                          onClick={() => handleSelect(comment.id, author.userId)}
                          className={`px-3 py-1.5 rounded-full border-2 font-semibold text-sm transition-all ${
                            selections[comment.id] === author.userId
                              ? 'bg-game-blue border-game-blue text-white'
                              : 'bg-white dark:bg-gray-600 border-gray-300 dark:border-gray-500 text-gray-900 dark:text-white hover:border-game-blue'
                          }`}
                        >
                          {getPlayerNumber(game, author.userId)}. {author.userName}
                        </button>
                      ))}
```

Change to:

```tsx
                      {possibleAuthors.map(author => (
                        <button
                          key={author.userId}
                          type="button"
                          onClick={() => handleSelect(comment.id, author.userId)}
                          data-cy="guess-author-button"
                          data-cy-author-id={author.userId}
                          className={`px-3 py-1.5 rounded-full border-2 font-semibold text-sm transition-all ${
                            selections[comment.id] === author.userId
                              ? 'bg-game-blue border-game-blue text-white'
                              : 'bg-white dark:bg-gray-600 border-gray-300 dark:border-gray-500 text-gray-900 dark:text-white hover:border-game-blue'
                          }`}
                        >
                          {getPlayerNumber(game, author.userId)}. {author.userName}
                        </button>
                      ))}
```

The submit-guesses button:

```tsx
                <button
                  type="button"
                  onClick={handleSubmitGuesses}
                  disabled={isSubmitting || loading || !allCommentsSelected}
                  className="w-full bg-game-purple text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isSubmitting ? t('common.loading') : t('game.ui.submitGuesses')}
                </button>
```

Change to:

```tsx
                <button
                  type="button"
                  onClick={handleSubmitGuesses}
                  disabled={isSubmitting || loading || !allCommentsSelected}
                  data-cy="submit-guesses-button"
                  className="w-full bg-game-purple text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isSubmitting ? t('common.loading') : t('game.ui.submitGuesses')}
                </button>
```

The admin's three finalize-variant buttons (only one renders at a time depending on state, so the same `data-cy` value on all three is fine — a test only ever sees one):

```tsx
              {singleTargetId && targetSubmitted ? (
                <button
                  type="button"
                  onClick={handleFinalizeAndNextRound}
                  disabled={isFinalizing || loading}
                  className="bg-game-green text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isFinalizing ? t('common.loading') : t('game.ui.nextRound')}
                </button>
              ) : guessingDataResolved.allPlayersSubmitted ? (
                <button
                  type="button"
                  onClick={handleFinalizeOnly}
                  disabled={isFinalizing || loading}
                  className="bg-game-green text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isFinalizing ? t('common.loading') : t('game.ui.finalize')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleForceFinalize}
                  disabled={isFinalizing || loading}
                  className="bg-game-neutral text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isFinalizing ? t('common.loading') : t('game.ui.finalize')}
                </button>
```

Change to (add `data-cy="finalize-button"` to all three buttons, nothing else changes):

```tsx
              {singleTargetId && targetSubmitted ? (
                <button
                  type="button"
                  onClick={handleFinalizeAndNextRound}
                  disabled={isFinalizing || loading}
                  data-cy="finalize-button"
                  className="bg-game-green text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isFinalizing ? t('common.loading') : t('game.ui.nextRound')}
                </button>
              ) : guessingDataResolved.allPlayersSubmitted ? (
                <button
                  type="button"
                  onClick={handleFinalizeOnly}
                  disabled={isFinalizing || loading}
                  data-cy="finalize-button"
                  className="bg-game-green text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isFinalizing ? t('common.loading') : t('game.ui.finalize')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleForceFinalize}
                  disabled={isFinalizing || loading}
                  data-cy="finalize-button"
                  className="bg-game-neutral text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isFinalizing ? t('common.loading') : t('game.ui.finalize')}
                </button>
```

- [ ] **Step 7: `Leaderboard.tsx` — rows and total-points**

```tsx
            <div
              key={p.userId}
              className={`flex items-center gap-3 p-3 rounded-lg ${
```

Change to:

```tsx
            <div
              key={p.userId}
              data-cy="leaderboard-row"
              data-cy-user-id={p.userId}
              className={`flex items-center gap-3 p-3 rounded-lg ${
```

And:

```tsx
              <div className="text-right flex-shrink-0">
                <p className="text-xl font-bold text-game-green">{p.totalPoints}</p>
                <p className="text-xs text-gray-400">{t('game.ui.pointsTotal')}</p>
              </div>
```

Change to:

```tsx
              <div className="text-right flex-shrink-0">
                <p className="text-xl font-bold text-game-green" data-cy="leaderboard-total-points">{p.totalPoints}</p>
                <p className="text-xs text-gray-400">{t('game.ui.pointsTotal')}</p>
              </div>
```

- [ ] **Step 8: `FancyAlert.tsx` — confirmation buttons**

```tsx
          {buttons.map((button, idx) => (
            <button type="button"
              key={idx}
              onClick={() => {
                button.onPress();
                onDismiss?.();
              }}
              className={`py-3 px-4 rounded-lg font-semibold transition-opacity ${
```

Change to:

```tsx
          {buttons.map((button, idx) => (
            <button type="button"
              key={idx}
              onClick={() => {
                button.onPress();
                onDismiss?.();
              }}
              data-cy="alert-button"
              data-cy-style={button.style ?? 'primary'}
              className={`py-3 px-4 rounded-lg font-semibold transition-opacity ${
```

- [ ] **Step 9: `ResultsPage.tsx` — leaderboard rows and total-points**

```tsx
          {participantsWithScores.map((p, idx) => (
            <div
              key={p.userId}
              className={`flex items-center gap-3 px-4 py-3 ${
                idx === 0 ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                p.userId === user?.uid ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
            >
```

Change to:

```tsx
          {participantsWithScores.map((p, idx) => (
            <div
              key={p.userId}
              data-cy="results-leaderboard-row"
              data-cy-user-id={p.userId}
              className={`flex items-center gap-3 px-4 py-3 ${
                idx === 0 ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                p.userId === user?.uid ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
            >
```

And:

```tsx
              <span className="text-lg font-bold text-game-green">{p.totalPoints}</span>
```

Change to:

```tsx
              <span className="text-lg font-bold text-game-green" data-cy="results-leaderboard-total-points">{p.totalPoints}</span>
```

- [ ] **Step 10: Verify**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx tsc --noEmit -p apps/web/tsconfig.json
```

Confirm still exactly the 3 pre-existing baseline errors — `data-cy`/`data-cy-*` are valid arbitrary DOM attributes on native HTML elements (`div`, `button`, `input`, `textarea`, `span`, and `NavLink`, which forwards unknown props to its underlying `<a>`), so this should not introduce any new type error.

- [ ] **Step 11: Commit**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
git add apps/web/src/App.tsx apps/web/src/components/auth/AuthScreen.tsx apps/web/src/components/game/JoinScreen.tsx apps/web/src/components/game/mirror/WaitingPhase.tsx apps/web/src/components/game/mirror/ActivePhase.tsx apps/web/src/components/game/mirror/GuessingPhase.tsx apps/web/src/components/game/Leaderboard.tsx apps/web/src/components/ui/FancyAlert.tsx apps/web/src/pages/ResultsPage.tsx
git commit -m "$(cat <<'EOF'
Add data-cy selectors for Cypress E2E tests

The codebase has no existing test hooks and the default locale
(Ukrainian) makes text-based selectors fragile, so data-cy is the
selector strategy throughout. Purely additive — no behavior change
on any of these 8 files.
EOF
)"
```

---

## Task 4: Cleanup task

**Files:**
- Modify: `apps/web/cypress.config.ts`
- Create: `apps/web/cypress/tasks/cleanupTestGames.ts`

**Interfaces:**
- Consumes: `Cypress.env('firebaseServiceAccountPath')`, `Cypress.env('testAccounts').test1.email` (Task 1).
- Produces: nothing consumed by other tasks — this runs automatically after the full Cypress run finishes, via the `after:run` plugin event, not via an explicit `cy.task()` call from any spec file.

- [ ] **Step 1: `apps/web/cypress/tasks/cleanupTestGames.ts`**

```typescript
import admin from 'firebase-admin';

let cachedApp: admin.app.App | null = null;

function getAdminApp(serviceAccountPath: string): admin.app.App {
  if (cachedApp) return cachedApp;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const serviceAccount = require(serviceAccountPath);
  cachedApp = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  return cachedApp;
}

/**
 * Deletes every `games` document whose adminId matches the test1 admin
 * account's uid, so production Firestore doesn't accumulate test games
 * run over run. Looks up test1's uid via Firebase Auth (by email) rather
 * than hardcoding it, since a uid isn't known until the account exists.
 */
export async function cleanupTestGames(
  serviceAccountPath: string,
  adminEmail: string,
): Promise<{ deleted: number }> {
  const app = getAdminApp(serviceAccountPath);
  const auth = admin.auth(app);
  const db = admin.firestore(app);

  const adminUser = await auth.getUserByEmail(adminEmail);
  const snapshot = await db
    .collection('games')
    .where('adminId', '==', adminUser.uid)
    .get();

  const batchDeletes = snapshot.docs.map((doc) => doc.ref.delete());
  await Promise.all(batchDeletes);

  return { deleted: snapshot.size };
}
```

- [ ] **Step 2: Register the `after:run` hook in `cypress.config.ts`**

The current file reads:

```typescript
import { defineConfig } from 'cypress';

export default defineConfig({
  e2e: {
    baseUrl: 'https://in-the-mirror.vercel.app',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    setupNodeEvents(_on, _config) {
      // Tasks registered here by later tasks in this plan (Task 4's cleanup task).
    },
  },
});
```

Change to:

```typescript
import { defineConfig } from 'cypress';
import { cleanupTestGames } from './cypress/tasks/cleanupTestGames';

export default defineConfig({
  e2e: {
    baseUrl: 'https://in-the-mirror.vercel.app',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    setupNodeEvents(on, config) {
      on('after:run', async () => {
        const serviceAccountPath = config.env.firebaseServiceAccountPath as string;
        const adminEmail = (config.env.testAccounts as { test1: { email: string } }).test1.email;
        const result = await cleanupTestGames(serviceAccountPath, adminEmail);
        // eslint-disable-next-line no-console
        console.log(`[cleanupTestGames] Deleted ${result.deleted} test game(s).`);
      });
    },
  },
});
```

- [ ] **Step 3: Verify**

There are still no spec files, so a full `cypress run` isn't meaningful yet — instead, verify the cleanup logic directly with a small one-off Node script (delete it after running; it's not part of the deliverable):

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror/apps/web
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
cat > /tmp/verify-cleanup.mjs << 'NODEEOF'
import { cleanupTestGames } from './cypress/tasks/cleanupTestGames.ts';
const path = JSON.parse(await import('node:fs').then(fs => fs.promises.readFile('./cypress.env.json', 'utf8'))).firebaseServiceAccountPath;
const email = JSON.parse(await import('node:fs').then(fs => fs.promises.readFile('./cypress.env.json', 'utf8'))).testAccounts.test1.email;
const result = await cleanupTestGames(path, email);
console.log(result);
NODEEOF
npx tsx /tmp/verify-cleanup.mjs
rm /tmp/verify-cleanup.mjs
```

Confirm this prints `{ deleted: 0 }` (or a small number if any stray test games already exist from manual testing during Task 2's Step 4) with no thrown error — this proves the service account credential and Firestore access work correctly end-to-end before any spec depends on it.

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx tsc --noEmit -p apps/web/tsconfig.json
```

Confirm still exactly the 3 pre-existing baseline errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
git add apps/web/cypress.config.ts apps/web/cypress/tasks/cleanupTestGames.ts
git commit -m "$(cat <<'EOF'
Add post-run cleanup of test-created games via firebase-admin

Runs once via the after:run Cypress plugin event, after every spec
in the run has finished — not per-test — so production Firestore
doesn't accumulate test games run over run. Looks up the test1
admin account's uid by email rather than hardcoding it.
EOF
)"
```

---

## Task 5: Smoke tests

**Files:**
- Create: `apps/web/cypress/e2e/smoke.cy.ts`

**Interfaces:**
- Consumes: `cy.signInAsTestUser` (Task 2), the `data-cy` selectors from Task 3, `Cypress.env('testAccounts')` (Task 1).

- [ ] **Step 1: `apps/web/cypress/e2e/smoke.cy.ts`**

```typescript
describe('Smoke tests', () => {
  it('signing in with a test account reaches the join-game screen', () => {
    cy.signInAsTestUser('test1');
    cy.get('[data-cy=game-input]').should('be.visible');
    cy.get('[data-cy=game-input-submit]').should('be.visible');
  });

  it('creating a game with the admin password reaches the waiting room', () => {
    cy.signInAsTestUser('test1');
    cy.get('[data-cy=game-input]').type('YR20RZ67FKy88HQVF6yW');
    cy.get('[data-cy=game-input-submit]').click();
    cy.get('[data-cy=start-game-button]').should('be.visible');
  });

  it('a second test account can join the game the first created', () => {
    cy.signInAsTestUser('test1');
    cy.get('[data-cy=game-input]').type('YR20RZ67FKy88HQVF6yW');
    cy.get('[data-cy=game-input-submit]').click();

    // The game ID is shown as the page's own <h1>-adjacent button text in
    // WaitingPhase (`{game.id} 🔗`) — read it from the URL instead, which
    // HomePage.tsx navigates to as soon as currentGame.id is set, and is a
    // stable place to read the ID from regardless of that button's markup.
    cy.url().should('match', /\/game\/[^/]+$/);
    cy.url().then((url) => {
      const gameId = url.split('/game/')[1];

      cy.signInAsTestUser('test2');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=participant-row]').should('have.length', 2);
    });
  });
});
```

- [ ] **Step 2: Run it**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror/apps/web
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx cypress run --spec cypress/e2e/smoke.cy.ts
```

Expected: all 3 tests pass. If the `after:run` cleanup task errors here, investigate before proceeding — every later run depends on it working (Task 4's Step 3 verification should have already caught a credential/path problem, but this is the first time it runs through the real Cypress lifecycle rather than the standalone script).

- [ ] **Step 3: Commit**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
git add apps/web/cypress/e2e/smoke.cy.ts
git commit -m "$(cat <<'EOF'
Add Cypress smoke tests: sign-in, create game, join game
EOF
)"
```

---

## Task 6: Full mirror-mode round test

**Files:**
- Create: `apps/web/cypress/e2e/mirror-round.cy.ts`

**Interfaces:**
- Consumes: everything Task 5 consumes, plus: only the round's target may award comment points or submit guesses (Global Constraints) — this spec determines the target at runtime from `[data-cy=participant-row]` versus who the comment-writing UI accepts, rather than assuming a fixed account.

- [ ] **Step 1: `apps/web/cypress/e2e/mirror-round.cy.ts`**

```typescript
describe('Full mirror-mode round', () => {
  it('plays one round end-to-end and shows correct results after it ends', () => {
    // ── Set up: admin creates the game, both players join ──────────────
    cy.signInAsTestUser('test1');
    cy.get('[data-cy=game-input]').type('YR20RZ67FKy88HQVF6yW');
    cy.get('[data-cy=game-input-submit]').click();
    cy.url().should('match', /\/game\/[^/]+$/);

    cy.url().then((url) => {
      const gameId = url.split('/game/')[1];

      cy.signInAsTestUser('test2');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();

      cy.signInAsTestUser('test3');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();

      // ── Admin starts the game; force a deterministic target ──────────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.window().then((win) => {
        // selectRandomParticipant picks index Math.floor(Math.random() * n)
        // from the non-admin participants — stub to always pick index 0.
        cy.stub(win.Math, 'random').returns(0);
      });
      cy.get('[data-cy=participant-row]').should('have.length', 3);
      cy.get('[data-cy=start-game-button]').click();

      // ── Determine who became the target ───────────────────────────────
      // The target sees "write a comment about yourself" is not offered to
      // them; the non-target participant sees the comment form. Sign in as
      // test2 first and check which UI renders to find out.
      cy.signInAsTestUser('test2');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('body').then(($body) => {
        const test2IsCommenter = $body.find('[data-cy=comment-input]').length > 0;
        const commenterRole: 'test2' | 'test3' = test2IsCommenter ? 'test2' : 'test3';
        const targetRole: 'test2' | 'test3' = test2IsCommenter ? 'test3' : 'test2';

        // ── Non-target writes a comment ─────────────────────────────────
        cy.signInAsTestUser(commenterRole);
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=comment-input]').type('You always bring great energy to the group.');
        cy.get('[data-cy=submit-comment-button]').click();

        // ── Admin reveals comments ──────────────────────────────────────
        cy.signInAsTestUser('test1');
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=show-comments-button]').click();

        // ── Target awards the comment a point, then finishes ────────────
        cy.signInAsTestUser(targetRole);
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=award-comment-points-button]').click();
        cy.get('[data-cy=finish-awarding-points-button]').click();

        // ── Non-target awards points to the target, confirms in the alert ─
        cy.signInAsTestUser(commenterRole);
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=give-points-to-target-button][data-cy-points=1]').click();
        cy.get('[data-cy=alert-button][data-cy-style=primary]').click();

        // ── Freeze-until-round-end check: inline leaderboard still 0 ────
        cy.get('[data-cy=leaderboard-row]').each(($row) => {
          cy.wrap($row).find('[data-cy=leaderboard-total-points]').should('have.text', '0');
        });

        // ── Admin starts guessing phase ─────────────────────────────────
        cy.signInAsTestUser('test1');
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=start-guessing-button]').click();

        // ── Target guesses the (known, deterministic) real author ──────
        // adminWritesComments is off (never toggled in this test) and only
        // the commenter wrote a comment, so possibleAuthors for the
        // target's guessing view has exactly one entry — the commenter.
        // No need to resolve any uid: assert there's exactly one button
        // and click it directly.
        cy.signInAsTestUser(targetRole);
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=guess-author-button]').should('have.length', 1).click();
        cy.get('[data-cy=submit-guesses-button]').click();

        // ── Admin finalizes the round ───────────────────────────────────
        cy.signInAsTestUser('test1');
        cy.get('[data-cy=game-input]').type(gameId);
        cy.get('[data-cy=game-input-submit]').click();
        cy.get('[data-cy=finalize-button]').click();

        // ── Results tab shows round 1's real totals ─────────────────────
        cy.get('[data-cy=nav-results]').click();
        cy.get('[data-cy=results-leaderboard-row]').should('have.length', 3);
        // The commenter earned 1 comment point; the target earned 1 point
        // from the commenter plus 1 guess point for the correct guess.
        // ResultsPage.tsx computes totalPoints as gamePoints + guessPoints
        // per participant — assert at least one row is now above 0,
        // proving round 1's results made it through.
        cy.get('[data-cy=results-leaderboard-total-points]').then(($points) => {
          const values = $points.toArray().map((el) => Number(el.textContent));
          expect(values.some((v) => v > 0)).to.eq(true);
        });
      });
    });
  });
});
```

- [ ] **Step 2: Run it**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror/apps/web
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx cypress run --spec cypress/e2e/mirror-round.cy.ts
```

Expected: the test passes. This is a long, multi-actor scenario — if it fails, use `npx cypress open` (interactive mode) instead of `run` to step through it visually and see exactly which `data-cy` selector or game-state assumption didn't hold, rather than debugging blind from headless output alone.

Then run the full suite together to confirm nothing interferes cross-spec (in particular, that `cy.session()` correctly isolates each test's login state and the earlier smoke tests' leftover games don't confuse this test's own game-ID lookup, which they shouldn't since each test creates and addresses its own game by its own returned ID):

```bash
npx cypress run
```

Expected: all 4 tests across both spec files pass, and the terminal output includes the `[cleanupTestGames] Deleted N test game(s).` line from the `after:run` hook confirming production Firestore was cleaned up.

- [ ] **Step 3: Commit**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
git add apps/web/cypress/e2e/mirror-round.cy.ts
git commit -m "$(cat <<'EOF'
Add Cypress test for a full mirror-mode round

Drives all three participants (admin + two players) through the
real UI via cy.session() account-switching: comment submission,
comment-point award, target-point award, guessing, and finalization.
Also checks the "freeze leaderboard until round end" feature stays
at 0 mid-round and the Results tab shows correct totals once the
round actually ends.
EOF
)"
```
