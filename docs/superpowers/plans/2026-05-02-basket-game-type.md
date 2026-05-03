# Basket Game Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Basket" game type alongside "In the Mirror" — admin picks the type in the waiting room; Basket shows a placeholder screen for now.

**Architecture:** Add `gameType?: 'mirror' | 'basket'` to the `Game` interface; route in `GameScreen.tsx` before the `status` switch; move mirror-specific phase components to `components/game/mirror/`; create `components/game/basket/BasketScreen.tsx` placeholder; add a two-button toggle to `WaitingPhase`.

**Tech Stack:** Expo React Native, TypeScript strict, Firebase Firestore (`updateDoc`), React Context, Jest + RNTL, i18n-js.

---

## File Map

| Action | Path |
|---|---|
| Modify | `locales/en.json` |
| Modify | `locales/uk.json` |
| Modify | `contexts/GameContext.tsx` |
| Create | `__tests__/GameContext.setGameType.test.ts` |
| Move | `components/game/WaitingPhase.tsx` → `components/game/mirror/WaitingPhase.tsx` |
| Move | `components/game/ActivePhase.tsx` → `components/game/mirror/ActivePhase.tsx` |
| Move | `components/game/GuessingPhase.tsx` → `components/game/mirror/GuessingPhase.tsx` |
| Move | `components/game/ResultsPhase.tsx` → `components/game/mirror/ResultsPhase.tsx` |
| Move | `components/game/PostGuessingPointsPanel.tsx` → `components/game/mirror/PostGuessingPointsPanel.tsx` |
| Create | `components/game/basket/BasketScreen.tsx` |
| Modify | `components/game/GameScreen.tsx` |
| Modify | `__tests__/WaitingPhase.test.tsx` |
| Modify | `__tests__/ActivePhase.test.tsx` |
| Modify | `__tests__/GuessingPhase.test.tsx` |
| Modify | `__tests__/GameScreen.test.tsx` |
| Modify | `__tests__/GameScreen.memo.test.tsx` |
| Modify | `__tests__/GameScreen.adminLeft.test.tsx` |

---

### Task 1: Add i18n keys

**Files:**
- Modify: `locales/en.json`
- Modify: `locales/uk.json`

- [ ] **Step 1: Add keys to `locales/en.json`**

In `locales/en.json`, inside `"game" → "ui"`, after the `"closeGuessResults"` entry, add:

```json
      "gameTypeLabel": "Game type",
      "gameTypeMirror": "In the Mirror",
      "gameTypeBasket": "Basket"
```

- [ ] **Step 2: Add keys to `locales/uk.json`**

In `locales/uk.json`, inside `"game" → "ui"`, after the `"closeGuessResults"` entry, add:

```json
      "gameTypeLabel": "Тип гри",
      "gameTypeMirror": "В дзеркалі",
      "gameTypeBasket": "Кошик"
```

- [ ] **Step 3: Run tests to confirm nothing broke**

```bash
npm test -- --passWithNoTests
```

Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add locales/en.json locales/uk.json
git commit -m "feat: add gameType i18n keys (en + uk)"
```

---

### Task 2: Add `gameType` field to Game interface

**Files:**
- Modify: `contexts/GameContext.tsx:27-68` (the `Game` interface)

- [ ] **Step 1: Add the field to the `Game` interface**

In `contexts/GameContext.tsx`, inside the `Game` interface after the `targetSelectionMode` line (line ~64), add:

```typescript
  // Which game type to play: 'mirror' (default) or 'basket'
  gameType?: 'mirror' | 'basket';
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all existing tests pass (field is optional, zero runtime changes).

- [ ] **Step 3: Commit**

```bash
git add contexts/GameContext.tsx
git commit -m "feat: add gameType field to Game interface"
```

---

### Task 3: Add `setGameType` to GameContext (TDD)

**Files:**
- Create: `__tests__/GameContext.setGameType.test.ts`
- Modify: `contexts/GameContext.tsx`

- [ ] **Step 1: Write the failing test**

Create `__tests__/GameContext.setGameType.test.ts`:

```typescript
import { act, renderHook } from '@testing-library/react-native';
import React from 'react';
import { GameProvider, useGame } from '../contexts/GameContext';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-1', displayName: 'Alice', email: 'alice@example.com' },
    isSignedIn: true,
  }),
}));

beforeEach(() => {
  const firestore = require('firebase/firestore');
  firestore.doc.mockReturnValue({ path: 'games/test-id' });
  firestore.getDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
  firestore.setDoc.mockResolvedValue(undefined);
  firestore.updateDoc.mockResolvedValue(undefined);
  firestore.onSnapshot.mockReturnValue(jest.fn());
  firestore.arrayUnion.mockImplementation((val: any) => val);
  firestore.serverTimestamp.mockReturnValue(new Date());
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <GameProvider>{children}</GameProvider>
);

describe('setGameType', () => {
  it('is exposed by useGame', () => {
    const { result } = renderHook(() => useGame(), { wrapper });
    expect(typeof result.current.setGameType).toBe('function');
  });

  it('calls updateDoc with { gameType: type } when a game is active', async () => {
    const firestore = require('firebase/firestore');
    const gameDoc = { id: 'game-abc', path: 'games/game-abc' };
    firestore.doc.mockReturnValue(gameDoc);

    // Simulate an active game by triggering an onSnapshot callback
    let snapshotCallback: (snap: any) => void = () => {};
    firestore.onSnapshot.mockImplementation((_ref: any, cb: any) => {
      snapshotCallback = cb;
      return jest.fn();
    });

    const { result } = renderHook(() => useGame(), { wrapper });

    // Inject a fake game via the snapshot listener
    act(() => {
      snapshotCallback({
        exists: () => true,
        id: 'game-abc',
        data: () => ({
          adminId: 'user-1',
          adminName: 'Alice',
          adminEmail: 'alice@example.com',
          status: 'waiting',
          participants: [],
          createdAt: new Date(),
        }),
      });
    });

    await act(async () => {
      await result.current.setGameType('basket');
    });

    expect(firestore.updateDoc).toHaveBeenCalledWith(
      gameDoc,
      { gameType: 'basket' },
    );
  });

  it('does nothing when there is no active game', async () => {
    const firestore = require('firebase/firestore');
    firestore.updateDoc.mockClear();

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => {
      await result.current.setGameType('mirror');
    });

    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/GameContext.setGameType.test.ts
```

Expected: FAIL — `setGameType` is not a function.

- [ ] **Step 3: Add `setGameType` to `GameContextType` interface**

In `contexts/GameContext.tsx`, inside the `GameContextType` interface (around line 124), after the `updateShowGuessResults` line, add:

```typescript
  setGameType: (type: 'mirror' | 'basket') => Promise<void>;
```

- [ ] **Step 4: Implement `setGameType` in the GameProvider**

In `contexts/GameContext.tsx`, after the `updateShowGuessResults` implementation (search for `const updateShowGuessResults`), add:

```typescript
  const setGameType = async (type: 'mirror' | 'basket'): Promise<void> => {
    if (!currentGame) return;
    const gameRef = doc(db, 'games', currentGame.id);
    await updateDoc(gameRef, { gameType: type });
  };
```

- [ ] **Step 5: Expose `setGameType` in the value object**

In `contexts/GameContext.tsx`, in the `value` object (around line 1732), add `setGameType` after `updateShowGuessResults`:

```typescript
      setGameType,
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npm test -- __tests__/GameContext.setGameType.test.ts
```

Expected: PASS — all 3 tests green.

- [ ] **Step 7: Update the existing `exposes all required action functions` test**

In `__tests__/GameContext.test.tsx`, add `'setGameType'` to the `fns` array in the `'exposes all required action functions'` test (around line 47):

```typescript
      const fns = [
        'createGame', 'joinGame', 'enterGame', 'leaveGame', 'startGame',
        'submitComment', 'showComments', 'awardCommentPoints', 'finishAwardingPoints',
        'startNextRound', 'givePointsToTarget', 'startGuessingPhase',
        'finalizeGuessingPhase', 'submitGuess', 'markPlayerGuessesSubmitted',
        'updateAdminWritesComments', 'updateShowSurnames', 'updateTargetSelectionMode',
        'updateShowGuessResults', 'startPostGuessingPointPhase',
        'awardPointsToPlayers', 'skipPostCommentPhase', 'setGameType',
      ];
```

- [ ] **Step 8: Run all tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add contexts/GameContext.tsx __tests__/GameContext.setGameType.test.ts __tests__/GameContext.test.tsx
git commit -m "feat: add setGameType to GameContext (TDD)"
```

---

### Task 4: Folder restructure — move mirror phase files

**Files:**
- Move: `components/game/{WaitingPhase,ActivePhase,GuessingPhase,ResultsPhase,PostGuessingPointsPanel}.tsx` → `components/game/mirror/`
- Modify: `components/game/GameScreen.tsx` (update imports)
- Modify: `__tests__/WaitingPhase.test.tsx`, `__tests__/ActivePhase.test.tsx`, `__tests__/GuessingPhase.test.tsx`, `__tests__/GameScreen.test.tsx`, `__tests__/GameScreen.memo.test.tsx`, `__tests__/GameScreen.adminLeft.test.tsx`

- [ ] **Step 1: Create the mirror sub-folder and move files**

```bash
mkdir -p components/game/mirror
mv components/game/WaitingPhase.tsx components/game/mirror/WaitingPhase.tsx
mv components/game/ActivePhase.tsx components/game/mirror/ActivePhase.tsx
mv components/game/GuessingPhase.tsx components/game/mirror/GuessingPhase.tsx
mv components/game/ResultsPhase.tsx components/game/mirror/ResultsPhase.tsx
mv components/game/PostGuessingPointsPanel.tsx components/game/mirror/PostGuessingPointsPanel.tsx
```

- [ ] **Step 2: Fix the internal cross-import in `ActivePhase.tsx`**

`ActivePhase.tsx` imports `PostGuessingPointsPanel`. After the move, that import path changes.

In `components/game/mirror/ActivePhase.tsx`, change:

```typescript
import { PostGuessingPointsPanel } from './PostGuessingPointsPanel';
```

to:

```typescript
import { PostGuessingPointsPanel } from '@/components/game/mirror/PostGuessingPointsPanel';
```

Similarly check `GuessingPhase.tsx` for any import of `PostGuessingPointsPanel` and update it the same way.

Run this check first:
```bash
grep -n "PostGuessingPointsPanel" components/game/mirror/GuessingPhase.tsx
```

- [ ] **Step 3: Update `GameScreen.tsx` imports**

In `components/game/GameScreen.tsx`, update the four imports:

```typescript
import { ActivePhase } from '@/components/game/mirror/ActivePhase';
import { GuessingPhase } from '@/components/game/mirror/GuessingPhase';
import { ResultsPhase } from '@/components/game/mirror/ResultsPhase';
import { WaitingPhase } from '@/components/game/mirror/WaitingPhase';
```

- [ ] **Step 4: Update test file require paths**

In `__tests__/WaitingPhase.test.tsx` line 76, change:
```typescript
const { WaitingPhase } = require('../components/game/WaitingPhase');
```
to:
```typescript
const { WaitingPhase } = require('../components/game/mirror/WaitingPhase');
```

In `__tests__/ActivePhase.test.tsx`, find the require/import for `ActivePhase` and update to `../components/game/mirror/ActivePhase`.

In `__tests__/GuessingPhase.test.tsx`, find the require/import for `GuessingPhase` and update to `../components/game/mirror/GuessingPhase`.

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all tests pass (no logic changed, only paths).

- [ ] **Step 6: Commit**

```bash
git add components/game/ __tests__/
git commit -m "refactor: move mirror phase components to components/game/mirror/"
```

---

### Task 5: Create BasketScreen placeholder

**Files:**
- Create: `components/game/basket/BasketScreen.tsx`

- [ ] **Step 1: Create the folder and file**

```bash
mkdir -p components/game/basket
```

Create `components/game/basket/BasketScreen.tsx`:

```typescript
import { ThemedText } from '@/components/themed-text';
import type { Game } from '@/contexts/GameContext';
import { t } from '@/i18n';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  game: Game;
  user: { uid: string } | null;
  locale: string;
}

export const BasketScreen: React.FC<Props> = ({ locale }) => (
  <View style={styles.container}>
    <ThemedText style={styles.title}>
      {t('game.ui.gameTypeBasket', { locale })}
    </ThemedText>
    <ThemedText style={styles.subtitle}>Coming soon</ThemedText>
  </View>
);

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { fontSize: 16, opacity: 0.6 },
});
```

- [ ] **Step 2: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add components/game/basket/BasketScreen.tsx
git commit -m "feat: add BasketScreen placeholder component"
```

---

### Task 6: GameScreen routing for basket (TDD)

**Files:**
- Modify: `__tests__/GameScreen.test.tsx`
- Modify: `components/game/GameScreen.tsx`

- [ ] **Step 1: Write failing test**

In `__tests__/GameScreen.test.tsx`, the `useGame` mock (around line 29) needs `setGameType`. Add it to the mock:

```typescript
jest.mock('@/contexts/GameContext', () => ({
  useGame: () => ({
    currentGame: mockCurrentGame,
    loading: false,
    enterGame: jest.fn(),
    leaveGame: jest.fn(),
    startGame: jest.fn(),
    submitComment: jest.fn(),
    showComments: jest.fn(),
    awardCommentPoints: jest.fn(),
    finishAwardingPoints: jest.fn(),
    givePointsToTarget: jest.fn(),
    startNextRound: jest.fn(),
    startGuessingPhase: jest.fn(),
    submitGuess: jest.fn(),
    finalizeGuessingPhase: jest.fn(),
    markPlayerGuessesSubmitted: jest.fn(),
    updateAdminWritesComments: jest.fn(),
    updateShowSurnames: jest.fn(),
    updateTargetSelectionMode: jest.fn(),
    updateShowGuessResults: jest.fn(),
    startPostGuessingPointPhase: jest.fn(),
    awardPointsToPlayers: jest.fn(),
    skipPostCommentPhase: jest.fn(),
    refreshGame: jest.fn(),
    setGameType: jest.fn(),
  }),
}));
```

Also add a mock for `BasketScreen` near the other component mocks at the top of the file:

```typescript
jest.mock('@/components/game/basket/BasketScreen', () => ({
  BasketScreen: () => {
    const { Text } = require('react-native');
    return <Text testID="basket-screen">BasketScreen</Text>;
  },
}));
```

Add the following test to `__tests__/GameScreen.test.tsx` in an appropriate describe block (e.g., after the existing `'waiting'` status tests):

```typescript
describe('basket game type routing', () => {
  it('renders BasketScreen when gameType is basket (status=waiting)', () => {
    mockCurrentGame = {
      id: 'G1', adminId: 'u1', status: 'waiting', gameType: 'basket',
      participants: [], scores: {}, adminWritesComments: false,
      showSurnames: false, targetSelectionMode: 'random', showGuessResults: false,
    };
    const { getByTestId } = renderScreen();
    expect(getByTestId('basket-screen')).toBeTruthy();
  });

  it('does not render BasketScreen when gameType is mirror', () => {
    mockCurrentGame = {
      id: 'G1', adminId: 'u1', status: 'waiting', gameType: 'mirror',
      participants: [], scores: {}, adminWritesComments: false,
      showSurnames: false, targetSelectionMode: 'random', showGuessResults: false,
    };
    const { queryByTestId } = renderScreen();
    expect(queryByTestId('basket-screen')).toBeNull();
  });

  it('does not render BasketScreen when gameType is absent (default mirror)', () => {
    mockCurrentGame = {
      id: 'G1', adminId: 'u1', status: 'waiting',
      participants: [], scores: {}, adminWritesComments: false,
      showSurnames: false, targetSelectionMode: 'random', showGuessResults: false,
    };
    const { queryByTestId } = renderScreen();
    expect(queryByTestId('basket-screen')).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- __tests__/GameScreen.test.tsx
```

Expected: FAIL — `basket-screen` testID not found.

- [ ] **Step 3: Update `GameScreen.tsx` imports and routing**

At the top of `components/game/GameScreen.tsx`, add:

```typescript
import { BasketScreen } from '@/components/game/basket/BasketScreen';
```

In the JSX routing block (inside `<Animated.View ...>`), before the `status === 'waiting'` check, add the basket routing:

```typescript
{(currentGame.gameType ?? 'mirror') === 'basket' ? (
  <BasketScreen game={currentGame} user={user} locale={locale} />
) : (
  <>
    {currentGame.status === 'waiting' && (
      <WaitingPhase {...sharedProps} onCopyGameId={handleCopyGameId} />
    )}

    {currentGame.status === 'active' && currentGame.currentRound && (
      <ActivePhase {...sharedProps} />
    )}

    {currentGame.status === 'guessing_phase' && (
      <GuessingPhase {...sharedProps} commentsForPlayer={commentsForPlayer} />
    )}

    {currentGame.status === 'finished' && (
      <ResultsPhase
        game={currentGame}
        user={user}
        joinIndexById={joinIndexById}
        getDisplayName={getDisplayName}
        locale={locale}
      />
    )}
  </>
)}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- __tests__/GameScreen.test.tsx
```

Expected: PASS — all 3 new tests green plus all existing tests.

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/game/GameScreen.tsx __tests__/GameScreen.test.tsx
git commit -m "feat: route GameScreen to BasketScreen when gameType is basket (TDD)"
```

---

### Task 7: WaitingPhase game type toggle (TDD)

**Files:**
- Modify: `__tests__/WaitingPhase.test.tsx`
- Modify: `components/game/mirror/WaitingPhase.tsx`

- [ ] **Step 1: Add `setGameType` to the `useGame` mock in `WaitingPhase.test.tsx`**

In `__tests__/WaitingPhase.test.tsx`, the `useGame` mock (lines 28–37) currently returns:

```typescript
jest.mock('@/contexts/GameContext', () => ({
  useGame: () => ({
    loading: false,
    startGame: jest.fn(),
    updateAdminWritesComments: jest.fn(),
    updateShowSurnames: jest.fn(),
    updateTargetSelectionMode: jest.fn(),
    updateShowGuessResults: jest.fn(),
  }),
}));
```

Change it to:

```typescript
jest.mock('@/contexts/GameContext', () => ({
  useGame: () => ({
    loading: false,
    startGame: jest.fn(),
    updateAdminWritesComments: jest.fn(),
    updateShowSurnames: jest.fn(),
    updateTargetSelectionMode: jest.fn(),
    updateShowGuessResults: jest.fn(),
    setGameType: mockSetGameType,
  }),
}));
```

Declare `mockSetGameType` at module level (before the mock, after the other module-level variables):

```typescript
let mockSetGameType = jest.fn();
```

And reset it in `beforeEach`:

```typescript
beforeEach(() => {
  mockSetGameType = jest.fn();
  // ... existing beforeEach code
});
```

- [ ] **Step 2: Write the failing toggle test**

Add a new describe block at the bottom of `__tests__/WaitingPhase.test.tsx`:

```typescript
describe('WaitingPhase — game type toggle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.runAllTimers();
    jest.useRealTimers();
  });

  function renderWaiting(gameOverrides = {}) {
    return render(
      <WaitingPhase
        game={{ ...baseGame, ...gameOverrides }}
        isAdmin={true}
        user={{ uid: USER_UID }}
        participantsByJoin={baseGame.participants}
        joinIndexById={{ [USER_UID]: 1, p2: 2 }}
        getDisplayName={(n: string) => n}
        showFancyAlert={jest.fn()}
        showFaceMessage={jest.fn()}
        locale="en"
        isDark={false}
        onCopyGameId={jest.fn()}
      />
    );
  }

  it('shows the game type label for admins', () => {
    const { queryByText } = renderWaiting();
    expect(queryByText('game.ui.gameTypeLabel')).toBeTruthy();
  });

  it('renders Mirror and Basket buttons', () => {
    const { queryByText } = renderWaiting();
    expect(queryByText('game.ui.gameTypeMirror')).toBeTruthy();
    expect(queryByText('game.ui.gameTypeBasket')).toBeTruthy();
  });

  it('calls setGameType("basket") when Basket button is pressed', async () => {
    const { getByText } = renderWaiting();
    fireEvent.press(getByText('game.ui.gameTypeBasket'));
    await act(async () => { await Promise.resolve(); });
    expect(mockSetGameType).toHaveBeenCalledWith('basket');
  });

  it('calls setGameType("mirror") when Mirror button is pressed', async () => {
    const { getByText } = renderWaiting({ gameType: 'basket' });
    fireEvent.press(getByText('game.ui.gameTypeMirror'));
    await act(async () => { await Promise.resolve(); });
    expect(mockSetGameType).toHaveBeenCalledWith('mirror');
  });

  it('does not show the toggle for non-admins', () => {
    const { queryByText } = render(
      <WaitingPhase
        game={baseGame}
        isAdmin={false}
        user={{ uid: 'p2' }}
        participantsByJoin={baseGame.participants}
        joinIndexById={{ [USER_UID]: 1, p2: 2 }}
        getDisplayName={(n: string) => n}
        showFancyAlert={jest.fn()}
        showFaceMessage={jest.fn()}
        locale="en"
        isDark={false}
        onCopyGameId={jest.fn()}
      />
    );
    expect(queryByText('game.ui.gameTypeLabel')).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
npm test -- __tests__/WaitingPhase.test.tsx
```

Expected: FAIL — `game.ui.gameTypeLabel` not found.

- [ ] **Step 4: Implement the toggle in `WaitingPhase.tsx`**

In `components/game/mirror/WaitingPhase.tsx`, add `setGameType` to the `useGame` destructure (line ~50):

```typescript
const { loading, startGame, updateAdminWritesComments, updateShowSurnames, updateTargetSelectionMode, updateShowGuessResults, setGameType } = useGame();
```

Inside the `{isAdmin && (...)}` settings block, after the last existing toggle (search for the last `</View>` closing a toggle), add the game type toggle:

```typescript
          <View style={styles.toggleContainer}>
            <View style={styles.toggleInfo}>
              <ThemedText style={styles.toggleLabel}>
                {t('game.ui.gameTypeLabel', { locale })}
              </ThemedText>
            </View>
            <View style={styles.gameTypeButtons}>
              <TouchableOpacity
                style={[
                  styles.gameTypeButton,
                  (game.gameType ?? 'mirror') === 'mirror' && styles.gameTypeButtonActive,
                ]}
                onPress={() => setGameType('mirror')}
                activeOpacity={0.8}
              >
                <ThemedText style={[
                  styles.gameTypeButtonText,
                  (game.gameType ?? 'mirror') === 'mirror' && styles.gameTypeButtonTextActive,
                ]}>
                  {t('game.ui.gameTypeMirror', { locale })}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.gameTypeButton,
                  game.gameType === 'basket' && styles.gameTypeButtonActive,
                ]}
                onPress={() => setGameType('basket')}
                activeOpacity={0.8}
              >
                <ThemedText style={[
                  styles.gameTypeButtonText,
                  game.gameType === 'basket' && styles.gameTypeButtonTextActive,
                ]}>
                  {t('game.ui.gameTypeBasket', { locale })}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
```

Add `TouchableOpacity` to the React Native import at the top if not already present.

Add the style entries at the bottom of the `StyleSheet.create({...})` in `WaitingPhase.tsx`:

```typescript
  gameTypeButtons: { flexDirection: 'row', gap: 8 },
  gameTypeButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: GameColors.blue,
  },
  gameTypeButtonActive: {
    backgroundColor: GameColors.blue,
  },
  gameTypeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: GameColors.blue,
  },
  gameTypeButtonTextActive: {
    color: GameColors.white,
  },
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- __tests__/WaitingPhase.test.tsx
```

Expected: PASS — all new tests green, all existing tests green.

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add components/game/mirror/WaitingPhase.tsx __tests__/WaitingPhase.test.tsx
git commit -m "feat: add game type toggle to WaitingPhase (TDD)"
```

---

## Self-Review

### Spec coverage

| Spec requirement | Task |
|---|---|
| `gameType?: 'mirror' \| 'basket'` on Game | Task 2 |
| `setGameType` method in GameContext | Task 3 |
| Folder structure `mirror/` + `basket/` | Task 4 + 5 |
| `BasketScreen` placeholder | Task 5 |
| GameScreen routing for basket | Task 6 |
| WaitingPhase two-button toggle | Task 7 |
| i18n keys (en + uk) | Task 1 |
| Test: `setGameType` calls `updateDoc` | Task 3 |
| Test: GameScreen shows BasketScreen when `gameType=basket` | Task 6 |
| Test: WaitingPhase toggle calls `setGameType` | Task 7 |
| Backward compat: absent `gameType` → mirror | Task 3 no-op test + Task 6 routing |
| Leave button stays outside basket routing | Task 6 (basket wrapped in Animated.View inner, leave button is outside) |

### Placeholder scan

No TBDs or TODOs — all steps contain actual code.

### Type consistency

- `setGameType` typed as `(type: 'mirror' | 'basket') => Promise<void>` in interface (Task 3 step 3) and implementation (Task 3 step 4). Same signature used in component call sites.
- `BasketScreen` props: `game: Game`, `user: { uid: string } | null`, `locale: string` — matches the call site in `GameScreen.tsx`.
- `gameType?: 'mirror' | 'basket'` on `Game` — optional, defaults to `'mirror'` at all read sites via `?? 'mirror'`.
