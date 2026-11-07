# One-Time Pulse Animation on the Active Section (Web) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In `apps/web`, play a brief, one-time accent-color pulse on the section that just auto-scrolled into view, at the exact same moment the scroll fires — reusing the existing trigger key, no new "when" logic.

**Architecture:** Extend the existing `useScrollIntoViewOnChange` hook (already called at all 15 wrap sites from the auto-scroll feature) to also toggle a CSS class on the same ref'd element inside its existing effect, removed via `setTimeout` after ~900ms. One shared `@keyframes` rule lives in the app's global stylesheet; each call site passes its own section's existing accent color as a new third hook argument.

**Tech Stack:** React 19, TypeScript (strict), plain CSS (no new dependency). No test runner in this package — verified via `tsc --noEmit` plus manual browser walkthrough, same as the auto-scroll feature.

## Global Constraints

- Scope is `apps/web` only (a companion plan, `docs/superpowers/plans/2026-07-30-active-section-pulse-animation-expo.md`, covers `apps/expo`).
- Reuses the exact trigger key already passed to `useScrollIntoViewOnChange` at every call site — do not introduce a second, separate key or condition for the pulse.
- The pulse is skipped entirely (not softened) when `prefers-reduced-motion: reduce` is set — reuse the existing check already in the hook.
- Duration ~900ms, using each section's own existing accent color (not a single fixed color) — see the color mapping in Task 1.
- Strict TypeScript, no `any` without justification.
- No test runner in `apps/web`/`packages/shared` — verify via `npx tsc --noEmit -p apps/web/tsconfig.json` (from repo root) compared against baseline (3 known pre-existing errors: `PostCommentPointsPanel.tsx:69`, `GameContext.tsx:427`, `packages/shared/src/i18n.ts:2`) plus manual browser checks.

---

## Task 1: Extend the hook, add the keyframe, and the color constants

**Files:**
- Modify: `apps/web/src/hooks/useScrollIntoViewOnChange.ts`
- Modify: `apps/web/src/index.css`
- Create: `apps/web/src/constants/pulseColors.ts`

**Interfaces:**
- Produces: `useScrollIntoViewOnChange<T extends HTMLElement>(triggerKey: string | number, align?: ScrollLogicalPosition, pulseColor?: string): React.RefObject<T>` — the hook's existing two-argument callers keep working unchanged (new argument is optional with a default); every later task in this plan passes the third argument explicitly.
- Produces: `PULSE_COLORS: { green, blue, purple, orange, gold, danger }` (each an `rgba(...)` string with a baked-in 0.55 alpha) from `apps/web/src/constants/pulseColors.ts`, imported by every later task in this plan.

- [ ] **Step 1: Create the color constants**

Create `apps/web/src/constants/pulseColors.ts`:

```ts
// One rgba string per game accent color (see apps/web/tailwind.config.js's
// `game-*` palette), pre-computed with a 0.55 alpha for the pulse glow's
// peak opacity. Each call site of useScrollIntoViewOnChange picks whichever
// entry matches that section's own existing accent color.
export const PULSE_COLORS = {
  green: 'rgba(52, 199, 89, 0.55)',   // game-green #34C759
  blue: 'rgba(0, 122, 255, 0.55)',    // game-blue #007AFF
  purple: 'rgba(175, 82, 222, 0.55)', // game-purple #AF52DE
  orange: 'rgba(255, 149, 0, 0.55)',  // game-orange #FF9500
  gold: 'rgba(255, 215, 0, 0.55)',    // game-gold #FFD700
  danger: 'rgba(255, 59, 48, 0.55)',  // game-danger #FF3B30
} as const;
```

- [ ] **Step 2: Add the keyframe to the global stylesheet**

`apps/web/src/index.css` currently reads:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  padding: 0;
  font-family: 'Philosopher', system-ui, sans-serif;
}
```

Change it to:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  padding: 0;
  font-family: 'Philosopher', system-ui, sans-serif;
}

/* One-time "look here" pulse for the auto-scrolled active section. Color is
   set per-element via the --pulse-color custom property (see
   useScrollIntoViewOnChange.ts). Skipped entirely when the user prefers
   reduced motion — the class is simply never added in that case. */
@keyframes active-section-pulse-glow {
  0% {
    box-shadow: 0 0 0 0 var(--pulse-color, rgba(0, 122, 255, 0.55));
  }
  70% {
    box-shadow: 0 0 0 14px transparent;
  }
  100% {
    box-shadow: 0 0 0 0 transparent;
  }
}

.active-section-pulse {
  animation: active-section-pulse-glow 0.9s ease-out;
  border-radius: 0.5rem;
}
```

- [ ] **Step 3: Extend the hook**

`apps/web/src/hooks/useScrollIntoViewOnChange.ts` currently reads:

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
  align: ScrollLogicalPosition = 'center',
) {
  const ref = useRef<T>(null);
  const lastKey = useRef<string | number | null>(null);

  useEffect(() => {
    if (lastKey.current === triggerKey) return;
    lastKey.current = triggerKey;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: align,
    });
  }, [triggerKey, align]);

  return ref;
}
```

Change it to:

```ts
import { useEffect, useRef } from 'react';

/**
 * Returns a ref to attach to the DOM node that represents "the current
 * section for this viewer". Scrolls that node into view once whenever
 * triggerKey changes — including on first mount — and never re-fires for
 * a re-render with the same key (e.g. new list content arriving). Also
 * plays a brief, one-time accent-color pulse on the same node at the same
 * moment (see the `.active-section-pulse` keyframe in index.css) — skipped
 * entirely, like the scroll's smooth behavior, when the user prefers
 * reduced motion.
 */
export function useScrollIntoViewOnChange<T extends HTMLElement>(
  triggerKey: string | number,
  align: ScrollLogicalPosition = 'center',
  pulseColor: string = 'rgba(0, 122, 255, 0.55)',
) {
  const ref = useRef<T>(null);
  const lastKey = useRef<string | number | null>(null);

  useEffect(() => {
    if (lastKey.current === triggerKey) return;
    lastKey.current = triggerKey;
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    ref.current?.scrollIntoView({
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
      block: align,
    });
    if (prefersReducedMotion || !ref.current) return;
    ref.current.style.setProperty('--pulse-color', pulseColor);
    ref.current.classList.add('active-section-pulse');
    const timeoutId = window.setTimeout(() => {
      ref.current?.classList.remove('active-section-pulse');
    }, 900);
    return () => window.clearTimeout(timeoutId);
  }, [triggerKey, align, pulseColor]);

  return ref;
}
```

- [ ] **Step 4: Verify**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
```

Confirm no new errors referencing `useScrollIntoViewOnChange.ts`, `index.css`, or `pulseColors.ts` (the hook's existing two-argument callers remain valid since the new parameter has a default; this step alone doesn't yet pass a color anywhere, so no visual change is expected yet).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/hooks/useScrollIntoViewOnChange.ts apps/web/src/index.css apps/web/src/constants/pulseColors.ts
git commit -m "$(cat <<'EOF'
Add one-time accent-color pulse to useScrollIntoViewOnChange

Extends the existing auto-scroll hook to also flash a brief box-shadow
glow on the same element at the same trigger-key change, using a new
optional pulseColor argument (default game-blue) and a shared keyframe
in index.css. Skips the pulse when prefers-reduced-motion is set.
EOF
)"
```

---

## Task 2: Wire mirror mode (and the shared waiting/results screens)

**Files:**
- Modify: `apps/web/src/components/game/mirror/WaitingPhase.tsx`
- Modify: `apps/web/src/components/game/mirror/ActivePhase.tsx`
- Modify: `apps/web/src/components/game/mirror/GuessingPhase.tsx`
- Modify: `apps/web/src/components/game/mirror/ResultsPhase.tsx`

**Interfaces:**
- Consumes: `useScrollIntoViewOnChange<T>(triggerKey, align?, pulseColor?): React.RefObject<T>` (Task 1) — this task only adds the third argument to each file's existing call(s), the trigger keys and refs themselves are unchanged.
- Consumes: `PULSE_COLORS` from `apps/web/src/constants/pulseColors.ts` (Task 1).

`WaitingPhase.tsx` and `ResultsPhase.tsx` are rendered for all three game modes — wiring them here also covers basket's and clash's waiting/results stages.

- [ ] **Step 1: `WaitingPhase.tsx`**

Add the import (after the existing `useScrollIntoViewOnChange` import):

```ts
import { PULSE_COLORS } from '../../../constants/pulseColors';
```

The hook call currently reads:

```ts
  const scrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${isAdmin}:${game.gameType ?? 'mirror'}`,
  );
```

Change it to:

```ts
  const scrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${isAdmin}:${game.gameType ?? 'mirror'}`,
    'center',
    PULSE_COLORS.orange,
  );
```

- [ ] **Step 2: `ActivePhase.tsx`**

Add the import (after the existing `useScrollIntoViewOnChange` import):

```ts
import { PULSE_COLORS } from '../../../constants/pulseColors';
```

The three hook calls currently read:

```ts
  const targetScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRound?.roundNumber ?? 'none'}:target:${commentsVisible}:${targetFinishedPoints}`,
    'start',
  );
  const otherScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRound?.roundNumber ?? 'none'}:other:${commentsVisible}:${targetFinishedPoints}`,
    'start',
  );
  const adminScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRound?.roundNumber ?? 'none'}:admin:${commentsVisible}`,
  );
```

Change them to:

```ts
  const targetScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRound?.roundNumber ?? 'none'}:target:${commentsVisible}:${targetFinishedPoints}`,
    'start',
    PULSE_COLORS.green,
  );
  const otherScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRound?.roundNumber ?? 'none'}:other:${commentsVisible}:${targetFinishedPoints}`,
    'start',
    PULSE_COLORS.green,
  );
  const adminScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRound?.roundNumber ?? 'none'}:admin:${commentsVisible}`,
    'center',
    PULSE_COLORS.green,
  );
```

- [ ] **Step 3: `GuessingPhase.tsx`**

Add the import (after the existing `useScrollIntoViewOnChange` import):

```ts
import { PULSE_COLORS } from '../../../constants/pulseColors';
```

The two hook calls currently read:

```ts
  const playerScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${singleTargetId ?? 'legacy'}:${hasSubmitted}:${commentsForPlayerCount > 0}`,
    'start',
  );
  const adminScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${singleTargetId ?? 'legacy'}:${guessingData?.allPlayersSubmitted ?? false}:${targetSubmitted}`,
  );
```

Change them to:

```ts
  const playerScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${singleTargetId ?? 'legacy'}:${hasSubmitted}:${commentsForPlayerCount > 0}`,
    'start',
    PULSE_COLORS.purple,
  );
  const adminScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${singleTargetId ?? 'legacy'}:${guessingData?.allPlayersSubmitted ?? false}:${targetSubmitted}`,
    'center',
    PULSE_COLORS.purple,
  );
```

- [ ] **Step 4: `ResultsPhase.tsx`**

Add the import (after the existing `useScrollIntoViewOnChange` import):

```ts
import { PULSE_COLORS } from '../../../constants/pulseColors';
```

The hook call currently reads:

```ts
  const scrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `finished:${!!game.adminLeft}`,
    'start',
  );
```

Change it to:

```ts
  const scrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `finished:${!!game.adminLeft}`,
    'start',
    PULSE_COLORS.gold,
  );
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
```

Confirm no new errors referencing `WaitingPhase.tsx`, `ActivePhase.tsx`, `GuessingPhase.tsx`, or `ResultsPhase.tsx`.

Then manually verify with a 3-participant mirror game: as admin, start the game and confirm the section that scrolls into view (the checklist/button area) also flashes a brief green glow; as the target and as a non-target player, confirm the same glow appears on your own section when it becomes relevant; move through to the guessing phase and confirm a brief purple glow; finish the game and confirm a brief gold glow on the results content. Confirm the glow fires only once per transition (not on every incidental re-render), and confirm it's suppressed if you enable "reduce motion" in your OS/browser accessibility settings.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/game/mirror/WaitingPhase.tsx apps/web/src/components/game/mirror/ActivePhase.tsx apps/web/src/components/game/mirror/GuessingPhase.tsx apps/web/src/components/game/mirror/ResultsPhase.tsx
git commit -m "$(cat <<'EOF'
Add one-time pulse animation to mirror mode's active sections

Passes each section's existing accent color as the new pulseColor
argument to useScrollIntoViewOnChange, added in the prior commit.
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
- Consumes: `useScrollIntoViewOnChange<T>(triggerKey, align?, pulseColor?): React.RefObject<T>` and `PULSE_COLORS` (Task 1).

- [ ] **Step 1: `BasketWritingPhase.tsx`**

Add the import (after the existing `useScrollIntoViewOnChange` import):

```ts
import { PULSE_COLORS } from '../../../constants/pulseColors';
```

The two hook calls currently read:

```ts
  const playerScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${alreadySubmitted}`,
  );
  const adminScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${totalCount > 0 && submittedCount >= totalCount}`,
  );
```

Change them to:

```ts
  const playerScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${alreadySubmitted}`,
    'center',
    PULSE_COLORS.blue,
  );
  const adminScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${totalCount > 0 && submittedCount >= totalCount}`,
    'center',
    PULSE_COLORS.blue,
  );
```

- [ ] **Step 2: `BasketGuessingPhase.tsx`**

Add the import (after the existing `useScrollIntoViewOnChange` import):

```ts
import { PULSE_COLORS } from '../../../constants/pulseColors';
```

The two hook calls currently read:

```ts
  const playerScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${isDone || showWrong}:${showAuthorPrompt}`,
  );
  const adminScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${allGuessersDone}`,
  );
```

Change them to:

```ts
  const playerScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${isDone || showWrong}:${showAuthorPrompt}`,
    'center',
    PULSE_COLORS.purple,
  );
  const adminScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${allGuessersDone}`,
    'center',
    PULSE_COLORS.purple,
  );
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
```

Confirm no new errors referencing `BasketWritingPhase.tsx` or `BasketGuessingPhase.tsx`.

Then manually verify with a 3-participant basket game: confirm a brief blue glow accompanies the scroll during the writing phase, and a brief purple glow during the guessing phase, for both the player-facing and admin sections.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/game/basket/BasketWritingPhase.tsx apps/web/src/components/game/basket/BasketGuessingPhase.tsx
git commit -m "$(cat <<'EOF'
Add one-time pulse animation to basket mode's active sections

Passes each section's existing accent color as the pulseColor argument
to useScrollIntoViewOnChange.
EOF
)"
```

---

## Task 4: Wire clash mode

**Files:**
- Modify: `apps/web/src/components/game/clash/ClashWritingPhase.tsx`
- Modify: `apps/web/src/components/game/clash/ClashGuessingPhase.tsx`

**Interfaces:**
- Consumes: `useScrollIntoViewOnChange<T>(triggerKey, align?, pulseColor?): React.RefObject<T>` and `PULSE_COLORS` (Task 1).

- [ ] **Step 1: `ClashWritingPhase.tsx`**

Add the import (after the existing `useScrollIntoViewOnChange` import):

```ts
import { PULSE_COLORS } from '../../../constants/pulseColors';
```

The two hook calls currently read:

```ts
  const playerScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${alreadySubmitted}`,
  );
  const adminScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${allSubmitted}`,
  );
```

Change them to:

```ts
  const playerScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${alreadySubmitted}`,
    'center',
    PULSE_COLORS.orange,
  );
  const adminScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${allSubmitted}`,
    'center',
    PULSE_COLORS.orange,
  );
```

- [ ] **Step 2: `ClashGuessingPhase.tsx`**

Add the import (after the existing `useScrollIntoViewOnChange` import):

```ts
import { PULSE_COLORS } from '../../../constants/pulseColors';
```

The two hook calls currently read:

```ts
  const playerScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${currentGroup ?? 'none'}:${isActiveLeader}`,
    'start',
  );
  const adminScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${currentGroup ?? 'none'}:${currentGroupDone}`,
  );
```

Change them to:

```ts
  const playerScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${currentGroup ?? 'none'}:${isActiveLeader}`,
    'start',
    PULSE_COLORS.danger,
  );
  const adminScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${currentGroup ?? 'none'}:${currentGroupDone}`,
    'center',
    PULSE_COLORS.danger,
  );
```

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit -p apps/web/tsconfig.json
```

Confirm no new errors referencing `ClashWritingPhase.tsx` or `ClashGuessingPhase.tsx`.

Then manually verify with a 4-participant clash game (2v2): confirm a brief red/danger-colored glow accompanies the scroll during both the writing and guessing phases, for both the player-facing and admin sections.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/game/clash/ClashWritingPhase.tsx apps/web/src/components/game/clash/ClashGuessingPhase.tsx
git commit -m "$(cat <<'EOF'
Add one-time pulse animation to clash mode's active sections

Passes each section's existing accent color as the pulseColor argument
to useScrollIntoViewOnChange.
EOF
)"
```
