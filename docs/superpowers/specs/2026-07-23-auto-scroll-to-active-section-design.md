# Auto-Scroll to the Active Section

**Date:** 2026-07-23
**Scope:** `apps/web` and `apps/expo`, all three game modes (mirror, basket, clash).

## Problem

At every stage of the game, players can find themselves looking at the top of a long page/screen while the thing relevant to them right now — a form to fill in, a button to press, or a status message telling them what to wait for — is further down, out of view. Nothing currently scrolls the viewport to that section; the user has to notice and scroll manually.

## Behavior

Each phase component already renders exactly one "current section" per viewer role — e.g. `ActivePhase` shows one of three mutually-exclusive blocks depending on whether the viewer is the admin, the round's target, or another player. Whenever the state that determines *which* section (or which state within a section) is showing changes, the page/screen scrolls that section into view once, smoothly.

This applies uniformly to every phase across mirror, basket, and clash, on both platforms: `WaitingPhase`, `ActivePhase`/writing phases, `GuessingPhase`, post-round point phases, and `ResultsPhase`. It does **not** distinguish "actionable" from "waiting" content — a "waiting for others…" message scrolls into view exactly like a comment form or a submit button would, per product decision. It does not apply to `JoinScreen`/`AuthScreen` (pre-game, already single-focus) or to nested internal scroll widgets (comment checklists, leaderboards) — only the page-level container scrolls.

## Trigger key

Each phase component computes a short string/value — the **trigger key** — from exactly the state that determines what's currently showing for this viewer, and nothing else (specifically not list contents, so a new comment arriving doesn't cause a re-scroll). General formula: `${roundOrStageIdentifier}:${role}:${subStateFlags...}`.

Example for mirror's `ActivePhase`: `${round.roundNumber}:${role}:${commentsVisible}:${pointsGiven}`, where `role` is `admin` | `target` | `other`. Each phase component (across all three modes, both platforms) defines its own key from its own relevant fields, following this same rule — the exact field lists are enumerated per component in the implementation plan, not here.

The hook scrolls to the current target exactly once per distinct key value: re-renders that don't change the key (e.g. a new comment arriving, a score updating) do not re-trigger a scroll. The key changing — including going from "no previous key" on first mount — does trigger it, so loading straight into an in-progress round scrolls to the relevant section immediately.

## Architecture

One small reusable hook per platform, with the same call shape everywhere: wrap the current section in a ref/component, pass the trigger key, done.

**Web (`apps/web/src/hooks/useScrollIntoViewOnChange.ts`, new file):** wraps the native `Element.scrollIntoView({ behavior: 'smooth', block: 'center' })`. No new dependency — this API is universally supported in the browsers this app targets. `block: 'center'` avoids the app's fixed bottom tab bar (`apps/web/src/App.tsx`) overlapping the target on either edge.

```ts
function useScrollIntoViewOnChange<T extends HTMLElement>(triggerKey: string | number) {
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

Usage in a phase component: `const scrollRef = useScrollIntoViewOnChange(triggerKey); return <div ref={scrollRef}>...</div>;`

**Expo (`apps/expo/utils/scrollIntoView.tsx` or similar, new file/wiring):** uses the `react-native-scroll-into-view` package (new dependency — pure JS, no native code, last published 2021 but peer-deps are unpinned `"*"` and it claims full Expo compatibility; flag during implementation if anything about it feels off). The app's outer `ScrollView` (in `GameScreen.tsx`) is wrapped once via `wrapScrollView(ScrollView)`; each phase component's current section is wrapped in `<ScrollIntoView enabled={...} align="center" insets={{ bottom: TAB_BAR_HEIGHT }}>`, toggling `enabled`/re-mounting on trigger-key change to fire the scroll once per key, matching the same "once per key" contract as the web hook.

Exact per-component code (which section each phase wraps, and each key's exact field list) is determined per file in the implementation plan — this doc defines the shared mechanism and the rule for applying it, not a line-by-line enumeration across ~20 components.

## Edge cases

- **Initial mount:** counts as a key change (no previous key), so it fires — loading into an active game scrolls to the relevant section immediately.
- **Idempotency:** re-renders with an unchanged key never re-fire, even across React's render batching.
- **Unmount/rapid transitions:** the web hook's ref-based guard means a stale scroll never fires after unmount (no ref = no-op). The Expo library handles its own lifecycle; the implementation should confirm it doesn't leak timers across fast phase transitions.
- **Not yet mounted:** if the target ref isn't attached when the key changes (rare, since the key only changes after the section renders), the scroll silently no-ops rather than erroring.

## Testing

- **Expo:** the shared hook/wrapper's "fires once per key change, not on incidental re-renders" behavior gets a real unit test (mocking the library's scroll call), consistent with this app's existing Jest suite.
- **Web:** no test runner exists in this package (established during the prior two features) — verified via `tsc --noEmit` plus manual browser walkthrough.
- **Per-component wiring:** given the number of phase components (mirror/basket/clash × writing/guessing/results-style phases × 2 platforms), exhaustively unit-testing every component's exact trigger-key wiring isn't proportionate. The shared mechanism gets real test coverage; each phase's wiring gets a manual verification pass per stage — same verification depth as the admin-checklist and player-numbering work already shipped this session.

## Out of scope

- `JoinScreen` / `AuthScreen` (pre-game screens).
- Nested internal scroll containers (comment checklists, leaderboards) — page-level scroll only.
- Any change to existing scroll behavior of those internal widgets.
