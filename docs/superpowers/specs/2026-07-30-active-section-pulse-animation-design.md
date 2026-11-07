# One-Time Pulse Animation on the Active Section

**Date:** 2026-07-30
**Scope:** `apps/web` and `apps/expo`, all three game modes (mirror, basket, clash) — the same ~15 wrap sites already wired for the auto-scroll-to-active-section feature (see `docs/superpowers/specs/2026-07-23-auto-scroll-to-active-section-design.md` and its two implementation plans).

## Problem

The auto-scroll feature moves the viewport to the section relevant to the current viewer, but a scroll alone can be easy to miss — especially if the target was already near the visible area and barely moves. A brief, one-time visual cue on arrival makes it unambiguous which part of the screen to look at.

## Behavior

Reuses the auto-scroll feature's existing trigger key verbatim — the same key that fires a scroll (built from round/round-index + role/group + boolean sub-state, changing exactly when the relevant section changes) also fires the pulse, at the same moment, exactly once per distinct key value. No separate "when does this fire" logic exists anywhere in this feature; scroll and pulse are two effects of one trigger.

The pulse borrows each section's own existing accent color (e.g. `game-blue` for a comment form, `game-purple` for a guessing UI) rather than a single fixed color, so it reads as "this card is now active" rather than a generic system flash. Duration is ~900ms on both platforms.

**Accessibility:** on both platforms, the animation is skipped entirely (not softened) when the user has OS-level reduced-motion enabled — consistent with the auto-scroll feature already switching to instant (non-smooth) scrolling in that case.

## Architecture

**Web:** `useScrollIntoViewOnChange` (in `apps/web/src/hooks/useScrollIntoViewOnChange.ts`) is extended — inside its existing effect (the one already guarded by the `lastKey` check, so it still fires exactly once per key change), it also toggles a CSS class on the ref'd element: `ref.current.classList.add('active-section-pulse')`, removed via `setTimeout` after ~900ms. No new hook, no extra re-render. A single `@keyframes pulseGlow` rule (an expanding, fading box-shadow ring) lives in one shared CSS location reused by every wrapped section. The reduced-motion check (`window.matchMedia('(prefers-reduced-motion: reduce)')`, already present in the hook for scroll behavior) also skips adding the pulse class.

**Expo:** a new hook, `usePulseBorderOnChange(triggerKey: string | number)`, in a new file (e.g. `apps/expo/hooks/usePulseBorderOnChange.ts`), built on React Native's built-in `Animated` API (already used in this app — no new dependency). It returns an `Animated.Value` (or an interpolated animated style) that, on trigger-key change, animates a border/outline color from a bright accent to the section's normal border color over ~900ms. Each of the ~15 wrapped sections' plain `<View>` becomes an `<Animated.View>` carrying that animated border style, still nested inside the existing `<ScrollIntoView>` from the auto-scroll feature — this hook only adds the animated border, it does not touch the scroll wiring.

Because `usePulseBorderOnChange` is a genuine React hook (unlike `<ScrollIntoView>`, which is a plain component), it must be called unconditionally, before any early-return guard, in every component that uses it — the exact class of bug the auto-scroll feature's web implementation hit and fixed during its final review. This is a hard constraint on the implementation plan, not a suggestion.

**Reduced motion on Expo:** `AccessibilityInfo.isReduceMotionEnabled()`, checked once per hook instance and cached in state; when true, the hook's effect no-ops (no border animation), matching web's behavior.

## Testing

- **Web:** no test runner in this package (established during prior work) — verified via `tsc --noEmit` plus a manual browser walkthrough per game mode.
- **Expo:** `usePulseBorderOnChange` gets a real unit test — fires once per trigger-key change (not on incidental re-renders), and skips entirely when reduced-motion is enabled — consistent with how this app's other hooks/wrappers were tested.
- Per-section wiring (which `<View>` becomes an `<Animated.View>` with the pulse) is verified manually per game mode, same verification depth as the auto-scroll feature's own per-section wiring.

## Out of scope

- No change to *which* section is targeted, or to the scroll behavior itself — this only adds a visual cue on top of the existing auto-scroll target.
- No new dependency on either platform (web: plain CSS; Expo: RN's built-in `Animated` API, no Reanimated).
- No looping or repeated animation — strictly once per trigger-key change, matching the "one-time" framing of the request.
