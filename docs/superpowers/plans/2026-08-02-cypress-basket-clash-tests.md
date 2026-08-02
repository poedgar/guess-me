# Cypress Tests: Basket & Clash Full Rounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Cypress E2E coverage for basket mode and clash mode — currently zero coverage and zero `data-cy` selectors in either mode's components — by adding the needed `data-cy` attributes and writing one full-round test per mode.

**Architecture:** One prerequisite task adds `data-cy` attributes to the basket/clash components and the mirror-mode game-type selector (the only shared component that needs a new selector). Two independent follow-up tasks each write one Cypress spec file, `basket-round.cy.ts` and `clash-round.cy.ts`, following the existing `mirror-round.cy.ts` pattern exactly (`cy.signInAsTestUser`, the `SETTLE_MS` network-settle delay, the `Math.random` stub technique where needed, real production Firebase cleaned up by the existing `cleanupTestGames` hooks).

**Tech Stack:** Cypress (already configured in `apps/web`), TypeScript, React 19, no new dependencies.

## Global Constraints

- Only 3 Cypress test accounts exist (`test1`/`test2`/`test3`, per `apps/web/cypress.env.json`, gitignored). Both new tests use exactly these three — `test1` always administers and never writes a comment or submits a guess in either mode.
- `generateClashSchedule` (`packages/shared/src/utils/clashSchedule.ts:14-16`) throws if the two groups are unequal length — clash teams must always be assigned as equal-size groups.
- With only 3 accounts and `adminWritesComments` off (the default, used by both tests): basket's `writers` array excludes the admin (`GameContext.tsx:1655-1657`), leaving 2 writers → `generateBasketSchedule` produces exactly 1 round. Clash's teams are 1-vs-1 → `generateClashSchedule` also produces exactly 1 round. Both tests therefore play their entire game through to `status: 'finished'`, not a single round out of several — there is no "round 2" in either test.
- Follow the existing `data-cy` naming convention: kebab-case, describing the element's role, not its styling (e.g. `basket-reveal-comments-button`, not `orange-button`). Prefix every new basket selector with `basket-` and every new clash selector with `clash-`, since components across modes are structurally similar (writing phase, guessing phase, reveal button) and unprefixed names would collide or be ambiguous.
- Do not touch `apps/expo` — this plan is `apps/web`-only, matching the existing Cypress suite's scope.
- Every new `data-cy` addition is a plain JSX attribute — no behavioral change to any component. Verify with `npx tsc --noEmit -p apps/web/tsconfig.json` after each task; the only acceptable errors are the 3 pre-existing baseline errors already present on `main` (`PostCommentPointsPanel.tsx:69`, one in `GameContext.tsx`, `packages/shared/src/i18n.ts:2`).
- Both spec files run against real production Firebase (`https://in-the-mirror.vercel.app`), like `mirror-round.cy.ts`. `apps/web/cypress.env.json` must already exist locally with `test1`/`test2`/`test3` credentials for either test to run — this plan does not create or modify that file.

---

## Task 1: `data-cy` attributes for basket, clash, and the game-type selector

**Files:**
- Modify: `apps/web/src/components/game/mirror/WaitingPhase.tsx`
- Modify: `apps/web/src/components/game/basket/BasketWritingPhase.tsx`
- Modify: `apps/web/src/components/game/basket/BasketGuessingPhase.tsx`
- Modify: `apps/web/src/components/game/clash/ClashSetupPanel.tsx`
- Modify: `apps/web/src/components/game/clash/ClashWritingPhase.tsx`
- Modify: `apps/web/src/components/game/clash/ClashGuessingPhase.tsx`

**Interfaces:**
- Produces (consumed by Tasks 2 and 3): the exact `data-cy` / `data-cy-*` values listed in each step below. Tasks 2 and 3 must use these values verbatim — do not invent new ones.

- [ ] **Step 1: Add `data-cy="game-type-button"` to the game-type selector**

In `apps/web/src/components/game/mirror/WaitingPhase.tsx`, find the game-type selector (inside the `{isAdmin && ( ... )}` block that maps over `['mirror', 'basket', 'clash']`):

```tsx
              {(['mirror', 'basket', 'clash'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setGameType(type).catch(() => {})}
                  className={`flex-1 py-2 rounded-full text-xs font-semibold border-2 transition-all ${
                    (game.gameType ?? 'mirror') === type
                      ? 'bg-game-blue border-game-blue text-white'
                      : 'border-game-blue text-game-blue hover:bg-game-blue/10'
                  }`}
                >
                  {t(`game.ui.gameType${type.charAt(0).toUpperCase() + type.slice(1)}`)}
                </button>
              ))}
```

Replace with (adds `data-cy` and `data-cy-type`):

```tsx
              {(['mirror', 'basket', 'clash'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  data-cy="game-type-button"
                  data-cy-type={type}
                  onClick={() => setGameType(type).catch(() => {})}
                  className={`flex-1 py-2 rounded-full text-xs font-semibold border-2 transition-all ${
                    (game.gameType ?? 'mirror') === type
                      ? 'bg-game-blue border-game-blue text-white'
                      : 'border-game-blue text-game-blue hover:bg-game-blue/10'
                  }`}
                >
                  {t(`game.ui.gameType${type.charAt(0).toUpperCase() + type.slice(1)}`)}
                </button>
              ))}
```

(Note: `start-game-button` already exists on this file's start button and already fires `startBasketGame()` when `game.gameType === 'basket'` — no change needed there. Clash never renders that button, per the existing `(game.gameType ?? 'mirror') !== 'clash'` condition just above it.)

- [ ] **Step 2: `data-cy` for `BasketWritingPhase.tsx`**

In `apps/web/src/components/game/basket/BasketWritingPhase.tsx`, the comment textarea:

```tsx
              <textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder={t('game.ui.basket.writeComment')}
                maxLength={500}
                rows={4}
                disabled={isSubmitting}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-game-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none disabled:opacity-50"
              />
```

Replace with:

```tsx
              <textarea
                data-cy="basket-comment-input"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder={t('game.ui.basket.writeComment')}
                maxLength={500}
                rows={4}
                disabled={isSubmitting}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-game-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none disabled:opacity-50"
              />
```

The submit button:

```tsx
                <button
                  type="submit"
                  disabled={!commentText.trim() || isSubmitting}
                  className="bg-game-blue text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isSubmitting ? t('common.loading') : t('game.ui.basket.submit')}
                </button>
```

Replace with:

```tsx
                <button
                  type="submit"
                  data-cy="basket-submit-comment-button"
                  disabled={!commentText.trim() || isSubmitting}
                  className="bg-game-blue text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isSubmitting ? t('common.loading') : t('game.ui.basket.submit')}
                </button>
```

The admin reveal button:

```tsx
            <button
              type="button"
              onClick={handleReveal}
              disabled={isRevealing || loading || submittedCount < totalCount}
              className="bg-game-orange text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isRevealing ? t('common.loading') : t('game.ui.basket.revealComments')}
            </button>
```

Replace with:

```tsx
            <button
              type="button"
              data-cy="basket-reveal-comments-button"
              onClick={handleReveal}
              disabled={isRevealing || loading || submittedCount < totalCount}
              className="bg-game-orange text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isRevealing ? t('common.loading') : t('game.ui.basket.revealComments')}
            </button>
```

- [ ] **Step 3: `data-cy` for `BasketGuessingPhase.tsx`**

The which-comment-is-mine buttons (inside `currentRoundComments.map`):

```tsx
              {currentRoundComments.map((comment: any) => (
                <button
                  key={comment.writerId}
                  type="button"
                  onClick={() => handleCommentSelect(comment.writerId)}
                  disabled={selectedWriterId !== null || isSubmittingGuess || loading}
                  className={`w-full text-left bg-white dark:bg-gray-800 border-2 rounded-lg px-4 py-3 text-gray-900 dark:text-white hover:border-game-blue disabled:opacity-50 transition-colors ${
                    selectedWriterId === comment.writerId
                      ? 'border-game-blue'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {comment.text}
                </button>
              ))}
```

Replace with:

```tsx
              {currentRoundComments.map((comment: any) => (
                <button
                  key={comment.writerId}
                  type="button"
                  data-cy="basket-guess-comment-button"
                  data-cy-writer-id={comment.writerId}
                  onClick={() => handleCommentSelect(comment.writerId)}
                  disabled={selectedWriterId !== null || isSubmittingGuess || loading}
                  className={`w-full text-left bg-white dark:bg-gray-800 border-2 rounded-lg px-4 py-3 text-gray-900 dark:text-white hover:border-game-blue disabled:opacity-50 transition-colors ${
                    selectedWriterId === comment.writerId
                      ? 'border-game-blue'
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {comment.text}
                </button>
              ))}
```

The who-wrote-it buttons (inside `otherPlayers.map`):

```tsx
              {otherPlayers.map(p => (
                <button
                  key={p.userId}
                  type="button"
                  onClick={() => handleAuthorSelect(p.userId, p.userName)}
                  disabled={isSubmittingAuthor || loading}
                  className="w-full text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 font-medium text-gray-900 dark:text-white hover:border-game-purple disabled:opacity-50 transition-colors"
                >
                  {p.userName}
                </button>
              ))}
```

Replace with:

```tsx
              {otherPlayers.map(p => (
                <button
                  key={p.userId}
                  type="button"
                  data-cy="basket-guess-author-button"
                  data-cy-user-id={p.userId}
                  onClick={() => handleAuthorSelect(p.userId, p.userName)}
                  disabled={isSubmittingAuthor || loading}
                  className="w-full text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 font-medium text-gray-900 dark:text-white hover:border-game-purple disabled:opacity-50 transition-colors"
                >
                  {p.userName}
                </button>
              ))}
```

The admin next-round button:

```tsx
            <button
              type="button"
              onClick={handleNextRound}
              disabled={isAdvancing || loading || !allGuessersDone}
              className={`px-6 py-3 rounded-full text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity ${
                isLastRound ? 'bg-game-green' : 'bg-game-blue'
              }`}
            >
              {isAdvancing ? t('common.loading') : t('game.ui.basket.nextRound')}
            </button>
```

Replace with:

```tsx
            <button
              type="button"
              data-cy="basket-next-round-button"
              onClick={handleNextRound}
              disabled={isAdvancing || loading || !allGuessersDone}
              className={`px-6 py-3 rounded-full text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity ${
                isLastRound ? 'bg-game-green' : 'bg-game-blue'
              }`}
            >
              {isAdvancing ? t('common.loading') : t('game.ui.basket.nextRound')}
            </button>
```

- [ ] **Step 4: `data-cy` for `ClashSetupPanel.tsx`**

The group-assignment buttons (inside `renderPoolCard`):

```tsx
        <div className="flex gap-1">
          <button type="button" onClick={() => assignToGroup(participant.userId, 'a')}
            className="px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors">A</button>
          <button type="button" onClick={() => assignToGroup(participant.userId, 'b')}
            className="px-2 py-1 rounded text-xs font-bold bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors">B</button>
        </div>
```

Replace with:

```tsx
        <div className="flex gap-1">
          <button type="button" data-cy="clash-assign-button" data-cy-group="a" data-cy-user-id={participant.userId} onClick={() => assignToGroup(participant.userId, 'a')}
            className="px-2 py-1 rounded text-xs font-bold bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors">A</button>
          <button type="button" data-cy="clash-assign-button" data-cy-group="b" data-cy-user-id={participant.userId} onClick={() => assignToGroup(participant.userId, 'b')}
            className="px-2 py-1 rounded text-xs font-bold bg-purple-100 text-purple-700 hover:bg-purple-200 transition-colors">B</button>
        </div>
```

The start button:

```tsx
            <button
              type="button"
              onClick={handleStart}
              disabled={!canStart || isStarting || loading}
              className="bg-game-green text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {isStarting ? t('common.loading') : t('game.ui.clash.startGame')}
            </button>
```

Replace with:

```tsx
            <button
              type="button"
              data-cy="clash-start-game-button"
              onClick={handleStart}
              disabled={!canStart || isStarting || loading}
              className="bg-game-green text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {isStarting ? t('common.loading') : t('game.ui.clash.startGame')}
            </button>
```

- [ ] **Step 5: `data-cy` for `ClashWritingPhase.tsx`**

The comment textarea:

```tsx
              <textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder={t('game.ui.clash.writeComment')}
                maxLength={500}
                rows={4}
                disabled={isSubmitting}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-game-orange bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none disabled:opacity-50"
              />
```

Replace with:

```tsx
              <textarea
                data-cy="clash-comment-input"
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder={t('game.ui.clash.writeComment')}
                maxLength={500}
                rows={4}
                disabled={isSubmitting}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-game-orange bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none disabled:opacity-50"
              />
```

The submit button:

```tsx
                <button type="submit" disabled={!commentText.trim() || isSubmitting}
                  className="bg-game-blue text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {isSubmitting ? t('common.loading') : t('game.ui.clash.submit')}
                </button>
```

Replace with:

```tsx
                <button type="submit" data-cy="clash-submit-comment-button" disabled={!commentText.trim() || isSubmitting}
                  className="bg-game-blue text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
                  {isSubmitting ? t('common.loading') : t('game.ui.clash.submit')}
                </button>
```

The admin reveal button:

```tsx
            <button type="button" onClick={handleReveal}
              disabled={isRevealing || loading || !allSubmitted}
              className="bg-game-orange text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
              {isRevealing ? t('common.loading') : t('game.ui.clash.revealComments')}
            </button>
```

Replace with:

```tsx
            <button type="button" data-cy="clash-reveal-comments-button" onClick={handleReveal}
              disabled={isRevealing || loading || !allSubmitted}
              className="bg-game-orange text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
              {isRevealing ? t('common.loading') : t('game.ui.clash.revealComments')}
            </button>
```

- [ ] **Step 6: `data-cy` for `ClashGuessingPhase.tsx`**

The comment card button (inside `commentsToGuess.map`):

```tsx
                    <button
                      type="button"
                      onClick={() => handleCardPress(comment.writerId)}
                      disabled={phase !== 'idle' || isSubmitting || loading}
                      className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
```

Replace with:

```tsx
                    <button
                      type="button"
                      data-cy="clash-guess-comment-button"
                      data-cy-writer-id={comment.writerId}
                      onClick={() => handleCardPress(comment.writerId)}
                      disabled={phase !== 'idle' || isSubmitting || loading}
                      className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
```

The subject-picking buttons (inside `ownGroupIds.map`):

```tsx
                          return (
                            <button key={memberId} type="button"
                              onClick={() => handleSubjectSelect(comment.writerId, memberId, name)}
                              disabled={isSubmitting}
                              className="w-full text-left px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-900 dark:text-white hover:border-game-blue disabled:opacity-50 transition-colors">
                              {name}
                            </button>
                          );
```

Replace with:

```tsx
                          return (
                            <button key={memberId} type="button"
                              data-cy="clash-guess-subject-button"
                              data-cy-user-id={memberId}
                              onClick={() => handleSubjectSelect(comment.writerId, memberId, name)}
                              disabled={isSubmitting}
                              className="w-full text-left px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-900 dark:text-white hover:border-game-blue disabled:opacity-50 transition-colors">
                              {name}
                            </button>
                          );
```

The author-picking buttons (inside `oppositeGroupIds.map`):

```tsx
                          return (
                            <button key={authorId} type="button"
                              onClick={() => handleAuthorSelect(comment.writerId, authorId, name)}
                              disabled={isSubmitting}
                              className="w-full text-left px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-900 dark:text-white hover:border-game-green disabled:opacity-50 transition-colors">
                              {name}
                            </button>
                          );
```

Replace with:

```tsx
                          return (
                            <button key={authorId} type="button"
                              data-cy="clash-guess-author-button"
                              data-cy-user-id={authorId}
                              onClick={() => handleAuthorSelect(comment.writerId, authorId, name)}
                              disabled={isSubmitting}
                              className="w-full text-left px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-900 dark:text-white hover:border-game-green disabled:opacity-50 transition-colors">
                              {name}
                            </button>
                          );
```

The admin advance button:

```tsx
            <button type="button" onClick={handleAdvance}
              disabled={isAdvancing || loading || !currentGroupDone}
              className={`px-6 py-3 rounded-full text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity ${
                otherGroupDone && isLastRound ? 'bg-game-green' : 'bg-game-blue'
              }`}>
              {isAdvancing ? t('common.loading') : advanceLabel}
            </button>
```

Replace with:

```tsx
            <button type="button" data-cy="clash-advance-button" onClick={handleAdvance}
              disabled={isAdvancing || loading || !currentGroupDone}
              className={`px-6 py-3 rounded-full text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity ${
                otherGroupDone && isLastRound ? 'bg-game-green' : 'bg-game-blue'
              }`}>
              {isAdvancing ? t('common.loading') : advanceLabel}
            </button>
```

- [ ] **Step 7: Verify with `tsc`**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx tsc --noEmit -p apps/web/tsconfig.json
```

Expected: exactly the same 3 pre-existing baseline errors as before this task (`PostCommentPointsPanel.tsx:69`, one in `GameContext.tsx`, `packages/shared/src/i18n.ts:2`) — nothing new. Since every change in this task is a plain JSX attribute addition, any new error means a typo (e.g. a stray comma or unbalanced brace) — fix it before continuing.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/components/game/mirror/WaitingPhase.tsx \
        apps/web/src/components/game/basket/BasketWritingPhase.tsx \
        apps/web/src/components/game/basket/BasketGuessingPhase.tsx \
        apps/web/src/components/game/clash/ClashSetupPanel.tsx \
        apps/web/src/components/game/clash/ClashWritingPhase.tsx \
        apps/web/src/components/game/clash/ClashGuessingPhase.tsx
git commit -m "$(cat <<'EOF'
Add data-cy attributes to basket, clash, and the game-type selector

Prerequisite for basket-round.cy.ts and clash-round.cy.ts (added in
follow-up commits) — neither mode had any data-cy coverage before this.
No behavioral change.
EOF
)"
```

---

## Task 2: `basket-round.cy.ts`

**Files:**
- Create: `apps/web/cypress/e2e/basket-round.cy.ts`

**Interfaces:**
- Consumes: the `data-cy` values from Task 1 (`game-type-button`/`data-cy-type`, `basket-comment-input`, `basket-submit-comment-button`, `basket-reveal-comments-button`, `basket-guess-comment-button`/`data-cy-writer-id`, `basket-guess-author-button`/`data-cy-user-id`, `basket-next-round-button`), plus the already-existing `game-input`, `game-input-submit`, `participant-row`, `start-game-button`, `alert-button`/`data-cy-style`, `leaderboard-row`/`data-cy-user-id`, `leaderboard-total-points` selectors and the global `cy.signInAsTestUser` command (all used unchanged from `mirror-round.cy.ts`).

- [ ] **Step 1: Write the spec**

```typescript
describe('Full basket-mode round', () => {
  it('plays the only round end-to-end and reaches finished with correct scores', () => {
    // See mirror-round.cy.ts for why this delay exists: Firestore's client
    // SDK resolves writes against the local optimistic cache immediately,
    // well before the write reaches the server, and a same-page account
    // switch can cancel an in-flight write. This gives each write time to
    // land before cy.signInAsTestUser's hard cy.visit('/') for the next
    // account.
    const SETTLE_MS = 1500;

    // ── Set up: admin creates the game, switches it to basket, both players join ──
    cy.signInAsTestUser('test1');
    cy.get('[data-cy=game-input]').type('YR20RZ67FKy88HQVF6yW3');
    cy.get('[data-cy=game-input-submit]').click();
    cy.url().should('match', /\/game\/[^/]+$/);
    cy.get('[data-cy=game-type-button][data-cy-type=basket]').click();

    cy.url().then((url) => {
      const gameId = decodeURIComponent(url.split('/game/')[1]);

      cy.signInAsTestUser('test2');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=participant-row]').should('have.length', 2);
      cy.wait(SETTLE_MS);

      cy.signInAsTestUser('test3');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=participant-row]').should('have.length', 3);
      cy.wait(SETTLE_MS);

      // ── Admin starts the game (adminWritesComments stays off, the default —
      // this excludes the admin from `writers`, leaving exactly 2 writers and
      // a single-round schedule; see this plan's Global Constraints). No
      // Math.random stub is needed here (unlike mirror-round.cy.ts): with
      // exactly 2 writers, generateBasketSchedule's Fisher-Yates shuffle can
      // only ever produce the 2 writers in one order or the other, and its
      // rotation (subjectId = ids[(i+r+1)%n], n=2) makes each writer the
      // other's subject either way — the shuffle's outcome cannot change who
      // writes about whom when there are only 2 people to rotate. ───────────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=participant-row]').should('have.length', 3);
      cy.get('[data-cy=start-game-button]').click();
      cy.get('[data-cy=start-game-button]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── Both writers submit their comment ───────────────────────────────────
      cy.signInAsTestUser('test2');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=basket-comment-input]').type('You have a great sense of humor.');
      cy.get('[data-cy=basket-submit-comment-button]').click();
      cy.get('[data-cy=basket-comment-input]').should('not.exist');
      cy.wait(SETTLE_MS);

      cy.signInAsTestUser('test3');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=basket-comment-input]').type('You are always so encouraging.');
      cy.get('[data-cy=basket-submit-comment-button]').click();
      cy.get('[data-cy=basket-comment-input]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── Admin reveals comments — this is the exact path the reveal-comments
      // bug fix (comparing against the round's writers, not every
      // participant) unblocked. Before that fix this button never became
      // clickable under default settings. ─────────────────────────────────────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=basket-reveal-comments-button]').should('not.be.disabled');
      cy.get('[data-cy=basket-reveal-comments-button]').click();
      cy.get('[data-cy=basket-reveal-comments-button]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── test2 guesses: sees test3's comment (the only comment about test2),
      // correctly identifies it as about them, then correctly names test3 as
      // the author (only one other writer exists) ────────────────────────────
      cy.signInAsTestUser('test2');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=basket-guess-comment-button]').should('have.length', 2);
      cy.get('[data-cy=basket-guess-comment-button]').contains('encouraging').click();
      cy.get('[data-cy=alert-button][data-cy-style=primary]').click();
      cy.get('[data-cy=basket-guess-author-button]').should('have.length', 1);
      cy.get('[data-cy=basket-guess-author-button]').click();
      cy.get('[data-cy=alert-button][data-cy-style=primary]').click();
      cy.get('[data-cy=basket-guess-author-button]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── test3 guesses: the comment actually about test3 is test2's "great
      // sense of humor" one, but this deliberately clicks the OTHER comment
      // ("encouraging", written by test3 about test2) to exercise the
      // incorrect-guess path, matching mirror-round.cy.ts's approach of
      // covering both outcomes. ────────────────────────────────────────────────
      cy.signInAsTestUser('test3');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=basket-guess-comment-button]').should('have.length', 2);
      cy.get('[data-cy=basket-guess-comment-button]').contains('encouraging').click();
      cy.get('[data-cy=alert-button][data-cy-style=primary]').click();
      // Wrong guess: no author-guess step follows; the card shows "wrong" and
      // basket-guess-author-button never appears for test3 this round.
      cy.get('[data-cy=basket-guess-author-button]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── Admin advances — this is the schedule's only round (2 writers →
      // n-1=1 round), so this flips status straight to 'finished' ────────────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=basket-next-round-button]').should('not.be.disabled');
      cy.get('[data-cy=basket-next-round-button]').click();
      cy.wait(SETTLE_MS);

      // ── Finished: test2 earned 2 points (correct comment guess + correct
      // author guess), test3 earned 0 (wrong comment guess), test1 (admin,
      // never wrote or guessed) earned 0. ─────────────────────────────────────
      cy.get('[data-cy=leaderboard-row]').should('have.length', 3);
      // Assert by point-value multiset (as mirror-round.cy.ts does), not by
      // correlating rows to specific participants: exactly one row has 2
      // points (test2), the other two have 0 (test3, test1).
      cy.get('[data-cy=leaderboard-total-points]').should(($points) => {
        const values = $points.toArray().map((el) => Number(el.textContent)).sort((a, b) => b - a);
        expect(values).to.deep.equal([2, 0, 0]);
      });
    });
  });
});
```

- [ ] **Step 2: Run the spec locally**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror/apps/web
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
unset ELECTRON_RUN_AS_NODE
npx cypress run --browser chrome --spec cypress/e2e/basket-round.cy.ts
```

Expected: 1 passing test. If the `Math.random` stub doesn't produce the assumed writer order (test2 writes about test3, test3 writes about test2), the test will fail at the `basket-comment-input` step with a mismatched subject name shown on screen — open the Cypress runner (`npx cypress open`, same spec) to inspect the actual subject card text and adjust the comment text/order assertions to match reality; do not guess blindly, verify against what the UI actually renders.

- [ ] **Step 3: Commit**

```bash
git add apps/web/cypress/e2e/basket-round.cy.ts
git commit -m "$(cat <<'EOF'
Add Cypress test for a full basket-mode round

Covers writing, the reveal-comments step (the exact path the
reveal-comments bug fix unblocked), both correct and incorrect
comment-guess outcomes, and the finished-state leaderboard. With only
3 test accounts and adminWritesComments off, the schedule has exactly
1 round, so this test plays the entire game rather than a single round
out of several.
EOF
)"
```

---

## Task 3: `clash-round.cy.ts`

**Files:**
- Create: `apps/web/cypress/e2e/clash-round.cy.ts`

**Interfaces:**
- Consumes: the `data-cy` values from Task 1 (`game-type-button`/`data-cy-type`, `clash-assign-button`/`data-cy-group`/`data-cy-user-id`, `clash-start-game-button`, `clash-comment-input`, `clash-submit-comment-button`, `clash-reveal-comments-button`, `clash-guess-comment-button`/`data-cy-writer-id`, `clash-guess-subject-button`/`data-cy-user-id`, `clash-guess-author-button`/`data-cy-user-id`, `clash-advance-button`), plus the already-existing `game-input`, `game-input-submit`, `participant-row`, `alert-button`/`data-cy-style`, `leaderboard-row`/`data-cy-user-id`, `leaderboard-total-points` selectors and the global `cy.signInAsTestUser` command.

- [ ] **Step 1: Write the spec**

```typescript
describe('Full clash-mode round', () => {
  it('plays the only round end-to-end (1v1 teams) and reaches finished with correct scores', () => {
    const SETTLE_MS = 1500;

    // ── Set up: admin creates the game, switches it to clash, both players join ──
    cy.signInAsTestUser('test1');
    cy.get('[data-cy=game-input]').type('YR20RZ67FKy88HQVF6yW3');
    cy.get('[data-cy=game-input-submit]').click();
    cy.url().should('match', /\/game\/[^/]+$/);
    cy.get('[data-cy=game-type-button][data-cy-type=clash]').click();

    cy.url().then((url) => {
      const gameId = decodeURIComponent(url.split('/game/')[1]);

      cy.signInAsTestUser('test2');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=participant-row]').should('have.length', 2);
      cy.wait(SETTLE_MS);

      cy.signInAsTestUser('test3');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=participant-row]').should('have.length', 3);
      cy.wait(SETTLE_MS);

      // ── Admin assigns groups: test2 → Team A (auto-leader, sole member),
      // test3 → Team B (auto-leader, sole member). test1 (admin) is never
      // eligible while adminWritesComments is off, so it never appears in
      // ClashSetupPanel's pool at all — no assignment action needed for it.
      // generateClashSchedule requires equal group sizes, so 1v1 is the only
      // split possible with 3 accounts. ────────────────────────────────────────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get(`[data-cy=clash-assign-button][data-cy-group=a][data-cy-user-id]`).first().click();
      cy.wait(500);
      cy.get(`[data-cy=clash-assign-button][data-cy-group=b][data-cy-user-id]`).first().click();
      cy.get('[data-cy=clash-start-game-button]').should('not.be.disabled');
      cy.wait(SETTLE_MS);
      cy.get('[data-cy=clash-start-game-button]').click();
      cy.get('[data-cy=clash-start-game-button]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── With groupA=[test2], groupB=[test3], generateClashSchedule's single
      // round (n=1) assigns: test2 (Team A) writes about test3 (Team B);
      // test3 (Team B) writes about test2 (Team A). Submission order is
      // controlled below (test2 first, test3 second) so lastGroupToFinish
      // ends up 'b', making Team B's leader (test3) act first in guessing. ──

      cy.signInAsTestUser('test2');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=clash-comment-input]').type('You always ask great questions.');
      cy.get('[data-cy=clash-submit-comment-button]').click();
      cy.get('[data-cy=clash-comment-input]').should('not.exist');
      cy.wait(SETTLE_MS);

      cy.signInAsTestUser('test3');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=clash-comment-input]').type('You are a great listener.');
      cy.get('[data-cy=clash-submit-comment-button]').click();
      cy.get('[data-cy=clash-comment-input]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── Admin reveals — currentGuessingGroup becomes lastGroupToFinish
      // ('b', since test3/Team B submitted last), so Team B's leader (test3)
      // acts first. ────────────────────────────────────────────────────────────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=clash-reveal-comments-button]').should('not.be.disabled');
      cy.get('[data-cy=clash-reveal-comments-button]').click();
      cy.get('[data-cy=clash-reveal-comments-button]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── test3 (Team B leader) guesses against Team A's one comment
      // (test2's "great questions" comment, about test3). Team B has only
      // one member, so both the subject guess and the author guess are
      // unambiguous — both come out correct by construction. ─────────────────
      cy.signInAsTestUser('test3');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=clash-guess-comment-button]').should('have.length', 1);
      cy.get('[data-cy=clash-guess-comment-button]').click();
      cy.get('[data-cy=clash-guess-subject-button]').should('have.length', 1);
      cy.get('[data-cy=clash-guess-subject-button]').click();
      cy.get('[data-cy=alert-button][data-cy-style=primary]').click();
      cy.get('[data-cy=clash-guess-author-button]').should('have.length', 1);
      cy.get('[data-cy=clash-guess-author-button]').click();
      cy.get('[data-cy=alert-button][data-cy-style=primary]').click();
      cy.get('[data-cy=clash-guess-author-button]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── Admin advances — Team A hasn't guessed yet, so this only switches
      // the active leader (test2 next), it does not finish the round. ────────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=clash-advance-button]').should('not.be.disabled');
      cy.get('[data-cy=clash-advance-button]').click();
      cy.wait(SETTLE_MS);

      // ── test2 (Team A leader) guesses against Team B's one comment
      // (test3's "great listener" comment, about test2) — also unambiguous. ──
      cy.signInAsTestUser('test2');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=clash-guess-comment-button]').should('have.length', 1);
      cy.get('[data-cy=clash-guess-comment-button]').click();
      cy.get('[data-cy=clash-guess-subject-button]').should('have.length', 1);
      cy.get('[data-cy=clash-guess-subject-button]').click();
      cy.get('[data-cy=alert-button][data-cy-style=primary]').click();
      cy.get('[data-cy=clash-guess-author-button]').should('have.length', 1);
      cy.get('[data-cy=clash-guess-author-button]').click();
      cy.get('[data-cy=alert-button][data-cy-style=primary]').click();
      cy.get('[data-cy=clash-guess-author-button]').should('not.exist');
      cy.wait(SETTLE_MS);

      // ── Admin advances again — Team B is already done and this is the
      // schedule's only round (groupA.length === 1 → n === 1), so this flips
      // status straight to 'finished'. ─────────────────────────────────────────
      cy.signInAsTestUser('test1');
      cy.get('[data-cy=game-input]').type(gameId);
      cy.get('[data-cy=game-input-submit]').click();
      cy.get('[data-cy=clash-advance-button]').should('not.be.disabled');
      cy.get('[data-cy=clash-advance-button]').click();
      cy.wait(SETTLE_MS);

      // ── Finished: both test2 and test3 earned 2 points each (correct
      // subject guess + correct author guess); test1 (admin, never in a
      // group) earned 0. ───────────────────────────────────────────────────────
      cy.get('[data-cy=leaderboard-row]').should('have.length', 3);
      cy.get('[data-cy=leaderboard-total-points]').should(($points) => {
        const values = $points.toArray().map((el) => Number(el.textContent)).sort((a, b) => b - a);
        expect(values).to.deep.equal([2, 2, 0]);
      });
    });
  });
});
```

- [ ] **Step 2: Run the spec locally**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror/apps/web
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
unset ELECTRON_RUN_AS_NODE
npx cypress run --browser chrome --spec cypress/e2e/clash-round.cy.ts
```

Expected: 1 passing test. If `clash-assign-button`'s `.first()` selection doesn't land on the accounts assumed (e.g. because `eligibleParticipants`' order isn't join order), open the Cypress runner (`npx cypress open`, same spec) and inspect which participant each pool card actually represents before adjusting the selectors — do not guess.

- [ ] **Step 3: Run both new specs plus the existing suite together, to confirm no interference**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror/apps/web
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
unset ELECTRON_RUN_AS_NODE
npx cypress run --browser chrome
```

Expected: all specs (`smoke.cy.ts`, `mirror-round.cy.ts`, `basket-round.cy.ts`, `clash-round.cy.ts`) pass. The `cleanupTestGames` before/after hooks (already in `cypress.config.ts`) delete every game owned by `test1` across the whole run, so basket/clash test games are cleaned up the same way mirror's are — no new cleanup logic needed.

- [ ] **Step 4: Commit**

```bash
git add apps/web/cypress/e2e/clash-round.cy.ts
git commit -m "$(cat <<'EOF'
Add Cypress test for a full clash-mode round

Covers group setup (1v1, the only split possible with 3 test
accounts, since generateClashSchedule requires equal-size groups),
writing, reveal, both leaders' guessing turns in sequence (leader
handoff via the admin advance control), dual team/individual scoring,
and the finished-state leaderboard.
EOF
)"
```
