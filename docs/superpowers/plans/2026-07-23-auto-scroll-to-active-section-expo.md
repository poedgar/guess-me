# Auto-Scroll to Active Section (Expo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In `apps/expo`, scroll the screen to the section relevant to the current viewer whenever what they should be looking at changes, across all three game modes (mirror, basket, clash), without re-scrolling on incidental data updates.

**Architecture:** Add the `react-native-scroll-into-view` library (confirmed: latest 2.0.2, ships its own TypeScript types at `build/index.d.ts`, no native code, works with any RN/Expo version via unpinned peer deps). Wrap the app's single outer `ScrollView` (in `GameScreen.tsx`) once via `wrapScrollView(ScrollView)`. Each phase component wraps its "current section for this viewer" in the library's `<ScrollIntoView>` component, passing a `scrollIntoViewKey` built from the state that determines which section/sub-state is showing — the library scrolls to that section whenever the key changes ("This will scroll into view whenever scrollIntoViewKey changes" — confirmed from the library's README), and does not need a manually-threaded ref: `wrapScrollView` sets up React Context that any descendant `<ScrollIntoView>` reads automatically, however deep it is in the tree.

**Tech Stack:** React Native, Expo, TypeScript (strict), Jest + `@testing-library/react-native` (real test suite exists — TDD where the plan calls for it). New dependency: `react-native-scroll-into-view`.

## Global Constraints

- Scope is `apps/expo` only (the companion plan, `docs/superpowers/plans/2026-07-23-auto-scroll-to-active-section-web.md`, covers `apps/web`).
- Applies to mirror, basket, and clash modes. Does not apply to `JoinScreen`/`AuthScreen`, or to nested internal scroll widgets — page-level (outer `ScrollView`) scroll only.
- "Scroll to the current relevant section" applies uniformly whether that section is an action or a read-only waiting/status message — no special-casing (per design spec).
- The `scrollIntoViewKey` must be built only from state that determines *which* section/sub-state is showing — never from list contents (e.g. a new comment arriving must not change the key and must not re-trigger a scroll).
- Strict TypeScript, no `any` without justification.
- Run all test commands from `apps/expo/` (`cd apps/expo` first). If `node`/`npx`/`npm` aren't on `PATH`, this repo pins Node via `.nvmrc` (`v22.22.2`).
- **Known pre-existing test baseline (not yours to fix):** as of the last feature shipped in this app, there are pre-existing failures in `__tests__/ActivePhase.test.tsx` (1), `__tests__/GameContext.test.tsx`/`__tests__/GameFlow.integration.test.tsx` (4), and `__tests__/GameScreen.test.tsx` (3) — 8 total, all confirmed pre-existing and unrelated via isolated worktree comparison. Re-verify the current count before starting (Task 1, Step 1) since more time may have passed; the point is distinguishing "already broken" from "I broke this," not matching an exact historical number.
- **Known edge case, accepted rather than engineered around:** in `GuessingPhase.tsx`, `BasketWritingPhase.tsx`/`BasketGuessingPhase.tsx`, and `ClashWritingPhase.tsx`/`ClashGuessingPhase.tsx`, the admin's own "admin controls" block and the "player-facing" block are not always mutually exclusive (an admin who is also a writer/guesser sees both). Each such component gets one independent `<ScrollIntoView>` per block; if both blocks' keys change in the same render, whichever scrolls last wins the final position. This is a minor, cosmetic edge case — do not build a priority/arbitration system for it. (Mirror's `ActivePhase` does not have this issue: admin is never selected as a round's target, so its "admin" and "target" blocks are mutually exclusive in practice.)
- Reasonable default for `insets.bottom` (clearing the tab bar): `90`. This is a cosmetic tuning value, not a precise measurement — adjust during the manual verification pass in each task if it visually clips.

---

## Task 1: Add the library and wrap the app's ScrollView

**Files:**
- Modify: `apps/expo/package.json` (via `npm install`)
- Create: `apps/expo/constants/scroll.ts`
- Modify: `apps/expo/components/game/GameScreen.tsx`

**Interfaces:**
- Produces: `SCROLL_INSETS: { top: number; bottom: number }` from `apps/expo/constants/scroll.ts`, imported by every later task in this plan.
- Produces: the app's outer `ScrollView` (in `GameScreen.tsx`) is now wrapped via `wrapScrollView`, making `<ScrollIntoView>` usable anywhere inside it without threading a ref — every later task in this plan relies on this.

- [ ] **Step 1: Confirm the baseline**

```bash
cd apps/expo
npm test 2>&1 | tail -20
```

Note the current failing-test count and file names — compare against the Global Constraints baseline (8 failures across `ActivePhase.test.tsx`, `GameContext.test.tsx`, `GameFlow.integration.test.tsx`, `GameScreen.test.tsx`). If the count differs, that's fine (time has passed) — just record what you see now so later steps can tell "pre-existing" from "I broke this."

- [ ] **Step 2: Install the dependency**

```bash
npm install react-native-scroll-into-view
```

Confirm `apps/expo/package.json`'s `dependencies` now includes `"react-native-scroll-into-view"`.

- [ ] **Step 3: Create the shared insets constant**

Create `apps/expo/constants/scroll.ts`:

```ts
// Bottom inset clears the tab bar so a scrolled-to section isn't hidden
// behind it. This is a cosmetic tuning value, not a precise measurement.
export const SCROLL_INSETS = { top: 20, bottom: 90 };
```

- [ ] **Step 4: Wrap the ScrollView in `GameScreen.tsx`**

Add the import (after the existing `react-native` import block):

```ts
import { wrapScrollView } from 'react-native-scroll-into-view';
```

After the imports and before `export const GameScreen`, add:

```ts
const GameScrollView = wrapScrollView(ScrollView);
```

The render currently reads:

```tsx
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false}>
```

Change it to:

```tsx
    <ThemedView style={styles.container}>
      <GameScrollView contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]} showsVerticalScrollIndicator={false}>
```

And its closing tag currently reads:

```tsx
      </ScrollView>

      <FancyAlert
```

Change it to:

```tsx
      </GameScrollView>

      <FancyAlert
```

- [ ] **Step 5: Verify**

```bash
npm test -- __tests__/GameScreen.test.tsx __tests__/GameScreen.memo.test.tsx __tests__/GameScreen.adminLeft.test.tsx __tests__/GameScreen.playerNumbers.test.tsx
```

Confirm no new failures beyond the Step 1 baseline (this change only swaps which component tag wraps the screen's content — it shouldn't change any test's rendered output, since `GameScrollView` renders the same underlying `ScrollView`).

Then start the app (`npx expo start`) and confirm a game screen still scrolls normally (nothing should look different yet — no phase component uses `<ScrollIntoView>` until Task 2).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json apps/expo/constants/scroll.ts apps/expo/components/game/GameScreen.tsx
git commit -m "$(cat <<'EOF'
Add react-native-scroll-into-view and wrap the app's ScrollView

Foundational step for auto-scrolling to the active section: wraps
GameScreen's ScrollView once via wrapScrollView so any descendant
ScrollIntoView works without a manually-threaded ref.
EOF
)"
```

Note: run this `git add` from the repo root (`/Users/macbook/Desktop/dev/in-the-mirror`), not from `apps/expo` — `package.json`/`package-lock.json` for an npm-workspaces install may be touched at the repo root as well as (or instead of) `apps/expo/package.json`; check `git status` and adjust the paths in the `add` command to match what actually changed.

---

## Task 2: Wire mirror mode (and the shared waiting/results screens)

**Files:**
- Modify: `apps/expo/components/game/mirror/WaitingPhase.tsx`
- Modify: `apps/expo/components/game/mirror/ActivePhase.tsx`
- Modify: `apps/expo/components/game/mirror/GuessingPhase.tsx`
- Modify: `apps/expo/components/game/mirror/ResultsPhase.tsx`

**Interfaces:**
- Consumes: `SCROLL_INSETS` from `apps/expo/constants/scroll.ts` (Task 1).
- Consumes: `ScrollIntoView` from `react-native-scroll-into-view` (Task 1).

`WaitingPhase.tsx` and `ResultsPhase.tsx` are rendered by `GameScreen.tsx` for **all three** game modes (`status === 'waiting'` and `status === 'finished'`, regardless of `gameType`) — wiring them here covers basket's and clash's waiting/results stages too; Tasks 3 and 4 do not need to touch them again.

- [ ] **Step 1: `WaitingPhase.tsx` — scroll to the start-button / waiting-for-admin area**

Add the import (after the existing `Leaderboard`/`GameHeader` imports):

```ts
import { ScrollIntoView } from 'react-native-scroll-into-view';
import { SCROLL_INSETS } from '@/constants/scroll';
```

The "Start Game / Waiting" block currently reads:

```tsx
      {/* Start Game / Waiting */}
      <View style={gameStyles.gameFlowContainer}>
        {isAdmin && game.gameType !== 'clash' && (
          <TouchableOpacity
            style={[
              styles.startGameButton,
              { backgroundColor: GameColors.green, shadowColor: GameColors.shadow },
              (loading || game.participants.length < 2) && gameStyles.buttonDisabled,
            ]}
            onPress={handleStartGame}
            disabled={loading || game.participants.length < 2}
            activeOpacity={0.8}
            accessibilityLabel={t('game.ui.startGame', { locale })}
            accessibilityRole="button"
          >
            {loading
              ? <ActivityIndicator size="small" color={GameColors.white} />
              : <IconSymbol name="arrow.right.circle.fill" size={16} color={GameColors.white} />}
            <ThemedText style={styles.buttonText}>{t('game.ui.startGame', { locale })}</ThemedText>
          </TouchableOpacity>
        )}
        {!isAdmin && (
          <ThemedText style={styles.waitingText}>
            {t('game.ui.waitingForAdminStart', { locale })}
          </ThemedText>
        )}
      </View>
```

Change it to:

```tsx
      {/* Start Game / Waiting */}
      <ScrollIntoView
        enabled
        scrollIntoViewKey={`${isAdmin}:${game.gameType ?? 'mirror'}`}
        align="center"
        animated
        insets={SCROLL_INSETS}
      >
        <View style={gameStyles.gameFlowContainer}>
          {isAdmin && game.gameType !== 'clash' && (
            <TouchableOpacity
              style={[
                styles.startGameButton,
                { backgroundColor: GameColors.green, shadowColor: GameColors.shadow },
                (loading || game.participants.length < 2) && gameStyles.buttonDisabled,
              ]}
              onPress={handleStartGame}
              disabled={loading || game.participants.length < 2}
              activeOpacity={0.8}
              accessibilityLabel={t('game.ui.startGame', { locale })}
              accessibilityRole="button"
            >
              {loading
                ? <ActivityIndicator size="small" color={GameColors.white} />
                : <IconSymbol name="arrow.right.circle.fill" size={16} color={GameColors.white} />}
              <ThemedText style={styles.buttonText}>{t('game.ui.startGame', { locale })}</ThemedText>
            </TouchableOpacity>
          )}
          {!isAdmin && (
            <ThemedText style={styles.waitingText}>
              {t('game.ui.waitingForAdminStart', { locale })}
            </ThemedText>
          )}
        </View>
      </ScrollIntoView>
```

- [ ] **Step 2: `ActivePhase.tsx` — scroll to each role's block**

Add the import (after the existing `PostGuessingPointsPanel` import):

```ts
import { ScrollIntoView } from 'react-native-scroll-into-view';
import { SCROLL_INSETS } from '@/constants/scroll';
```

The admin block's opening tag currently reads:

```tsx
        {/* Admin controls */}
        {isAdmin && (
          <View style={styles.adminControls}>
```

Change it to:

```tsx
        {/* Admin controls */}
        {isAdmin && (
          <ScrollIntoView
            enabled
            scrollIntoViewKey={`${game.currentRound.roundNumber}:admin:${game.currentRound.commentsVisible}`}
            align="center"
            animated
            insets={SCROLL_INSETS}
          >
          <View style={styles.adminControls}>
```

Its closing — currently:

```tsx
            </View>
          </View>
        )}

        {/* User is the target */}
```

Change it to:

```tsx
            </View>
          </View>
          </ScrollIntoView>
        )}

        {/* User is the target */}
```

The target block's opening tag currently reads:

```tsx
        {/* User is the target */}
        {user?.uid === game.currentRound.targetUserId && (
          <View style={styles.targetView}>
```

Change it to:

```tsx
        {/* User is the target */}
        {user?.uid === game.currentRound.targetUserId && (
          <ScrollIntoView
            enabled
            scrollIntoViewKey={`${game.currentRound.roundNumber}:target:${game.currentRound.commentsVisible}:${game.currentRound.pointsGiven}`}
            align="center"
            animated
            insets={SCROLL_INSETS}
          >
          <View style={styles.targetView}>
```

Its closing — currently:

```tsx
            )}
          </View>
        )}

        {/* User is not the target */}
```

Change it to:

```tsx
            )}
          </View>
          </ScrollIntoView>
        )}

        {/* User is not the target */}
```

The non-target block's opening tag currently reads:

```tsx
        {/* User is not the target */}
        {user?.uid !== game.currentRound.targetUserId && (
          <View style={styles.commentView}>
```

Change it to:

```tsx
        {/* User is not the target */}
        {user?.uid !== game.currentRound.targetUserId && (
          <ScrollIntoView
            enabled
            scrollIntoViewKey={`${game.currentRound.roundNumber}:other:${game.currentRound.commentsVisible}:${game.currentRound.pointsGiven}`}
            align="center"
            animated
            insets={SCROLL_INSETS}
          >
          <View style={styles.commentView}>
```

Its closing — currently:

```tsx
            })()}
          </View>
        )}
      </View>

      {/* Post-Guessing Point Phase (when active during active status) */}
```

Change it to:

```tsx
            })()}
          </View>
          </ScrollIntoView>
        )}
      </View>

      {/* Post-Guessing Point Phase (when active during active status) */}
```

- [ ] **Step 3: `GuessingPhase.tsx` — scroll to the player's guessing UI and (independently) the admin finalize controls**

Add the import (after the existing `PostGuessingPointsPanel` import):

```ts
import { ScrollIntoView } from 'react-native-scroll-into-view';
import { SCROLL_INSETS } from '@/constants/scroll';
```

The "Player guessing UI" ternary's opening currently reads:

```tsx
        {(hasSubmittedGuesses || game.guessingData.playersWhoSubmittedGuesses?.includes(user?.uid || '')) ? (
```

Change it to:

```tsx
        <ScrollIntoView
          enabled
          scrollIntoViewKey={`${singleTargetId ?? 'legacy'}:${hasSubmittedGuesses || game.guessingData.playersWhoSubmittedGuesses?.includes(user?.uid || '')}`}
          align="center"
          animated
          insets={SCROLL_INSETS}
        >
        {(hasSubmittedGuesses || game.guessingData.playersWhoSubmittedGuesses?.includes(user?.uid || '')) ? (
```

Its closing — currently:

```tsx
          )
        )}

        {/* Admin Target Control */}
```

Change it to:

```tsx
          )
        )}
        </ScrollIntoView>

        {/* Admin Target Control */}
```

The admin finalize-controls block's opening currently reads:

```tsx
        {isAdmin && (
          (() => {
            const singleTargetId = game.guessingData?.singleRoundTargetId;
            const targetSubmitted = singleTargetId
              ? game.guessingData?.playersWhoSubmittedGuesses?.includes(singleTargetId)
              : false;

            if (singleTargetId && targetSubmitted) {
```

Change it to:

```tsx
        {isAdmin && (
          <ScrollIntoView
            enabled
            scrollIntoViewKey={`${singleTargetId ?? 'legacy'}:${targetSubmitted}:${game.guessingData.allPlayersSubmitted}`}
            align="center"
            animated
            insets={SCROLL_INSETS}
          >
          {(() => {
            const singleTargetId = game.guessingData?.singleRoundTargetId;
            const targetSubmitted = singleTargetId
              ? game.guessingData?.playersWhoSubmittedGuesses?.includes(singleTargetId)
              : false;

            if (singleTargetId && targetSubmitted) {
```

Its closing — currently the very end of that IIFE's return, right before the block's own closing:

```tsx
              </View>
            );
          })()
        )}
      </View>

      {/* Post-Guessing Point Panel */}
```

Change it to:

```tsx
              </View>
            );
          })()}
          </ScrollIntoView>
        )}
      </View>

      {/* Post-Guessing Point Panel */}
```

Note the `})()` (call) became `})()}` (call, then close the JSX expression) — this is because the IIFE call is now itself the single JSX child of `<ScrollIntoView>`, wrapped in `{...}`, rather than being the direct child of `{isAdmin && (...)}`.

- [ ] **Step 4: `ResultsPhase.tsx` — scroll to the results content on entry**

Add the import (after the existing `Leaderboard` import):

```ts
import { ScrollIntoView } from 'react-native-scroll-into-view';
import { SCROLL_INSETS } from '@/constants/scroll';
```

The return statement currently reads:

```tsx
  return (
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
    <View style={[gameStyles.gameFlowContainer, styles.phaseWrapper]}>
```

And its closing — currently:

```tsx
    </View>
  );
};
```

Change it to:

```tsx
    </View>
    </ScrollIntoView>
  );
};
```

- [ ] **Step 5: Verify**

```bash
npm test -- __tests__/ActivePhase.test.tsx __tests__/GuessingPhase.test.tsx __tests__/WaitingPhase.test.tsx __tests__/Results.test.tsx
```

Confirm no new failures beyond the Task 1 Step 1 baseline (`ScrollIntoView` renders its children as-is when not interacted with in a test environment — it shouldn't change any existing test's `getByText`/`getByLabelText` assertions, since it only wraps existing elements, doesn't remove or rename anything).

Then, on a device/simulator, manually verify with a 3-participant mirror game: as admin, confirm the waiting-room screen keeps the start-button area in view; start the game and confirm the screen scrolls to your section (admin checklist) automatically; as a non-target player, confirm the screen scrolls to your comment form; write and submit a comment, confirm the screen scrolls to the "comment sent, waiting" message; as the round's target, confirm the screen scrolls to "waiting for comments about you", then after comments are shown, to the comment list with point-award buttons; move through to the guessing phase and confirm the screen scrolls to the guess-picker; finish the game and confirm the screen scrolls to the results content. Confirm that incidental updates (e.g. another player's comment arriving while you wait) do **not** cause a re-scroll.

- [ ] **Step 6: Commit**

```bash
git add apps/expo/components/game/mirror/WaitingPhase.tsx apps/expo/components/game/mirror/ActivePhase.tsx apps/expo/components/game/mirror/GuessingPhase.tsx apps/expo/components/game/mirror/ResultsPhase.tsx
git commit -m "$(cat <<'EOF'
Auto-scroll to the active section in mirror mode (Expo)

Wires ScrollIntoView into WaitingPhase, ActivePhase (per role),
GuessingPhase (player UI + admin controls), and ResultsPhase.
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
- Consumes: `SCROLL_INSETS` from `apps/expo/constants/scroll.ts` (Task 1), `ScrollIntoView` from `react-native-scroll-into-view` (Task 1).

- [ ] **Step 1: `BasketWritingPhase.tsx`**

Add the import (after the existing `react-native` import block):

```ts
import { ScrollIntoView } from 'react-native-scroll-into-view';
import { SCROLL_INSETS } from '@/constants/scroll';
```

The player-facing ternary's opening currently reads:

```tsx
      <View style={gameStyles.gameFlowContainer}>
        {alreadySubmitted ? (
```

Change it to:

```tsx
      <View style={gameStyles.gameFlowContainer}>
        <ScrollIntoView
          enabled
          scrollIntoViewKey={`${currentRoundIndex}:${alreadySubmitted}`}
          align="center"
          animated
          insets={SCROLL_INSETS}
        >
        {alreadySubmitted ? (
```

Its closing — currently:

```tsx
          </View>
        )}

        {isAdmin && (
```

Change it to:

```tsx
          </View>
        )}
        </ScrollIntoView>

        {isAdmin && (
```

The admin block's opening tag currently reads:

```tsx
        {isAdmin && (
          <View style={styles.adminSection}>
```

Change it to:

```tsx
        {isAdmin && (
          <ScrollIntoView
            enabled
            scrollIntoViewKey={`${currentRoundIndex}:${submittedCount >= totalCount}`}
            align="center"
            animated
            insets={SCROLL_INSETS}
          >
          <View style={styles.adminSection}>
```

Its closing — currently:

```tsx
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};
```

Change it to:

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

- [ ] **Step 2: `BasketGuessingPhase.tsx`**

Add the import (after the existing `react-native` import block):

```ts
import { ScrollIntoView } from 'react-native-scroll-into-view';
import { SCROLL_INSETS } from '@/constants/scroll';
```

The player-facing ternary's opening currently reads:

```tsx
      <View style={gameStyles.gameFlowContainer}>
        {isDone || showWrong ? (
```

Change it to:

```tsx
      <View style={gameStyles.gameFlowContainer}>
        <ScrollIntoView
          enabled
          scrollIntoViewKey={`${currentRoundIndex}:${isDone || showWrong}:${showAuthorPrompt}`}
          align="center"
          animated
          insets={SCROLL_INSETS}
        >
        {isDone || showWrong ? (
```

Its closing — currently:

```tsx
          </View>
        )}

        {isAdmin && (
```

Change it to:

```tsx
          </View>
        )}
        </ScrollIntoView>

        {isAdmin && (
```

The admin block's opening tag currently reads:

```tsx
        {isAdmin && (
          <View style={styles.adminSection}>
```

Change it to:

```tsx
        {isAdmin && (
          <ScrollIntoView
            enabled
            scrollIntoViewKey={`${currentRoundIndex}:${allGuessersDone}`}
            align="center"
            animated
            insets={SCROLL_INSETS}
          >
          <View style={styles.adminSection}>
```

Its closing — currently:

```tsx
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};
```

Change it to:

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

- [ ] **Step 3: Verify**

```bash
npm test -- __tests__/BasketWritingPhase.test.tsx __tests__/BasketGuessingPhase.test.tsx
```

Confirm no new failures beyond baseline.

Then manually verify with a 3-participant basket game: as a writer, confirm the screen scrolls to the comment form, then to the "waiting for others" message after submitting; as admin, confirm the reveal-button area stays reachable; move into the guessing phase and confirm the screen scrolls to the comment-guessing prompt, then to the author-guessing prompt after a correct guess, then to the "waiting for guesses" message.

- [ ] **Step 4: Commit**

```bash
git add apps/expo/components/game/basket/BasketWritingPhase.tsx apps/expo/components/game/basket/BasketGuessingPhase.tsx
git commit -m "$(cat <<'EOF'
Auto-scroll to the active section in basket mode (Expo)

Wires ScrollIntoView into BasketWritingPhase and BasketGuessingPhase's
player-facing and admin-controls sections.
EOF
)"
```

---

## Task 4: Wire clash mode

**Files:**
- Modify: `apps/expo/components/game/clash/ClashWritingPhase.tsx`
- Modify: `apps/expo/components/game/clash/ClashGuessingPhase.tsx`

**Interfaces:**
- Consumes: `SCROLL_INSETS` from `apps/expo/constants/scroll.ts` (Task 1), `ScrollIntoView` from `react-native-scroll-into-view` (Task 1).

- [ ] **Step 1: `ClashWritingPhase.tsx`**

Add the import (after the existing `react-native` import block):

```ts
import { ScrollIntoView } from 'react-native-scroll-into-view';
import { SCROLL_INSETS } from '@/constants/scroll';
```

The player-facing ternary's opening currently reads:

```tsx
      <View style={gameStyles.gameFlowContainer}>
        {alreadySubmitted ? (
```

Change it to:

```tsx
      <View style={gameStyles.gameFlowContainer}>
        <ScrollIntoView
          enabled
          scrollIntoViewKey={`${currentRoundIndex}:${alreadySubmitted}`}
          align="center"
          animated
          insets={SCROLL_INSETS}
        >
        {alreadySubmitted ? (
```

Its closing — currently:

```tsx
          </View>
        )}

        {isAdmin && (
```

Change it to:

```tsx
          </View>
        )}
        </ScrollIntoView>

        {isAdmin && (
```

The admin block's opening tag currently reads:

```tsx
        {isAdmin && (
          <View style={styles.adminSection}>
            <ClashScoreboard scoreA={teamScores.a} scoreB={teamScores.b} locale={locale} />
```

Change it to:

```tsx
        {isAdmin && (
          <ScrollIntoView
            enabled
            scrollIntoViewKey={`${currentRoundIndex}:${allSubmitted}`}
            align="center"
            animated
            insets={SCROLL_INSETS}
          >
          <View style={styles.adminSection}>
            <ClashScoreboard scoreA={teamScores.a} scoreB={teamScores.b} locale={locale} />
```

Its closing — currently:

```tsx
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};
```

Change it to:

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

- [ ] **Step 2: `ClashGuessingPhase.tsx`**

Add the import (after the existing `react-native` import block):

```ts
import { ScrollIntoView } from 'react-native-scroll-into-view';
import { SCROLL_INSETS } from '@/constants/scroll';
```

The player-facing ternary's opening currently reads:

```tsx
      <View style={gameStyles.gameFlowContainer}>
        {!isActiveLeader ? (
```

Change it to:

```tsx
      <View style={gameStyles.gameFlowContainer}>
        <ScrollIntoView
          enabled
          scrollIntoViewKey={`${currentRoundIndex}:${currentGroup}:${isActiveLeader}`}
          align="center"
          animated
          insets={SCROLL_INSETS}
        >
        {!isActiveLeader ? (
```

Its closing — currently:

```tsx
            {isSubmitting && <ActivityIndicator style={{ marginTop: 8 }} color={GameColors.blue} />}
          </View>
        )}

        {isAdmin && (
```

Change it to:

```tsx
            {isSubmitting && <ActivityIndicator style={{ marginTop: 8 }} color={GameColors.blue} />}
          </View>
        )}
        </ScrollIntoView>

        {isAdmin && (
```

The admin block's opening tag currently reads:

```tsx
        {isAdmin && (
          <View style={styles.adminSection}>
            <TouchableOpacity
```

Change it to:

```tsx
        {isAdmin && (
          <ScrollIntoView
            enabled
            scrollIntoViewKey={`${currentRoundIndex}:${currentGroup}:${currentGroupDone}`}
            align="center"
            animated
            insets={SCROLL_INSETS}
          >
          <View style={styles.adminSection}>
            <TouchableOpacity
```

Its closing — currently:

```tsx
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};
```

Change it to:

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

- [ ] **Step 3: Verify**

```bash
npm test -- __tests__/ClashWritingPhase.test.tsx __tests__/ClashGuessingPhase.test.tsx
```

Confirm no new failures beyond baseline.

Then manually verify with a 4-participant clash game (2v2): as a writer, confirm the screen scrolls to the comment form, then the "waiting for group" message after submitting; as the active leader during guessing, confirm the screen scrolls to the card list; as a non-leader, confirm the screen scrolls to the "X is guessing" message; as admin, confirm the reveal/advance button area stays reachable.

- [ ] **Step 4: Commit**

```bash
git add apps/expo/components/game/clash/ClashWritingPhase.tsx apps/expo/components/game/clash/ClashGuessingPhase.tsx
git commit -m "$(cat <<'EOF'
Auto-scroll to the active section in clash mode (Expo)

Wires ScrollIntoView into ClashWritingPhase and ClashGuessingPhase's
player-facing and admin-controls sections.
EOF
)"
```
