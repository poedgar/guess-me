# One-Time Pulse Animation on the Active Section (Expo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In `apps/expo`, play a brief, one-time accent-color border pulse on the section that just auto-scrolled into view, at the same moment the scroll fires — reusing the same trigger keys already passed to each `<ScrollIntoView>` (or a deliberately coarser version of them where the fine-grained state isn't cheaply available before an early-return guard — see Global Constraints).

**Architecture:** A new hook, `usePulseBorderOnChange(triggerKey, color)`, built on React Native's built-in `Animated` API (no new dependency), returns an animated border style (`{ borderWidth: 2, borderRadius: 12, borderColor: <interpolated Animated value> }`). Every site currently wrapped in `<ScrollIntoView>` (from the auto-scroll feature) gets a new `<Animated.View style={pulse}>` inserted as the sole child of that `<ScrollIntoView>`, wrapping the existing content unchanged. Because this hook uses real `useRef`/`useState`/`useEffect` calls (unlike `<ScrollIntoView>`, which is a plain component), every call must be placed unconditionally, before any early-return guard in its component — the same Rules-of-Hooks constraint the auto-scroll feature's web implementation violated and fixed during its final review.

**Tech Stack:** React Native's built-in `Animated` API, `AccessibilityInfo.isReduceMotionEnabled()`. TypeScript (strict). Jest + `@testing-library/react-native` (real test suite — the hook gets a real unit test).

## Global Constraints

- Scope is `apps/expo` only (a companion plan, `docs/superpowers/plans/2026-07-30-active-section-pulse-animation-web.md`, covers `apps/web`).
- Every `usePulseBorderOnChange` call must be placed **before** any early-return guard in its component (`if (!x) return null;`), with a trigger-key expression that's safe to evaluate even when that guarded value is still null/undefined. Where the auto-scroll feature's existing `scrollIntoViewKey` for the same section already uses fine-grained state that's only computed *after* such a guard (`BasketGuessingPhase.tsx`, `ClashGuessingPhase.tsx`), this plan deliberately uses a coarser key for the pulse only (typically just the round index, sometimes plus the group letter) rather than duplicating that derived-state logic ahead of its natural computation point. The scroll itself is unaffected — only the pulse's re-trigger granularity is coarser in those two files. This is called out explicitly in each affected task step; do not "fix" it to match the scroll key exactly, and do not apply this simplification anywhere the full key is cheaply available (every other file in this plan uses the full, matching key).
- The border is always present at `borderWidth: 2` (transparent when not pulsing) so it never causes a layout shift when the color animates in/out.
- The pulse is skipped entirely (not softened) when `AccessibilityInfo.isReduceMotionEnabled()` resolves `true`.
- Duration ~900ms, using `useNativeDriver: false` (color interpolation isn't supported by the native driver).
- Each site's pulse color is one of the existing `GameColors` constants (`apps/expo/constants/theme.ts`) already used for that section's own accent — see the color mapping in each task.
- Strict TypeScript, no `any` without justification.
- Run test commands from `apps/expo/` (`cd apps/expo` first). If `node`/`npx`/`npm` aren't on PATH, `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"` first.
- **Known pre-existing test baseline (not yours to fix):** re-verify the current count before starting (Task 1, Step 1) — as of the auto-scroll feature's last commit it was 30 failed / 281 passed suite-wide, all confirmed pre-existing and unrelated via prior isolated-worktree comparisons.

---

## Task 1: The `usePulseBorderOnChange` hook

**Files:**
- Create: `apps/expo/hooks/usePulseBorderOnChange.ts`
- Test: `apps/expo/__tests__/usePulseBorderOnChange.test.ts`

**Interfaces:**
- Produces: `usePulseBorderOnChange(triggerKey: string | number, color: string): { borderWidth: number; borderRadius: number; borderColor: Animated.AnimatedInterpolation<string> }` — spread this object into an `Animated.View`'s `style` prop (as an array element, e.g. `style={[existingStyle, pulse]}` or `style={pulse}` if there's no existing style). Every later task in this plan calls this hook and consumes its return value this way.

- [ ] **Step 1: Confirm the baseline**

```bash
cd apps/expo
npm test 2>&1 | tail -10
```

Note the current failing-test count — compare against the ~30 failed / 281 passed baseline documented in Global Constraints. Record what you see now so later steps can tell "pre-existing" from "I broke this."

- [ ] **Step 2: Write the failing test**

Create `apps/expo/__tests__/usePulseBorderOnChange.test.ts`:

```ts
// TDD: usePulseBorderOnChange fires the border animation once per distinct
// triggerKey value, and skips it entirely when reduced motion is enabled.
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { usePulseBorderOnChange } from '../hooks/usePulseBorderOnChange';

let mockReduceMotionEnabled = false;
jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  return {
    ...actual,
    AccessibilityInfo: {
      ...actual.AccessibilityInfo,
      isReduceMotionEnabled: jest.fn(() => Promise.resolve(mockReduceMotionEnabled)),
    },
  };
});

describe('usePulseBorderOnChange', () => {
  beforeEach(() => {
    mockReduceMotionEnabled = false;
    jest.spyOn(Animated, 'timing');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts the animation once when triggerKey first appears', async () => {
    const { result } = renderHook(() => usePulseBorderOnChange('round-1:admin', '#34C759'));

    await waitFor(() => {
      expect(Animated.timing).toHaveBeenCalledTimes(1);
    });

    expect(result.current.borderWidth).toBe(2);
    expect(result.current.borderRadius).toBe(12);
    expect(result.current.borderColor).toBeDefined();
  });

  it('does not re-fire when triggerKey is unchanged across re-renders', async () => {
    const { rerender } = renderHook(
      ({ key }) => usePulseBorderOnChange(key, '#34C759'),
      { initialProps: { key: 'round-1:admin' } },
    );

    await waitFor(() => {
      expect(Animated.timing).toHaveBeenCalledTimes(1);
    });

    rerender({ key: 'round-1:admin' });
    rerender({ key: 'round-1:admin' });

    expect(Animated.timing).toHaveBeenCalledTimes(1);
  });

  it('fires again when triggerKey changes', async () => {
    const { rerender } = renderHook(
      ({ key }) => usePulseBorderOnChange(key, '#34C759'),
      { initialProps: { key: 'round-1:admin' } },
    );

    await waitFor(() => {
      expect(Animated.timing).toHaveBeenCalledTimes(1);
    });

    act(() => {
      rerender({ key: 'round-2:admin' });
    });

    await waitFor(() => {
      expect(Animated.timing).toHaveBeenCalledTimes(2);
    });
  });

  it('does not start the animation when reduced motion is enabled', async () => {
    mockReduceMotionEnabled = true;
    renderHook(() => usePulseBorderOnChange('round-1:admin', '#34C759'));

    // Give the isReduceMotionEnabled() promise a tick to resolve, then confirm
    // no animation was ever started.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(Animated.timing).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

```bash
npm test -- __tests__/usePulseBorderOnChange.test.ts
```

Expected: FAIL — the hook module doesn't exist yet.

- [ ] **Step 4: Implement the hook**

Create `apps/expo/hooks/usePulseBorderOnChange.ts`:

```ts
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated } from 'react-native';

/**
 * Returns an animated border style to spread onto an Animated.View's style
 * array. Animates the border color from `color` to transparent once
 * whenever triggerKey changes (including on first mount), and never
 * re-fires for a re-render with the same key. No-ops (border stays
 * transparent) when the OS has reduced motion enabled. borderWidth is
 * always present, even when transparent, so the border never causes a
 * layout shift when it appears/disappears.
 */
export function usePulseBorderOnChange(triggerKey: string | number, color: string) {
  const progress = useRef(new Animated.Value(0)).current;
  const lastKey = useRef<string | number | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (lastKey.current === triggerKey) return;
    lastKey.current = triggerKey;
    if (reduceMotion) return;
    progress.setValue(1);
    Animated.timing(progress, {
      toValue: 0,
      duration: 900,
      useNativeDriver: false,
    }).start();
  }, [triggerKey, reduceMotion]);

  return {
    borderWidth: 2,
    borderRadius: 12,
    borderColor: progress.interpolate({
      inputRange: [0, 1],
      outputRange: ['transparent', color],
    }),
  };
}
```

- [ ] **Step 5: Run the test again and confirm it passes**

```bash
npm test -- __tests__/usePulseBorderOnChange.test.ts
```

Expected: PASS, all four tests.

- [ ] **Step 6: Commit**

```bash
git add apps/expo/hooks/usePulseBorderOnChange.ts apps/expo/__tests__/usePulseBorderOnChange.test.ts
git commit -m "$(cat <<'EOF'
Add usePulseBorderOnChange hook for Expo

Animates a border color from a given accent color to transparent once
per distinct trigger-key value, using React Native's built-in Animated
API. Skips the animation when the OS has reduced motion enabled.
EOF
)"
```

---

## Task 2: Wire mirror mode (and the shared waiting/results screens)

**Files:**
- Modify: `apps/expo/components/game/mirror/WaitingPhase.tsx`
- Modify: `apps/expo/components/game/mirror/ActivePhase.tsx`
- Modify: `apps/expo/components/game/mirror/GuessingPhase.tsx`
- Modify: `apps/expo/components/game/mirror/ResultsPhase.tsx`

**Interfaces:**
- Consumes: `usePulseBorderOnChange(triggerKey, color)` (Task 1).

`WaitingPhase.tsx` and `ResultsPhase.tsx` are shared by all three game modes — wiring them here also covers basket's and clash's waiting/results stages.

- [ ] **Step 1: `WaitingPhase.tsx`**

This file has no early-return guard, so hook placement is flexible. Add the import (after the existing `SCROLL_INSETS` import):

```ts
import { Animated } from 'react-native';
import { usePulseBorderOnChange } from '@/hooks/usePulseBorderOnChange';
```

Note: `Animated` needs to be added to the existing `react-native` import list too — that list currently reads:

```ts
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
```

Change it to:

```ts
import {
  ActivityIndicator,
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
```

(Remove the separate `import { Animated } from 'react-native';` line you added above — it belongs merged into this list instead. Only one `react-native` import statement should exist in the file.)

After the existing `const isMounted = useRef(true);` / `useEffect` pair, add:

```ts
  const clashSetupPulse = usePulseBorderOnChange(`clashSetup:${game.gameType}`, GameColors.admin);
  const waitingPulse = usePulseBorderOnChange(`${isAdmin}:${game.gameType ?? 'mirror'}`, GameColors.admin);
```

The clash-setup wrap currently reads:

```tsx
      {/* Clash group setup */}
      {isAdmin && game.gameType === 'clash' && (
        <ScrollIntoView
          enabled
          scrollIntoViewKey={`clashSetup:${game.gameType}`}
          align="center"
          animated
          insets={SCROLL_INSETS}
        >
          <ClashSetupPanel
            game={game}
            locale={locale}
            isDark={isDark}
            getDisplayName={getDisplayName}
            isAdmin={isAdmin}
            showFancyAlert={showFancyAlert}
          />
        </ScrollIntoView>
      )}
```

Change it to:

```tsx
      {/* Clash group setup */}
      {isAdmin && game.gameType === 'clash' && (
        <ScrollIntoView
          enabled
          scrollIntoViewKey={`clashSetup:${game.gameType}`}
          align="center"
          animated
          insets={SCROLL_INSETS}
        >
          <Animated.View style={clashSetupPulse}>
            <ClashSetupPanel
              game={game}
              locale={locale}
              isDark={isDark}
              getDisplayName={getDisplayName}
              isAdmin={isAdmin}
              showFancyAlert={showFancyAlert}
            />
          </Animated.View>
        </ScrollIntoView>
      )}
```

The main Start/Waiting wrap currently reads:

```tsx
      <ScrollIntoView
        enabled={!(isAdmin && game.gameType === 'clash')}
        scrollIntoViewKey={`${isAdmin}:${game.gameType ?? 'mirror'}`}
        align="center"
        animated
        insets={SCROLL_INSETS}
      >
        <View style={gameStyles.gameFlowContainer}>
```

Change it to:

```tsx
      <ScrollIntoView
        enabled={!(isAdmin && game.gameType === 'clash')}
        scrollIntoViewKey={`${isAdmin}:${game.gameType ?? 'mirror'}`}
        align="center"
        animated
        insets={SCROLL_INSETS}
      >
        <Animated.View style={[gameStyles.gameFlowContainer, waitingPulse]}>
```

And its closing tag currently reads:

```tsx
          {!isAdmin && (
            <ThemedText style={styles.waitingText}>
              {t('game.ui.waitingForAdminStart', { locale })}
            </ThemedText>
          )}
        </View>
      </ScrollIntoView>
    </View>
  );
};
```

Change it to:

```tsx
          {!isAdmin && (
            <ThemedText style={styles.waitingText}>
              {t('game.ui.waitingForAdminStart', { locale })}
            </ThemedText>
          )}
        </Animated.View>
      </ScrollIntoView>
    </View>
  );
};
```

- [ ] **Step 2: `ActivePhase.tsx`**

This file has an early-return guard (`if (!game.currentRound) return null;`) — the three hooks below must be added **before** it. Add the import (after the existing `SCROLL_INSETS` import):

```ts
import { usePulseBorderOnChange } from '@/hooks/usePulseBorderOnChange';
```

`Animated` needs to be added to the existing `react-native` import list, which currently reads:

```ts
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
```

Change it to:

```ts
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
```

The component currently reads (near the end, just before the early-return guard):

```ts
  const handleStartGuessingPhase = () => {
    if (!isAdmin) return;
    if (!game.currentRound?.pointsGiven) {
      Alert.alert(
        t('game.ui.forceStartGuessingTitle', { locale }),
        t('game.ui.forceStartGuessingMessage', { locale }),
        [
          { text: t('common.cancel', { locale }), style: 'cancel' },
          { text: t('game.ui.startAnyway', { locale }), onPress: () => { void doStartGuessingPhase(); } },
        ]
      );
      return;
    }
    void doStartGuessingPhase();
  };

  if (!game.currentRound) return null;
```

Change it to:

```ts
  const handleStartGuessingPhase = () => {
    if (!isAdmin) return;
    if (!game.currentRound?.pointsGiven) {
      Alert.alert(
        t('game.ui.forceStartGuessingTitle', { locale }),
        t('game.ui.forceStartGuessingMessage', { locale }),
        [
          { text: t('common.cancel', { locale }), style: 'cancel' },
          { text: t('game.ui.startAnyway', { locale }), onPress: () => { void doStartGuessingPhase(); } },
        ]
      );
      return;
    }
    void doStartGuessingPhase();
  };

  const adminPulse = usePulseBorderOnChange(
    `${game.currentRound?.roundNumber ?? 'none'}:admin:${game.currentRound?.commentsVisible ?? false}`,
    GameColors.green,
  );
  const targetPulse = usePulseBorderOnChange(
    `${game.currentRound?.roundNumber ?? 'none'}:target:${game.currentRound?.commentsVisible ?? false}:${game.currentRound?.pointsGiven ?? false}`,
    GameColors.green,
  );
  const otherPulse = usePulseBorderOnChange(
    `${game.currentRound?.roundNumber ?? 'none'}:other:${game.currentRound?.commentsVisible ?? false}:${game.currentRound?.pointsGiven ?? false}`,
    GameColors.green,
  );

  if (!game.currentRound) return null;
```

The admin block's opening `<View>` currently reads:

```tsx
          <View style={styles.adminControls}>
```

Change it to:

```tsx
          <Animated.View style={[styles.adminControls, adminPulse]}>
```

Its closing — currently:

```tsx
            </View>
          </View>
          </ScrollIntoView>
        )}

        {/* User is the target */}
```

Change it to (only the second-to-last `</View>` — the one closing `adminControls` — becomes `</Animated.View>`; the first `</View>` closes the nested `adminButtonsRow` and is unchanged):

```tsx
            </View>
          </Animated.View>
          </ScrollIntoView>
        )}

        {/* User is the target */}
```

The target block's opening `<View>` currently reads:

```tsx
          <View style={styles.targetView}>
```

Change it to:

```tsx
          <Animated.View style={[styles.targetView, targetPulse]}>
```

Its closing — currently:

```tsx
            )}
          </View>
          </ScrollIntoView>
        )}

        {/* User is not the target */}
```

Change it to:

```tsx
            )}
          </Animated.View>
          </ScrollIntoView>
        )}

        {/* User is not the target */}
```

The non-target block's opening `<View>` currently reads:

```tsx
          <View style={styles.commentView}>
```

Change it to:

```tsx
          <Animated.View style={[styles.commentView, otherPulse]}>
```

Its closing — currently:

```tsx
            })()}
          </View>
          </ScrollIntoView>
        )}
      </View>

      {/* Post-Guessing Point Phase (when active during active status) */}
```

Change it to:

```tsx
            })()}
          </Animated.View>
          </ScrollIntoView>
        )}
      </View>

      {/* Post-Guessing Point Phase (when active during active status) */}
```

- [ ] **Step 3: `GuessingPhase.tsx`**

This file has an early-return guard (`if (!game.guessingData) return null;`), but the two hooks below can reuse the file's existing pre-guard `singleTargetId`/`targetSubmitted` constants directly — they're already computed before the guard. Add the import (after the existing `SCROLL_INSETS` import):

```ts
import { usePulseBorderOnChange } from '@/hooks/usePulseBorderOnChange';
```

`Animated` needs to be added to the existing `react-native` import list, which currently reads:

```ts
import {
    ActivityIndicator,
    Alert,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
```

Change it to:

```ts
import {
    ActivityIndicator,
    Alert,
    Animated,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
```

The component currently reads (just before its early-return guard):

```ts
  if (!game.guessingData) return null;

  return (
```

Change it to:

```ts
  const playerPulse = usePulseBorderOnChange(
    `${singleTargetId ?? 'legacy'}:${hasSubmittedGuesses || (game.guessingData?.playersWhoSubmittedGuesses?.includes(user?.uid || '') ?? false)}`,
    GameColors.purple,
  );
  const adminPulse = usePulseBorderOnChange(
    `${singleTargetId ?? 'legacy'}:${targetSubmitted}:${game.guessingData?.allPlayersSubmitted ?? false}`,
    GameColors.purple,
  );

  if (!game.guessingData) return null;

  return (
```

The player block currently reads:

```tsx
        <ScrollIntoView
          enabled
          scrollIntoViewKey={`${singleTargetId ?? 'legacy'}:${hasSubmittedGuesses || game.guessingData.playersWhoSubmittedGuesses?.includes(user?.uid || '')}`}
          align="top"
          animated
          insets={SCROLL_INSETS}
        >
        {(hasSubmittedGuesses || game.guessingData.playersWhoSubmittedGuesses?.includes(user?.uid || '')) ? (
```

Change it to:

```tsx
        <ScrollIntoView
          enabled
          scrollIntoViewKey={`${singleTargetId ?? 'legacy'}:${hasSubmittedGuesses || game.guessingData.playersWhoSubmittedGuesses?.includes(user?.uid || '')}`}
          align="top"
          animated
          insets={SCROLL_INSETS}
        >
        <Animated.View style={playerPulse}>
        {(hasSubmittedGuesses || game.guessingData.playersWhoSubmittedGuesses?.includes(user?.uid || '')) ? (
```

Its closing — currently:

```tsx
          )
        )}
        </ScrollIntoView>

        {/* Admin Target Control */}
```

Change it to:

```tsx
          )
        )}
        </Animated.View>
        </ScrollIntoView>

        {/* Admin Target Control */}
```

The admin block's opening currently reads:

```tsx
          <ScrollIntoView
            enabled
            scrollIntoViewKey={`${singleTargetId ?? 'legacy'}:${targetSubmitted}:${game.guessingData.allPlayersSubmitted}`}
            align="center"
            animated
            insets={SCROLL_INSETS}
          >
          {(() => {
            if (singleTargetId && targetSubmitted) {
```

Change it to:

```tsx
          <ScrollIntoView
            enabled
            scrollIntoViewKey={`${singleTargetId ?? 'legacy'}:${targetSubmitted}:${game.guessingData.allPlayersSubmitted}`}
            align="center"
            animated
            insets={SCROLL_INSETS}
          >
          <Animated.View style={adminPulse}>
          {(() => {
            if (singleTargetId && targetSubmitted) {
```

Its closing — currently:

```tsx
          })()}
          </ScrollIntoView>
        )}
      </View>

      {/* Post-Guessing Point Panel */}
```

Change it to:

```tsx
          })()}
          </Animated.View>
          </ScrollIntoView>
        )}
      </View>

      {/* Post-Guessing Point Panel */}
```

- [ ] **Step 4: `ResultsPhase.tsx`**

This file has no early-return guard. Add the import (after the existing `SCROLL_INSETS` import):

```ts
import { usePulseBorderOnChange } from '@/hooks/usePulseBorderOnChange';
```

`Animated` needs to be added to the existing `react-native` import, which currently reads:

```ts
import { StyleSheet, View } from 'react-native';
```

Change it to:

```ts
import { Animated, StyleSheet, View } from 'react-native';
```

After the existing `calculateSimilarPairs(...)` call, add:

```ts
  const pulse = usePulseBorderOnChange(`finished:${!!game.adminLeft}`, GameColors.gold);
```

The return statement currently reads:

```tsx
  return (
    <ScrollIntoView
      enabled
      scrollIntoViewKey={`finished:${!!game.adminLeft}`}
      align="center"
      animated
      insets={SCROLL_INSETS}
    >
    <View style={[gameStyles.gameFlowContainer, styles.phaseWrapper]}>
```

Change it to:

```tsx
  return (
    <ScrollIntoView
      enabled
      scrollIntoViewKey={`finished:${!!game.adminLeft}`}
      align="center"
      animated
      insets={SCROLL_INSETS}
    >
    <Animated.View style={[gameStyles.gameFlowContainer, styles.phaseWrapper, pulse]}>
```

And its closing — currently:

```tsx
    </View>
    </ScrollIntoView>
  );
};
```

Change it to:

```tsx
    </Animated.View>
    </ScrollIntoView>
  );
};
```

- [ ] **Step 5: Verify**

```bash
npm test -- __tests__/ActivePhase.test.tsx __tests__/GuessingPhase.test.tsx __tests__/WaitingPhase.test.tsx __tests__/Results.test.tsx
```

Confirm no new failures beyond the Task 1 Step 1 baseline (existing tests query rendered text/labels, not style props, so wrapping in `Animated.View` shouldn't change any existing assertion).

Then, on a device/simulator, manually verify with a 3-participant mirror game: confirm each section that auto-scrolls into view also briefly flashes a green border glow (orange for the waiting-room start button, gold at game end), fires only once per transition, and is suppressed with "reduce motion" enabled in device accessibility settings.

- [ ] **Step 6: Commit**

```bash
git add apps/expo/components/game/mirror/WaitingPhase.tsx apps/expo/components/game/mirror/ActivePhase.tsx apps/expo/components/game/mirror/GuessingPhase.tsx apps/expo/components/game/mirror/ResultsPhase.tsx
git commit -m "$(cat <<'EOF'
Add one-time pulse animation to mirror mode's active sections (Expo)

Wraps each ScrollIntoView-wrapped section in an Animated.View carrying
usePulseBorderOnChange's animated border style, keyed off the same
trigger as the existing scroll (with null-safe expressions since these
are real hook calls, placed before each component's early-return guard).
WaitingPhase and ResultsPhase are shared by all three game modes, so
this also covers basket's and clash's waiting/results stages.
EOF
)"
```

---

## Task 3: Wire basket mode

**Files:**
- Modify: `apps/expo/components/game/basket/BasketWritingPhase.tsx`
- Modify: `apps/expo/components/game/basket/BasketGuessingPhase.tsx`

**Interfaces:**
- Consumes: `usePulseBorderOnChange(triggerKey, color)` (Task 1).

- [ ] **Step 1: `BasketWritingPhase.tsx`**

This file has no early-return guard (`game.basketData!` non-null assertion, no `if` guard) — hook placement is flexible; the file's existing `currentRoundIndex`/`alreadySubmitted`/`submittedCount`/`totalCount` are all already computed unconditionally, safe to reuse directly with full fidelity. Add the import (after the existing `SCROLL_INSETS` import):

```ts
import { usePulseBorderOnChange } from '@/hooks/usePulseBorderOnChange';
```

`Animated` needs to be added to the existing `react-native` import, which currently reads:

```ts
import { ActivityIndicator, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
```

Change it to:

```ts
import { ActivityIndicator, Animated, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
```

After the existing `const totalCount = ...` line, add:

```ts
  const playerPulse = usePulseBorderOnChange(`${currentRoundIndex}:${alreadySubmitted}`, GameColors.blue);
  const adminPulse = usePulseBorderOnChange(`${currentRoundIndex}:${submittedCount >= totalCount}`, GameColors.blue);
```

The player block currently reads:

```tsx
        <ScrollIntoView
          enabled
          scrollIntoViewKey={`${currentRoundIndex}:${alreadySubmitted}`}
          align="center"
          animated
          insets={SCROLL_INSETS}
        >
        {alreadySubmitted ? (
```

Change it to:

```tsx
        <ScrollIntoView
          enabled
          scrollIntoViewKey={`${currentRoundIndex}:${alreadySubmitted}`}
          align="center"
          animated
          insets={SCROLL_INSETS}
        >
        <Animated.View style={playerPulse}>
        {alreadySubmitted ? (
```

Its closing — currently:

```tsx
          </View>
        )}
        </ScrollIntoView>

        {isAdmin && (
```

Change it to:

```tsx
          </View>
        )}
        </Animated.View>
        </ScrollIntoView>

        {isAdmin && (
```

The admin block's opening `<View>` currently reads:

```tsx
          <View style={styles.adminSection}>
```

Change it to:

```tsx
          <Animated.View style={[styles.adminSection, adminPulse]}>
```

Its closing — currently:

```tsx
            </TouchableOpacity>
          </View>
          </ScrollIntoView>
        )}
      </View>
    </View>
  );
};
```

Change it to:

```tsx
            </TouchableOpacity>
          </Animated.View>
          </ScrollIntoView>
        )}
      </View>
    </View>
  );
};
```

- [ ] **Step 2: `BasketGuessingPhase.tsx`**

This file **has** an early-return guard (`if (!game.basketData) return null;`), and the fine-grained sub-state (`isDone`, `showWrong`, `showAuthorPrompt`, `allGuessersDone`) is computed *after* it — per Global Constraints, use a coarser, round-index-only key for the pulse here (the scroll itself keeps its existing, full-fidelity key unchanged). Add the import (after the existing `SCROLL_INSETS` import):

```ts
import { usePulseBorderOnChange } from '@/hooks/usePulseBorderOnChange';
```

`Animated` needs to be added to the existing `react-native` import, which currently reads:

```ts
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
```

Change it to:

```ts
import {
  ActivityIndicator,
  Animated,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
```

The component currently reads (just before its early-return guard):

```ts
  if (!game.basketData) return null;
  const {
```

Change it to:

```ts
  const playerPulse = usePulseBorderOnChange(`${game.basketData?.currentRoundIndex ?? 0}`, GameColors.purple);
  const adminPulse = usePulseBorderOnChange(`${game.basketData?.currentRoundIndex ?? 0}`, GameColors.purple);

  if (!game.basketData) return null;
  const {
```

The player block currently reads:

```tsx
        <ScrollIntoView
          enabled
          scrollIntoViewKey={`${currentRoundIndex}:${isDone || showWrong}:${showAuthorPrompt}`}
          align="center"
          animated
          insets={SCROLL_INSETS}
        >
        {isDone || showWrong ? (
```

Change it to:

```tsx
        <ScrollIntoView
          enabled
          scrollIntoViewKey={`${currentRoundIndex}:${isDone || showWrong}:${showAuthorPrompt}`}
          align="center"
          animated
          insets={SCROLL_INSETS}
        >
        <Animated.View style={playerPulse}>
        {isDone || showWrong ? (
```

Its closing — currently:

```tsx
          </View>
        )}
        </ScrollIntoView>

        {isAdmin && (
```

Change it to:

```tsx
          </View>
        )}
        </Animated.View>
        </ScrollIntoView>

        {isAdmin && (
```

The admin block's opening `<View>` currently reads:

```tsx
          <View style={styles.adminSection}>
```

Change it to:

```tsx
          <Animated.View style={[styles.adminSection, adminPulse]}>
```

Its closing — currently:

```tsx
            </TouchableOpacity>
          </View>
          </ScrollIntoView>
        )}
      </View>
    </View>
  );
};
```

Change it to:

```tsx
            </TouchableOpacity>
          </Animated.View>
          </ScrollIntoView>
        )}
      </View>
    </View>
  );
};
```

- [ ] **Step 3: Verify**

```bash
npm test -- __tests__/BasketWritingPhase.test.tsx __tests__/BasketGuessingPhase.test.tsx
```

Confirm no new failures beyond baseline (the 5 pre-existing `BasketGuessingPhase.test.tsx` failures documented in the auto-scroll plan's history are expected, unrelated to this change).

Then manually verify with a 3-participant basket game: confirm a brief blue border pulse accompanies the scroll during the writing phase, and a brief purple pulse during the guessing phase, for both the player-facing and admin sections.

- [ ] **Step 4: Commit**

```bash
git add apps/expo/components/game/basket/BasketWritingPhase.tsx apps/expo/components/game/basket/BasketGuessingPhase.tsx
git commit -m "$(cat <<'EOF'
Add one-time pulse animation to basket mode's active sections (Expo)

BasketWritingPhase uses the full scroll-matching trigger key (no early
guard in that file); BasketGuessingPhase uses a coarser round-index-only
key for the pulse since its fine-grained sub-state is only available
after this file's early-return guard — the scroll itself is unaffected.
EOF
)"
```

---

## Task 4: Wire clash mode

**Files:**
- Modify: `apps/expo/components/game/clash/ClashWritingPhase.tsx`
- Modify: `apps/expo/components/game/clash/ClashGuessingPhase.tsx`

**Interfaces:**
- Consumes: `usePulseBorderOnChange(triggerKey, color)` (Task 1).

- [ ] **Step 1: `ClashWritingPhase.tsx`**

This file has no early-return guard (`game.clashData!` non-null assertion, no `if` guard) — the file's existing `currentRoundIndex`/`alreadySubmitted`/`allSubmitted` are already computed unconditionally, safe to reuse directly with full fidelity. Add the import (after the existing `SCROLL_INSETS` import):

```ts
import { usePulseBorderOnChange } from '@/hooks/usePulseBorderOnChange';
```

`Animated` needs to be added to the existing `react-native` import, which currently reads:

```ts
import { ActivityIndicator, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
```

Change it to:

```ts
import { ActivityIndicator, Animated, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
```

After the existing `const allSubmitted = ...` line, add:

```ts
  const playerPulse = usePulseBorderOnChange(`${currentRoundIndex}:${alreadySubmitted}`, GameColors.admin);
  const adminPulse = usePulseBorderOnChange(`${currentRoundIndex}:${allSubmitted}`, GameColors.admin);
```

The player block currently reads:

```tsx
        <ScrollIntoView
          enabled
          scrollIntoViewKey={`${currentRoundIndex}:${alreadySubmitted}`}
          align="center"
          animated
          insets={SCROLL_INSETS}
        >
        {alreadySubmitted ? (
```

Change it to:

```tsx
        <ScrollIntoView
          enabled
          scrollIntoViewKey={`${currentRoundIndex}:${alreadySubmitted}`}
          align="center"
          animated
          insets={SCROLL_INSETS}
        >
        <Animated.View style={playerPulse}>
        {alreadySubmitted ? (
```

Its closing — currently:

```tsx
          </View>
        )}
        </ScrollIntoView>

        {isAdmin && (
```

Change it to:

```tsx
          </View>
        )}
        </Animated.View>
        </ScrollIntoView>

        {isAdmin && (
```

The admin block's opening `<View>` currently reads:

```tsx
          <View style={styles.adminSection}>
            <ClashScoreboard scoreA={teamScores.a} scoreB={teamScores.b} locale={locale} />
```

Change it to:

```tsx
          <Animated.View style={[styles.adminSection, adminPulse]}>
            <ClashScoreboard scoreA={teamScores.a} scoreB={teamScores.b} locale={locale} />
```

Its closing — currently:

```tsx
            </TouchableOpacity>
          </View>
          </ScrollIntoView>
        )}
      </View>
    </View>
  );
};
```

Change it to:

```tsx
            </TouchableOpacity>
          </Animated.View>
          </ScrollIntoView>
        )}
      </View>
    </View>
  );
};
```

- [ ] **Step 2: `ClashGuessingPhase.tsx`**

This file **has** an early-return guard (`if (!game.clashData) return null;`), and `currentRoundIndex`/`currentGroup`/`isActiveLeader`/`currentGroupDone` are all computed *after* it — per Global Constraints, use a coarser key (round index + group letter, dropping the leader/done booleans) for the pulse here; the scroll itself keeps its existing, full-fidelity key unchanged. Add the import (after the existing `SCROLL_INSETS` import):

```ts
import { usePulseBorderOnChange } from '@/hooks/usePulseBorderOnChange';
```

`Animated` needs to be added to the existing `react-native` import, which currently reads:

```ts
import { ActivityIndicator, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
```

Change it to:

```ts
import { ActivityIndicator, Animated, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
```

The component currently reads (just before its early-return guard):

```ts
  if (!game.clashData) return null;
  const cd = game.clashData;
```

Change it to:

```ts
  const playerPulse = usePulseBorderOnChange(
    `${game.clashData?.currentRoundIndex ?? 0}:${game.clashData?.currentGuessingGroup ?? 'none'}`,
    GameColors.danger,
  );
  const adminPulse = usePulseBorderOnChange(
    `${game.clashData?.currentRoundIndex ?? 0}:${game.clashData?.currentGuessingGroup ?? 'none'}`,
    GameColors.danger,
  );

  if (!game.clashData) return null;
  const cd = game.clashData;
```

The player block currently reads:

```tsx
        <ScrollIntoView
          enabled
          scrollIntoViewKey={`${currentRoundIndex}:${currentGroup}:${isActiveLeader}`}
          align="top"
          animated
          insets={SCROLL_INSETS}
        >
        {!isActiveLeader ? (
```

Change it to:

```tsx
        <ScrollIntoView
          enabled
          scrollIntoViewKey={`${currentRoundIndex}:${currentGroup}:${isActiveLeader}`}
          align="top"
          animated
          insets={SCROLL_INSETS}
        >
        <Animated.View style={playerPulse}>
        {!isActiveLeader ? (
```

Its closing — currently:

```tsx
            {isSubmitting && <ActivityIndicator style={{ marginTop: 8 }} color={GameColors.blue} />}
          </View>
        )}
        </ScrollIntoView>

        {isAdmin && (
```

Change it to:

```tsx
            {isSubmitting && <ActivityIndicator style={{ marginTop: 8 }} color={GameColors.blue} />}
          </View>
        )}
        </Animated.View>
        </ScrollIntoView>

        {isAdmin && (
```

The admin block's opening `<View>` currently reads:

```tsx
          <View style={styles.adminSection}>
            <TouchableOpacity
```

Change it to:

```tsx
          <Animated.View style={[styles.adminSection, adminPulse]}>
            <TouchableOpacity
```

Its closing — currently:

```tsx
            </TouchableOpacity>
          </View>
          </ScrollIntoView>
        )}
      </View>
    </View>
  );
};
```

Change it to:

```tsx
            </TouchableOpacity>
          </Animated.View>
          </ScrollIntoView>
        )}
      </View>
    </View>
  );
};
```

- [ ] **Step 3: Verify**

```bash
npm test -- __tests__/ClashWritingPhase.test.tsx __tests__/ClashGuessingPhase.test.tsx
```

Confirm no new failures beyond baseline (the 4 pre-existing `ClashGuessingPhase.test.tsx` failures documented in the auto-scroll plan's history are expected, unrelated to this change).

Then manually verify with a 4-participant clash game (2v2): confirm a brief orange border pulse accompanies the scroll during the writing phase, and a brief red/danger-colored pulse during the guessing phase, for both the player-facing and admin sections.

- [ ] **Step 4: Commit**

```bash
git add apps/expo/components/game/clash/ClashWritingPhase.tsx apps/expo/components/game/clash/ClashGuessingPhase.tsx
git commit -m "$(cat <<'EOF'
Add one-time pulse animation to clash mode's active sections (Expo)

ClashWritingPhase uses the full scroll-matching trigger key (no early
guard in that file); ClashGuessingPhase uses a coarser round-index +
group-letter key for the pulse since its fine-grained sub-state is only
available after this file's early-return guard — the scroll itself is
unaffected.
EOF
)"
```
