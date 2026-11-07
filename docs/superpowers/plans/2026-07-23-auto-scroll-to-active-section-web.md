# Auto-Scroll to Active Section (Web) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In `apps/web`, scroll the page to the section relevant to the current viewer whenever what they should be looking at changes, across all three game modes (mirror, basket, clash), without re-scrolling on incidental data updates.

**Architecture:** One small shared hook, `useScrollIntoViewOnChange(triggerKey)`, wraps the browser's native `Element.scrollIntoView()`. Each phase component attaches the hook's returned ref to the DOM node that is "the current section for this viewer" and passes a trigger key built from the state that determines which section/sub-state is showing. The hook scrolls once per distinct key value; re-renders with an unchanged key never re-fire.

**Tech Stack:** React 19, TypeScript (strict), no new dependency (native `scrollIntoView`). No test runner exists in `apps/web` (established in prior work) — verification is `tsc --noEmit` plus manual browser walkthrough.

## Global Constraints

- Scope is `apps/web` only (a companion plan, `docs/superpowers/plans/2026-07-23-auto-scroll-to-active-section-expo.md`, covers `apps/expo`).
- Applies to mirror, basket, and clash modes. Does not apply to `JoinScreen`/`AuthScreen`, or to nested internal scroll widgets (comment checklists, leaderboards) — page-level scroll only.
- "Scroll to the current relevant section" applies uniformly whether that section is an action (button/form) or a read-only waiting/status message — no special-casing (per design spec).
- The trigger key must be built only from state that determines *which* section/sub-state is showing — never from list contents (e.g. a new comment arriving must not change the key and must not re-trigger a scroll).
- Strict TypeScript, no `any` without justification.
- No test runner in `apps/web`/`packages/shared` — do not add one. Verify via `npx tsc --noEmit -p apps/web/tsconfig.json` (from repo root) plus manual browser checks. This repo has pre-existing, unrelated TypeScript errors (documented in the prior two plans) — the bar is "no *new* errors," not "zero errors."
- **Known edge case, accepted rather than engineered around:** in `GuessingPhase.tsx`, `BasketWritingPhase.tsx`/`BasketGuessingPhase.tsx`, and `ClashWritingPhase.tsx`/`ClashGuessingPhase.tsx`, the admin's own "admin controls" block and the "player-facing" block are not always mutually exclusive (an admin who is also a writer/guesser sees both). Each such component gets one independent hook call per block; if both blocks' trigger keys change in the same render, whichever hook's effect runs later wins the final scroll position. This is a minor, cosmetic edge case, not a functional bug — do not build a priority/arbitration system for it. (Mirror's `ActivePhase` does not have this issue: admin is never selected as a round's target, so its "admin" and "target" blocks are mutually exclusive in practice.)

---

## Task 1: The `useScrollIntoViewOnChange` hook

**Files:**
- Create: `apps/web/src/hooks/useScrollIntoViewOnChange.ts`

**Interfaces:**
- Produces: `useScrollIntoViewOnChange<T extends HTMLElement>(triggerKey: string | number): React.RefObject<T>` — attach the returned ref to the DOM node that should scroll into view when `triggerKey` changes. Every later task in this plan imports and calls this hook.

- [ ] **Step 1: Create the hook**

```ts
import { useEffect, useRef } from 'react';

/**
 * Returns a ref to attach to the DOM node that represents "the current
 * section for this viewer". Scrolls that node into view once whenever
 * triggerKey changes — including on first mount — and never re-fires for
 * a re-render with the same key (e.g. new list content arriving).
 */
export function useScrollIntoViewOnChange<T extends HTMLElement>(
  triggerKey: string | number,
) {
  const ref = useRef<T>(null);
  const lastKey = useRef<string | number | null>(null);

  useEffect(() => {
    if (lastKey.current === triggerKey) return;
    lastKey.current = triggerKey;
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [triggerKey]);

  return ref;
}
```

- [ ] **Step 2: Verify**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
```

Confirm no new errors referencing `useScrollIntoViewOnChange.ts` (this file has no consumers yet, so it should compile cleanly in isolation).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/hooks/useScrollIntoViewOnChange.ts
git commit -m "$(cat <<'EOF'
Add useScrollIntoViewOnChange hook for web

Scrolls a target element into view once per distinct trigger-key value,
never re-firing on incidental re-renders with the same key.
EOF
)"
```

---

## Task 2: Wire mirror mode (and the shared waiting screen)

**Files:**
- Modify: `apps/web/src/components/game/mirror/WaitingPhase.tsx`
- Modify: `apps/web/src/components/game/mirror/ActivePhase.tsx`
- Modify: `apps/web/src/components/game/mirror/GuessingPhase.tsx`
- Modify: `apps/web/src/components/game/mirror/ResultsPhase.tsx`

**Interfaces:**
- Consumes: `useScrollIntoViewOnChange<T>(triggerKey: string | number): React.RefObject<T>` from Task 1.

`WaitingPhase.tsx` and `ResultsPhase.tsx` are rendered by `GameScreen.tsx` for **all three** game modes (`status === 'waiting'` and `status === 'finished'` respectively, regardless of `gameType`) — wiring them here covers basket and clash's waiting/results stages too; Tasks 3 and 4 do not need to touch them again.

- [ ] **Step 1: `WaitingPhase.tsx` — scroll to the start-button / waiting-for-admin area**

Add the import (after the existing `Leaderboard` import):

```ts
import { useScrollIntoViewOnChange } from '../../../hooks/useScrollIntoViewOnChange';
```

Inside the component, after `const isAdmin = user?.uid === game.adminId;`, add:

```ts
  const scrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${isAdmin}:${game.gameType ?? 'mirror'}`,
  );
```

The block currently reads:

```tsx
          {isAdmin && (game.gameType ?? 'mirror') !== 'clash' ? (
            <button
              type="button"
              onClick={handleStartGame}
              disabled={game.participants.length < 2 || isStarting || loading}
              className="w-full bg-game-green text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading || isStarting ? t('common.loading') : t('game.ui.startGame')}
            </button>
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 text-sm">
              {t('game.ui.waitingForAdminStart')}
            </p>
          )}
```

Change it to:

```tsx
          <div ref={scrollRef}>
            {isAdmin && (game.gameType ?? 'mirror') !== 'clash' ? (
              <button
                type="button"
                onClick={handleStartGame}
                disabled={game.participants.length < 2 || isStarting || loading}
                className="w-full bg-game-green text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {loading || isStarting ? t('common.loading') : t('game.ui.startGame')}
              </button>
            ) : (
              <p className="text-center text-gray-500 dark:text-gray-400 text-sm">
                {t('game.ui.waitingForAdminStart')}
              </p>
            )}
          </div>
```

- [ ] **Step 2: `ActivePhase.tsx` — scroll to each role's block**

Add the import (after the existing `getPlayerNumber` import):

```ts
import { useScrollIntoViewOnChange } from '../../../hooks/useScrollIntoViewOnChange';
```

After the existing `const submittedCount = ...` line, add three hook calls:

```ts
  const adminScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRound.roundNumber}:admin:${commentsVisible}`,
  );
  const targetScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRound.roundNumber}:target:${commentsVisible}:${targetFinishedPoints}`,
  );
  const otherScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRound.roundNumber}:other:${commentsVisible}:${targetFinishedPoints}:${hasCompletedPhase || alreadyGaveTargetPoints}`,
  );
```

These three hooks are always called (never conditionally) — only their returned refs are conditionally *attached* to JSX below, which is fine (attaching a ref conditionally is not a hook-order violation).

Change the admin block's opening tag from:

```tsx
          {/* Admin controls */}
          {isAdmin && (
            <div className="mb-6">
```

to:

```tsx
          {/* Admin controls */}
          {isAdmin && (
            <div className="mb-6" ref={adminScrollRef}>
```

Change the target block's opening tag from:

```tsx
          {/* Target player view */}
          {isTarget && (
            <div>
```

to:

```tsx
          {/* Target player view */}
          {isTarget && (
            <div ref={targetScrollRef}>
```

Change the non-target block's opening tag from:

```tsx
          {/* Non-target player view */}
          {!isTarget && (
            <div>
```

to:

```tsx
          {/* Non-target player view */}
          {!isTarget && (
            <div ref={otherScrollRef}>
```

- [ ] **Step 3: `GuessingPhase.tsx` — scroll to the player's guessing UI and (independently) the admin controls**

Add the import (after the existing `getPlayerNumber` import):

```ts
import { useScrollIntoViewOnChange } from '../../../hooks/useScrollIntoViewOnChange';
```

After the existing `const playerResult = ...` line, add:

```ts
  const playerScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${singleTargetId ?? 'legacy'}:${hasSubmitted}`,
  );
  const adminScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${singleTargetId ?? 'legacy'}:${guessingData.allPlayersSubmitted}:${targetSubmitted}`,
  );
```

The "Player guessing UI" block currently reads:

```tsx
          {/* Player guessing UI */}
          {hasSubmitted ? (
```

Change it to:

```tsx
          {/* Player guessing UI */}
          <div ref={playerScrollRef}>
          {hasSubmitted ? (
```

And its closing — the block currently ends with (right before the `{/* Admin controls */}` comment):

```tsx
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {t('game.ui.waitingForAdminToStartGuessing')}
            </p>
          )}

          {/* Admin controls */}
```

Change it to:

```tsx
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {t('game.ui.waitingForAdminToStartGuessing')}
            </p>
          )}
          </div>

          {/* Admin controls */}
```

Change the admin controls block's opening tag from:

```tsx
          {/* Admin controls */}
          {isAdmin && (
            <div className="mt-6 flex justify-center">
```

to:

```tsx
          {/* Admin controls */}
          {isAdmin && (
            <div className="mt-6 flex justify-center" ref={adminScrollRef}>
```

- [ ] **Step 4: `ResultsPhase.tsx` — scroll to the results content on entry**

Add the import (after the existing `Leaderboard` import):

```ts
import { useScrollIntoViewOnChange } from '../../../hooks/useScrollIntoViewOnChange';
```

Inside the component, after the `calculateSimilarPairs(...)` call, add:

```ts
  const scrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `finished:${!!game.adminLeft}`,
  );
```

The `adminLeft` branch currently reads:

```tsx
  if (game.adminLeft) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border-2 border-game-gold text-center space-y-2">
```

Change it to:

```tsx
  if (game.adminLeft) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border-2 border-game-gold text-center space-y-2" ref={scrollRef}>
```

The normal-results return currently reads:

```tsx
  return (
    <div className="space-y-6">
```

Change it to:

```tsx
  return (
    <div className="space-y-6" ref={scrollRef}>
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
```

Confirm no new errors referencing `WaitingPhase.tsx`, `ActivePhase.tsx`, `GuessingPhase.tsx`, or `ResultsPhase.tsx`.

Then manually verify with a 3-participant mirror game: as admin, confirm the waiting-room screen keeps the start-button area in view; start the game and confirm the page scrolls to your section (admin checklist) automatically; as a non-target player, confirm the page scrolls to your comment form; write and submit a comment, confirm the page scrolls to the "comment sent, waiting" message; as the round's target, confirm the page scrolls to "waiting for comments about you", then after comments are shown, to the comment list with point-award buttons; move through to the guessing phase and confirm the page scrolls to the guess-picker; finish the game and confirm the page scrolls to the results content. Confirm that incidental updates (e.g. another player's comment arriving while you wait) do **not** cause a re-scroll.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/game/mirror/WaitingPhase.tsx apps/web/src/components/game/mirror/ActivePhase.tsx apps/web/src/components/game/mirror/GuessingPhase.tsx apps/web/src/components/game/mirror/ResultsPhase.tsx
git commit -m "$(cat <<'EOF'
Auto-scroll to the active section in mirror mode

Wires useScrollIntoViewOnChange into WaitingPhase, ActivePhase (per
role), GuessingPhase (player UI + admin controls), and ResultsPhase.
WaitingPhase and ResultsPhase are shared by all three game modes, so
this also covers basket's and clash's waiting/results stages.
EOF
)"
```

---

## Task 3: Wire basket mode

**Files:**
- Modify: `apps/web/src/components/game/basket/BasketWritingPhase.tsx`
- Modify: `apps/web/src/components/game/basket/BasketGuessingPhase.tsx`

**Interfaces:**
- Consumes: `useScrollIntoViewOnChange<T>(triggerKey: string | number): React.RefObject<T>` from Task 1.

- [ ] **Step 1: `BasketWritingPhase.tsx`**

Add the import (after the existing `useAlert` import):

```ts
import { useScrollIntoViewOnChange } from '../../../hooks/useScrollIntoViewOnChange';
```

After the existing `const totalCount = ...` line, add:

```ts
  const playerScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${alreadySubmitted}`,
  );
  const adminScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${submittedCount >= totalCount}`,
  );
```

The player-facing block currently reads:

```tsx
        {alreadySubmitted ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center">
```

Change it to:

```tsx
        <div ref={playerScrollRef}>
        {alreadySubmitted ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center">
```

Its closing — currently:

```tsx
          </form>
        )}

        {isAdmin && (
```

Change it to:

```tsx
          </form>
        )}
        </div>

        {isAdmin && (
```

The admin block's opening tag currently reads:

```tsx
        {isAdmin && (
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-blue-200 dark:border-blue-800">
```

Change it to:

```tsx
        {isAdmin && (
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-blue-200 dark:border-blue-800" ref={adminScrollRef}>
```

- [ ] **Step 2: `BasketGuessingPhase.tsx`**

Add the import (after the existing `useAlert` import):

```ts
import { useScrollIntoViewOnChange } from '../../../hooks/useScrollIntoViewOnChange';
```

After the existing `const allGuessersDone = ...` block, add:

```ts
  const playerScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${isDone || showWrong}:${showAuthorPrompt}`,
  );
  const adminScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${allGuessersDone}`,
  );
```

The player-facing block currently reads:

```tsx
        {isDone || showWrong ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center space-y-2">
```

Change it to:

```tsx
        <div ref={playerScrollRef}>
        {isDone || showWrong ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center space-y-2">
```

Its closing — currently:

```tsx
            ))}
          </div>
        )}

        {isAdmin && (
```

Change it to:

```tsx
            ))}
          </div>
        )}
        </div>

        {isAdmin && (
```

The admin block's opening tag currently reads:

```tsx
        {isAdmin && (
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-purple-200 dark:border-purple-800">
```

Change it to:

```tsx
        {isAdmin && (
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-purple-200 dark:border-purple-800" ref={adminScrollRef}>
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
```

Confirm no new errors referencing `BasketWritingPhase.tsx` or `BasketGuessingPhase.tsx`.

Then manually verify with a 3-participant basket game: as a writer, confirm the page scrolls to the comment form, then to the "waiting for others" message after submitting; as admin, confirm the page also keeps the reveal-button area reachable; move into the guessing phase and confirm the page scrolls to the comment-guessing prompt, then to the author-guessing prompt after a correct guess, then to the "waiting for guesses" message.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/game/basket/BasketWritingPhase.tsx apps/web/src/components/game/basket/BasketGuessingPhase.tsx
git commit -m "$(cat <<'EOF'
Auto-scroll to the active section in basket mode

Wires useScrollIntoViewOnChange into BasketWritingPhase and
BasketGuessingPhase's player-facing and admin-controls sections.
EOF
)"
```

---

## Task 4: Wire clash mode

**Files:**
- Modify: `apps/web/src/components/game/clash/ClashWritingPhase.tsx`
- Modify: `apps/web/src/components/game/clash/ClashGuessingPhase.tsx`

**Interfaces:**
- Consumes: `useScrollIntoViewOnChange<T>(triggerKey: string | number): React.RefObject<T>` from Task 1.

- [ ] **Step 1: `ClashWritingPhase.tsx`**

Add the import (after the existing `useAlert` import):

```ts
import { useScrollIntoViewOnChange } from '../../../hooks/useScrollIntoViewOnChange';
```

After the existing `const allSubmitted = ...` line, add:

```ts
  const playerScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${alreadySubmitted}`,
  );
  const adminScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${allSubmitted}`,
  );
```

The player-facing block currently reads:

```tsx
        {alreadySubmitted ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center">
```

Change it to:

```tsx
        <div ref={playerScrollRef}>
        {alreadySubmitted ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center">
```

Its closing — currently:

```tsx
          </form>
        )}

        {isAdmin && (
```

Change it to:

```tsx
          </form>
        )}
        </div>

        {isAdmin && (
```

The admin block's opening tag currently reads:

```tsx
        {isAdmin && (
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-orange-200 dark:border-orange-800">
```

Change it to:

```tsx
        {isAdmin && (
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-orange-200 dark:border-orange-800" ref={adminScrollRef}>
```

- [ ] **Step 2: `ClashGuessingPhase.tsx`**

Add the import (after the existing `useAlert` import):

```ts
import { useScrollIntoViewOnChange } from '../../../hooks/useScrollIntoViewOnChange';
```

After the existing `const currentGroupDone = ...` block, add:

```ts
  const playerScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${currentGroup}:${isActiveLeader}`,
  );
  const adminScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${currentGroup}:${currentGroupDone}`,
  );
```

The player-facing block currently reads:

```tsx
        {!isActiveLeader ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center">
```

Change it to:

```tsx
        <div ref={playerScrollRef}>
        {!isActiveLeader ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center">
```

Its closing — currently:

```tsx
            })}
          </div>
        )}

        {isAdmin && (
```

Change it to:

```tsx
            })}
          </div>
        )}
        </div>

        {isAdmin && (
```

The admin block's opening tag currently reads:

```tsx
        {isAdmin && (
          <div className="flex justify-center pt-2 border-t border-red-200 dark:border-red-800">
```

Change it to:

```tsx
        {isAdmin && (
          <div className="flex justify-center pt-2 border-t border-red-200 dark:border-red-800" ref={adminScrollRef}>
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
```

Confirm no new errors referencing `ClashWritingPhase.tsx` or `ClashGuessingPhase.tsx`.

Then manually verify with a 4-participant clash game (2v2): as a writer, confirm the page scrolls to the comment form, then the "waiting for group" message after submitting; as the active leader during guessing, confirm the page scrolls to the card list; as a non-leader, confirm the page scrolls to the "X is guessing" message; as admin, confirm the reveal/advance button area stays reachable.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/game/clash/ClashWritingPhase.tsx apps/web/src/components/game/clash/ClashGuessingPhase.tsx
git commit -m "$(cat <<'EOF'
Auto-scroll to the active section in clash mode

Wires useScrollIntoViewOnChange into ClashWritingPhase and
ClashGuessingPhase's player-facing and admin-controls sections.
EOF
)"
```
