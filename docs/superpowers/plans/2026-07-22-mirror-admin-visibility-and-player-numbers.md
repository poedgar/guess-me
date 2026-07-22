# Mirror Admin Visibility & Player Numbers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the `apps/web` mirror game mode, give the admin live visibility into who has/hasn't submitted a comment during the writing phase, and give every participant a stable display number assigned once at game start, shown in that new checklist and in the guessing-phase author picker.

**Architecture:** Add an optional `playerNumbers: { [userId]: number }` map to the `Game` type (defined in both `packages/shared/src/types.ts` and the local duplicate in `apps/web/src/contexts/GameContext.tsx`), populated once in `startGame()` from the existing `buildJoinIndexById` helper in `@mirror/shared`. A small new `getPlayerNumber(game, userId)` helper in `apps/web/src/utils/playerNumbers.ts` reads that map with a fallback to array position, and is consumed by two UI spots: a new admin-only submitted/pending checklist in `ActivePhase.tsx`, and numbered author pills in `GuessingPhase.tsx`.

**Tech Stack:** React 19 + TypeScript (strict) + Vite, Firebase Firestore, i18n-js. No test runner is configured in `apps/web` or `packages/shared` (confirmed: no `*.test.*` files, no test script in either `package.json`). Verification in this plan is TypeScript compilation + manual browser walkthrough, per this project's actual toolchain — do not introduce a new test framework as part of this work.

## Global Constraints

- Scope is `apps/web` mirror game mode only. Do not touch `apps/expo`, or the `basket`/`clash` modes.
- Strict TypeScript — no `any` without justification (per `CLAUDE.md`).
- Do not call Firestore directly from components — all writes go through `GameContext` (per `CLAUDE.md`).
- New Firebase fields must be added to the TypeScript interface and handled for backward compatibility, since older/in-progress games won't have them (per `CLAUDE.md`). `playerNumbers` is optional (`?:`) for exactly this reason, and every read of it must fall back gracefully.
- All user-facing strings must use `t()`, with keys added to **both** `packages/shared/src/locales/en.json` and `uk.json` (per `CLAUDE.md`).
- This checkout's `node_modules` was found incomplete when this plan was written (`vite`/`tsc` binaries missing under `apps/web`/root). If any command in this plan fails with `command not found` or a wall of `Cannot find module` errors, run `npm install` from the repo root first, then retry.
- **Baseline TypeScript errors:** before making any change, run the two typecheck commands below from the repo root and keep the output — this repo currently has pre-existing, unrelated type errors (e.g. a missing `i18n-js` pluralize declaration, a `photoURL ?? null` mismatch in `GameContext.tsx`, missing `react-router-dom`/`react-dom` type declarations if `npm install` hasn't been run). These are not yours to fix. After each task, re-run and confirm no *new* errors appear beyond this baseline.

```bash
npx tsc --noEmit -p packages/shared/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.json
```

---

## Task 1: `playerNumbers` data model — assign once at game start

**Files:**
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/types.ts`
- Modify: `apps/web/src/contexts/GameContext.tsx`
- Create: `apps/web/src/utils/playerNumbers.ts`

**Interfaces:**
- Produces: `Game.playerNumbers?: { [userId: string]: number }` (in both the shared and the local `Game` interfaces — they must stay structurally identical since components import `Game` from `@mirror/shared` while `GameContext` uses its own local copy for its state type).
- Produces: `buildJoinIndexById` now exported from `@mirror/shared` (function already exists in `packages/shared/src/utils/participants.ts`; it was just not re-exported from the package's `index.ts`).
- Produces: `getPlayerNumber(game: Game, userId: string): number` from `apps/web/src/utils/playerNumbers.ts`, consumed by Tasks 2 and 3.

- [ ] **Step 1: Confirm the dev environment works and capture the TypeScript baseline**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
npm install
npx tsc --noEmit -p packages/shared/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.json
```

Save both outputs somewhere you can compare against later (a scratch file is fine). Some errors are expected here — that's the pre-existing baseline described in Global Constraints, not something to fix.

- [ ] **Step 2: Export `buildJoinIndexById` from the shared package**

In `packages/shared/src/index.ts`, change:

```ts
export { sortParticipantsByJoin } from './utils/participants';
```

to:

```ts
export { sortParticipantsByJoin, buildJoinIndexById } from './utils/participants';
```

- [ ] **Step 3: Add `playerNumbers` to the shared `Game` interface**

In `packages/shared/src/types.ts`, the `Game` interface currently ends with:

```ts
  // Admin target control preferences
  adminNextTargetPreference?: string;
  adminSkippedTargets?: string[];
}
```

Change it to:

```ts
  // Admin target control preferences
  adminNextTargetPreference?: string;
  adminSkippedTargets?: string[];
  // Stable per-participant display numbers, assigned once when the game starts.
  // Frozen for the lifetime of the game — does not shift if participants later leave.
  playerNumbers?: { [userId: string]: number };
}
```

- [ ] **Step 4: Add the same field to `GameContext.tsx`'s local `Game` interface**

In `apps/web/src/contexts/GameContext.tsx`, the local `Game` interface currently ends with:

```ts
  // Admin target control preferences
  adminNextTargetPreference?: string;
  adminSkippedTargets?: string[];
}
```

Change it to:

```ts
  // Admin target control preferences
  adminNextTargetPreference?: string;
  adminSkippedTargets?: string[];
  // Stable per-participant display numbers, assigned once when the game starts.
  // Frozen for the lifetime of the game — does not shift if participants later leave.
  playerNumbers?: { [userId: string]: number };
}
```

- [ ] **Step 5: Import `buildJoinIndexById` in `GameContext.tsx`**

Change the top import line:

```ts
import { auth, db, generateGameId, sortParticipantsByJoin, generateBasketSchedule, generateClashSchedule } from '@mirror/shared';
```

to:

```ts
import { auth, db, generateGameId, sortParticipantsByJoin, buildJoinIndexById, generateBasketSchedule, generateClashSchedule } from '@mirror/shared';
```

- [ ] **Step 6: Assign `playerNumbers` in `startGame()`**

In `apps/web/src/contexts/GameContext.tsx`, `startGame()` currently ends its `try` block with:

```ts
      await updateDoc(gameRef, {
        status: "active",
        currentRound: round,
        rounds: [round],
        scores: {},
      });
```

Change it to:

```ts
      await updateDoc(gameRef, {
        status: "active",
        currentRound: round,
        rounds: [round],
        scores: {},
        playerNumbers: buildJoinIndexById(currentGame.participants),
      });
```

`buildJoinIndexById` takes participants in the order given and maps `userId -> (index + 1)` — it does not sort, so this preserves the exact join order already shown in `WaitingPhase.tsx`'s pre-start participant list (`game.participants` is append-only via `arrayUnion`, so its order already is join order).

- [ ] **Step 7: Create the `getPlayerNumber` helper**

Create `apps/web/src/utils/playerNumbers.ts`:

```ts
import type { Game } from '@mirror/shared';

export function getPlayerNumber(game: Game, userId: string): number {
  const assigned = game.playerNumbers?.[userId];
  if (assigned !== undefined) return assigned;
  const index = game.participants.findIndex(p => p.userId === userId);
  return index >= 0 ? index + 1 : 0;
}
```

The fallback covers two cases without crashing: a game that started before this change shipped (no `playerNumbers` field at all), and a participant who joined after the game was already active (not present in the frozen map).

- [ ] **Step 8: Verify**

```bash
npx tsc --noEmit -p packages/shared/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.json
```

Confirm no *new* errors appeared compared to the Step 1 baseline (specifically: nothing referencing `types.ts`, `index.ts`, `GameContext.tsx`, or `playerNumbers.ts`).

Then manually verify the assignment end-to-end: run `npm run web` from the repo root, open the app in two browser windows (or one normal + one incognito), sign in as two different users, create a game as the admin (password from `CLAUDE.md`), join with the second user, click "Start". Open React DevTools' Components panel, find the `GameProvider`/`GameContext` state (or add a temporary `console.log(currentGame.playerNumbers)` in `GameScreen.tsx` and remove it after confirming), and confirm it's an object mapping both `userId`s to `1` and `2` matching the join order shown in the pre-start participant list.

- [ ] **Step 9: Commit**

```bash
git add packages/shared/src/index.ts packages/shared/src/types.ts apps/web/src/contexts/GameContext.tsx apps/web/src/utils/playerNumbers.ts
git commit -m "$(cat <<'EOF'
Assign stable player numbers at mirror game start

Adds a playerNumbers map to the Game type, populated once in startGame()
from the existing buildJoinIndexById helper, plus a getPlayerNumber()
display helper with a fallback for games/participants predating this field.
EOF
)"
```

---

## Task 2: Number the guessing-phase author pills

**Files:**
- Modify: `apps/web/src/components/game/mirror/GuessingPhase.tsx`

**Interfaces:**
- Consumes: `getPlayerNumber(game: Game, userId: string): number` from `apps/web/src/utils/playerNumbers.ts` (Task 1).

- [ ] **Step 1: Import the helper**

In `apps/web/src/components/game/mirror/GuessingPhase.tsx`, add to the imports (after the existing `Leaderboard` import):

```ts
import { getPlayerNumber } from '../../../utils/playerNumbers';
```

- [ ] **Step 2: Prefix each author pill with its number**

The author-picker button currently reads:

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
                        {author.userName}
                      </button>
                    ))}
```

Change the button's content to:

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

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
```

Confirm no new errors referencing `GuessingPhase.tsx`.

Then manually verify: continuing from Task 1's two-browser-window session (or a fresh 3-participant game — open a third window/incognito profile and join), as each non-admin, non-target participant, write and submit a comment, have the admin click "Show comments" then "Start guessing phase". As the round's target, confirm each author-picker pill reads "N. Name" and that the numbers match the ones from the waiting-room list / Task 1's `playerNumbers` map (e.g. the participant who joined second shows as "2. Name").

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/game/mirror/GuessingPhase.tsx
git commit -m "$(cat <<'EOF'
Show each participant's assigned number on guessing-phase author pills

Uses the frozen-at-start playerNumbers map so the number a guesser sees
matches the one shown for that participant everywhere else in the game.
EOF
)"
```

---

## Task 3: Admin comment-completion checklist

**Files:**
- Modify: `apps/web/src/components/game/mirror/ActivePhase.tsx`
- Modify: `packages/shared/src/locales/en.json`
- Modify: `packages/shared/src/locales/uk.json`

**Interfaces:**
- Consumes: `getPlayerNumber(game: Game, userId: string): number` from `apps/web/src/utils/playerNumbers.ts` (Task 1).
- Consumes: `currentRound.comments: Comment[]` (each with `authorId: string`) and the file's existing `nonTargetPlayers: Participant[]` derived value — already computed in this file for the post-comment-phase gate, reused here unchanged.

- [ ] **Step 1: Add the new locale keys**

In `packages/shared/src/locales/en.json`, inside the `game.ui` object, the block currently reads:

```json
      "participants": "Participants",
      "submitted": "Submitted",
      "leaderboard": "Leaderboard",
```

Change it to:

```json
      "participants": "Participants",
      "submitted": "Submitted",
      "pending": "Pending",
      "commentersStatusTitle": "Comment status",
      "commentsProgress": "%{received} of %{required} submitted",
      "leaderboard": "Leaderboard",
```

In `packages/shared/src/locales/uk.json`, the equivalent block currently reads:

```json
      "participants": "Учасники",
      "submitted": "Відправлено",
      "leaderboard": "Таблиця лідерів",
```

Change it to:

```json
      "participants": "Учасники",
      "submitted": "Відправлено",
      "pending": "Очікується",
      "commentersStatusTitle": "Статус коментарів",
      "commentsProgress": "%{received} з %{required} надіслано",
      "leaderboard": "Таблиця лідерів",
```

- [ ] **Step 2: Import the numbering helper**

In `apps/web/src/components/game/mirror/ActivePhase.tsx`, add to the imports (after the existing `Leaderboard` import):

```ts
import { getPlayerNumber } from '../../../utils/playerNumbers';
```

- [ ] **Step 3: Derive submitted/pending state**

The file currently computes `nonTargetPlayers` like this:

```ts
  const completedPlayers = game.playersWhoCompletedPostCommentPhase ?? [];
  const nonTargetPlayers = game.participants.filter(p => {
    if (p.userId === targetUserId) return false;
    if (p.userId === game.adminId && !(game.adminWritesComments ?? false)) return false;
    return true;
  });
  const allPlayersCompletedPointsPhase = nonTargetPlayers.every(p =>
    completedPlayers.includes(p.userId)
  );
```

Add two new derived values right after it:

```ts
  const completedPlayers = game.playersWhoCompletedPostCommentPhase ?? [];
  const nonTargetPlayers = game.participants.filter(p => {
    if (p.userId === targetUserId) return false;
    if (p.userId === game.adminId && !(game.adminWritesComments ?? false)) return false;
    return true;
  });
  const allPlayersCompletedPointsPhase = nonTargetPlayers.every(p =>
    completedPlayers.includes(p.userId)
  );

  const submittedAuthorIds = new Set(currentRound.comments?.map(c => c.authorId) ?? []);
  const submittedCount = nonTargetPlayers.filter(p => submittedAuthorIds.has(p.userId)).length;
```

`nonTargetPlayers` is exactly "everyone expected to write a comment this round" — it already excludes the target and excludes the admin when `adminWritesComments` is off, which is the same exclusion rule the file already applies elsewhere for the post-comment phase.

- [ ] **Step 4: Render the checklist in the admin-controls block**

The admin-controls block currently reads:

```tsx
          {/* Admin controls */}
          {isAdmin && (
            <div className="flex justify-center gap-3 mb-6">
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
            </div>
          )}
```

Change it to:

```tsx
          {/* Admin controls */}
          {isAdmin && (
            <div className="mb-6">
              {!commentsVisible && (
                <div className="mb-4">
                  <p className="text-sm font-semibold text-center text-gray-700 dark:text-gray-300 mb-1">
                    {t('game.ui.commentersStatusTitle')}
                  </p>
                  <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-3">
                    {t('game.ui.commentsProgress', { received: submittedCount, required: nonTargetPlayers.length })}
                  </p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {nonTargetPlayers.map(p => {
                      const hasSubmitted = submittedAuthorIds.has(p.userId);
                      return (
                        <div
                          key={p.userId}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700"
                        >
                          <span className="text-sm text-gray-500 dark:text-gray-400 w-6">
                            {getPlayerNumber(game, p.userId)}.
                          </span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">
                            {p.userName}
                          </span>
                          <span
                            className={`text-xs font-semibold ${
                              hasSubmitted ? 'text-game-green' : 'text-gray-400'
                            }`}
                          >
                            {hasSubmitted ? `✅ ${t('game.ui.submitted')}` : `⏳ ${t('game.ui.pending')}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex justify-center gap-3">
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
              </div>
            </div>
          )}
```

This only changes the wrapping `<div>` from a flex row to a stacked container plus adds the checklist block before the existing (unchanged) button row.

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit -p packages/shared/tsconfig.json
npx tsc --noEmit -p apps/web/tsconfig.json
```

Confirm no new errors referencing `ActivePhase.tsx`, `en.json`, or `uk.json`.

Then manually verify with a 3-participant mirror game (admin + 2 others, `adminWritesComments` off): start the game, and as the admin, watch the writing phase. Confirm the checklist shows both non-admin participants as "⏳ Pending" with "0 of 2 submitted", each row prefixed with their number. Have one participant submit a comment and confirm their row flips to "✅ Submitted" and the count updates to "1 of 2" without a page refresh (real-time Firestore listener). Submit the second comment and confirm "2 of 2". Click "Show comments" and confirm the checklist disappears, leaving the existing comments/points UI unchanged. Also switch the locale to Ukrainian (language switcher, if present in the header) and confirm the new strings render in Ukrainian instead of raw keys.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/game/mirror/ActivePhase.tsx packages/shared/src/locales/en.json packages/shared/src/locales/uk.json
git commit -m "$(cat <<'EOF'
Show admin a live comment-submission checklist during the writing phase

Admin previously had no way to tell who still needed to write a comment
before showing them, beyond an "at least one comment exists" button gate.
EOF
)"
```
