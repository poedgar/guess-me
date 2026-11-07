# Mirror Admin Visibility & Player Numbers — Expo Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `apps/expo`'s mirror game mode to parity with the `apps/web` implementation (see `docs/superpowers/plans/2026-07-22-mirror-admin-visibility-and-player-numbers.md`): a live admin comment-completion checklist during the writing phase, and stable per-participant numbers frozen at game start — used specifically by that checklist and by the guessing-phase author pills.

**Architecture:** `apps/expo` is a separate, independently-implemented app from `apps/web` (own `GameContext.tsx`, own `locales/`, own `utils/participants.ts` — nothing is actually shared between them despite the `packages/shared` package name; that package is consumed by `apps/web` only). Unlike web, Expo's mirror UI **already** shows join-order participant numbers almost everywhere (`Leaderboard`, `WaitingPhase`, `PostGuessingPointsPanel`, `ResultsPhase`, and the guessing-phase author pills) via a `joinIndexById: Record<string, number>` prop computed fresh on every render in `GameScreen.tsx` and threaded down through a `sharedProps` object. The admin comment-completion checklist does not exist at all.

This plan adds a `playerNumbers` field to the `Game` type (frozen at `startGame()`, exactly like web) and introduces it as a **second, additive** prop alongside the existing `joinIndexById` — it does **not** replace `joinIndexById`'s existing dynamic behavior anywhere. Per an explicit product decision, the Leaderboard, `WaitingPhase`, `PostGuessingPointsPanel`, and `ResultsPhase` keep their current dynamic (re-sorted-on-every-render) numbering unchanged. Only two things read the new frozen numbers: the new admin checklist, and the guessing-phase author pills (`GuessingPhase.tsx`, which switches from `joinIndexById` to the new prop for that one purpose).

**Tech Stack:** Expo SDK 54, React Native, TypeScript (strict), Firebase Firestore, i18n-js, Jest + `@testing-library/react-native` (`jest-expo` preset). Unlike `apps/web`, this app has a full working test suite (`npm test` from `apps/expo`) — use it. Every task in this plan is TDD: write the failing test, watch it fail, implement, watch it pass, commit.

## Global Constraints

- Scope is `apps/expo`, mirror game mode only. Do not touch `apps/web` or `packages/shared` (already handled by the other plan), and do not touch the `basket`/`clash` modes.
- Do NOT change `joinIndexById`'s existing dynamic behavior in `Leaderboard.tsx`, `WaitingPhase.tsx`, `PostGuessingPointsPanel.tsx`, `ResultsPhase.tsx`, or `app/(tabs)/results.tsx` — confirmed with the user: these must keep their current live/dynamic numbering, not the new frozen numbering.
- Strict TypeScript, no `any` without justification. All user-facing strings via `t()`, added to both `apps/expo/locales/en.json` and `apps/expo/locales/uk.json`.
- If `node`/`npx`/`npm` aren't on `PATH` in your shell, this repo pins Node via `.nvmrc` (`v22.22.2`) — run `nvm use` first, or `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"`.
- **Baseline test failure (pre-existing, not yours):** `__tests__/ActivePhase.test.tsx` — `'ActivePhase — 6.1 loading text uses i18n key' › shows t("common.loading") not hardcoded Ukrainian when loading` currently fails (confirmed before this plan was written, unrelated to this work). Don't try to fix it as part of this plan; just confirm it's the *only* pre-existing failure and that your changes don't add new ones.
- Run all test/verify commands from `apps/expo/` (`cd apps/expo` first) unless noted otherwise.

---

## Task 1: `playerNumbers` data model — assign once at game start

**Files:**
- Modify: `apps/expo/contexts/GameContext.tsx`
- Create: `apps/expo/__tests__/GameContext.startGame.test.tsx`

**Interfaces:**
- Produces: `Game.playerNumbers?: { [userId: string]: number }`.
- Consumes: `buildJoinIndexById` from `@/utils/participants` (already exists at `apps/expo/utils/participants.ts:16`, already used elsewhere in this app — no new utility needed).

- [ ] **Step 1: Confirm the baseline**

```bash
cd apps/expo
npm test -- __tests__/participants.test.ts __tests__/ActivePhase.test.tsx __tests__/GuessingPhase.test.tsx __tests__/GameScreen.memo.test.tsx
```

Expected: everything passes except the one pre-existing `ActivePhase` failure described in Global Constraints. If you see *other* failures, stop and investigate before proceeding — they aren't something this plan accounts for.

- [ ] **Step 2: Write the failing test**

Create `apps/expo/__tests__/GameContext.startGame.test.tsx`:

```tsx
// TDD: startGame() must assign a frozen playerNumbers map from join order.
import { act, renderHook } from '@testing-library/react-native';
import React from 'react';
import { GameProvider, useGame } from '../contexts/GameContext';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'admin-uid', displayName: 'Admin', email: 'admin@test.com', photoURL: null },
    isSignedIn: true,
  }),
}));

jest.mock('@/config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'admin-uid' }, signOut: jest.fn(() => Promise.resolve()) },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <GameProvider>{children}</GameProvider>
);

function makeWaitingGameDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'game-x',
    adminId: 'admin-uid',
    adminName: 'Admin',
    adminEmail: 'admin@test.com',
    status: 'waiting',
    participants: [
      { userId: 'admin-uid', userName: 'Admin', userEmail: 'admin@test.com', joinedAt: new Date(0) },
      { userId: 'player-uid', userName: 'Player', userEmail: 'p@test.com', joinedAt: new Date(1) },
      { userId: 'third-uid', userName: 'Third', userEmail: 't@test.com', joinedAt: new Date(2) },
    ],
    rounds: [],
    scores: {},
    guessingData: { commentsByTarget: {}, possibleAuthors: [], playersWhoSubmittedGuesses: [], allPlayersSubmitted: false },
    guessResults: {},
    createdAt: new Date(),
    currentRound: null,
    adminWritesComments: false,
    showSurnames: false,
    showGuessResults: false,
    targetSelectionMode: 'random',
    adminAwards: {},
    ...overrides,
  };
}

function makeSnap(data: Record<string, unknown>, id = 'game-x') {
  return { exists: () => true, id, data: () => data };
}

function setupEnterGame(firestore: ReturnType<typeof require>, gameDoc: Record<string, unknown>) {
  firestore.doc.mockReturnValue({ path: 'games/game-x' });
  firestore.setDoc.mockResolvedValue(undefined);
  firestore.updateDoc.mockResolvedValue(undefined);
  firestore.serverTimestamp.mockReturnValue(new Date());
  firestore.arrayUnion.mockImplementation((v: unknown) => v);
  firestore.onSnapshot.mockReturnValue(jest.fn());

  firestore.getDoc
    .mockResolvedValueOnce({ exists: () => true, data: () => ({ password: 'SECRET' }) })
    .mockResolvedValueOnce({ exists: () => false });

  firestore.onSnapshot.mockImplementationOnce((_ref: unknown, cb: (s: unknown) => void) => {
    cb(makeSnap(gameDoc));
    return jest.fn();
  });
}

describe('startGame — assigns frozen playerNumbers from join order', () => {
  it('writes playerNumbers mapping each participant to their 1-based join position', async () => {
    const firestore = require('firebase/firestore');
    setupEnterGame(firestore, makeWaitingGameDoc());

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.startGame(); });

    const startCalls = firestore.updateDoc.mock.calls.filter(
      (call: unknown[]) => (call[1] as Record<string, unknown>).status === 'active',
    );
    expect(startCalls.length).toBe(1);
    const payload = startCalls[0][1] as Record<string, unknown>;
    expect(payload.playerNumbers).toEqual({
      'admin-uid': 1,
      'player-uid': 2,
      'third-uid': 3,
    });
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

```bash
npm test -- __tests__/GameContext.startGame.test.tsx
```

Expected: FAIL — `payload.playerNumbers` is `undefined` (the field doesn't exist yet).

- [ ] **Step 4: Add `playerNumbers` to the `Game` interface**

In `apps/expo/contexts/GameContext.tsx`, the `Game` interface currently ends with:

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

- [ ] **Step 5: Import `buildJoinIndexById`**

Change the top import line:

```ts
import { sortParticipantsByJoin } from "@/utils/participants";
```

to:

```ts
import { sortParticipantsByJoin, buildJoinIndexById } from "@/utils/participants";
```

- [ ] **Step 6: Assign `playerNumbers` in `startGame()`**

In `apps/expo/contexts/GameContext.tsx`, `startGame()`'s `updateDoc` call currently reads:

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

- [ ] **Step 7: Run the test again and confirm it passes**

```bash
npm test -- __tests__/GameContext.startGame.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Run the wider suite to confirm no regressions**

```bash
npm test -- __tests__/GameContext.test.tsx __tests__/GameContext.createGame.test.tsx __tests__/GameFlow.integration.test.tsx
```

Expected: all pass (these exercise `startGame()` indirectly and assert on other fields in the same `updateDoc` payload — confirm your addition didn't break their existing assertions).

- [ ] **Step 9: Commit**

```bash
git add contexts/GameContext.tsx __tests__/GameContext.startGame.test.tsx
git commit -m "$(cat <<'EOF'
Assign stable player numbers at mirror game start (Expo)

Mirrors the apps/web change: adds a playerNumbers map to the Game type,
populated once in startGame() from the existing buildJoinIndexById util.
EOF
)"
```

---

## Task 2: Thread frozen numbers to the guessing-phase author pills

**Files:**
- Modify: `apps/expo/components/game/GameScreen.tsx`
- Modify: `apps/expo/components/game/mirror/GuessingPhase.tsx`
- Create: `apps/expo/__tests__/GameScreen.playerNumbers.test.tsx`
- Modify: `apps/expo/__tests__/GuessingPhase.test.tsx`

**Interfaces:**
- Consumes: `Game.playerNumbers` (Task 1).
- Produces: a new `playerNumbers: Record<string, number>` value added to `GameScreen.tsx`'s `sharedProps` object (alongside the existing, unchanged `joinIndexById`), and a new optional `playerNumbers?: Record<string, number>` prop on `GuessingPhase`.

- [ ] **Step 1: Write the failing `GameScreen` wiring test**

Create `apps/expo/__tests__/GameScreen.playerNumbers.test.tsx`:

```tsx
// TDD: GameScreen must pass a frozen playerNumbers prop (from game.playerNumbers,
// falling back to the existing dynamic joinIndexById) to ActivePhase.
import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

let capturedActivePhaseProps: any = null;
jest.mock('@/components/game/mirror/ActivePhase', () => ({
  ActivePhase: (props: any) => { capturedActivePhaseProps = props; return null; },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/components/LanguageSelector', () => ({ LanguageSelector: () => null }));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/ui/PlayerAvatar', () => ({ PlayerAvatar: () => null }));
jest.mock('@/components/ui/TargetControlPanel', () => ({ TargetControlPanel: () => null }));
jest.mock('@/components/ui/HeaderLogo', () => ({ HeaderLogo: () => null }));
jest.mock('@/components/SoundToggle', () => ({ SoundToggle: () => null }));
jest.mock('@/components/ui/FancyAlert', () => ({ FancyAlert: () => null }));
jest.mock('@/components/ui/FaceMessage', () => ({ FaceMessage: () => null }));
jest.mock('@/components/ui/SuccessAnimation', () => ({ SuccessAnimation: () => null }));
jest.mock('@/components/game/Leaderboard', () => ({ Leaderboard: () => null }));
jest.mock('@/components/game/mirror/PostGuessingPointsPanel', () => ({ __esModule: true, default: () => null }));
jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('@/i18n', () => ({ t: (key: string) => key }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ locale: 'en', setLocale: jest.fn() }),
}));
jest.mock('@/contexts/SoundContext', () => ({
  useSound: () => ({ playSound: jest.fn() }),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));
jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));

const mockUser = { uid: 'u1', displayName: 'Alice', email: 'alice@test.com' };
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, isSignedIn: true }),
}));

let mockCurrentGame: any = null;
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
  }),
}));

const PARTICIPANTS = [
  { userId: 'u1', userName: 'Alice', userEmail: 'a@test.com', joinedAt: new Date(0) },
  { userId: 'u2', userName: 'Bob', userEmail: 'b@test.com', joinedAt: new Date(1) },
];

const ACTIVE_ROUND = {
  roundNumber: 1,
  targetUserId: 'u2',
  targetUserName: 'Bob',
  comments: [],
  commentsVisible: false,
  pointsGiven: false,
  startedAt: new Date(),
};

function baseGame(overrides: Record<string, unknown> = {}) {
  return {
    id: 'game-pn',
    adminId: 'u1',
    adminName: 'Alice',
    status: 'active',
    participants: PARTICIPANTS,
    rounds: [ACTIVE_ROUND],
    scores: {},
    guessingData: { commentsByTarget: {}, possibleAuthors: [] },
    guessResults: {},
    currentRound: ACTIVE_ROUND,
    adminWritesComments: false,
    showSurnames: false,
    showGuessResults: false,
    targetSelectionMode: 'random',
    ...overrides,
  };
}

const { GameScreen } = require('../components/game/GameScreen');

function renderScreen() {
  return render(<SafeAreaProvider><GameScreen /></SafeAreaProvider>);
}

describe('GameScreen — playerNumbers passed to ActivePhase', () => {
  beforeEach(() => {
    capturedActivePhaseProps = null;
  });

  it('uses the frozen game.playerNumbers when present', () => {
    mockCurrentGame = baseGame({ playerNumbers: { u1: 1, u2: 2 } });
    renderScreen();
    expect(capturedActivePhaseProps.playerNumbers).toEqual({ u1: 1, u2: 2 });
  });

  it('falls back to the dynamic join-order numbering when playerNumbers is absent', () => {
    mockCurrentGame = baseGame();
    renderScreen();
    expect(capturedActivePhaseProps.playerNumbers).toEqual({ u1: 1, u2: 2 });
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npm test -- __tests__/GameScreen.playerNumbers.test.tsx
```

Expected: FAIL — `capturedActivePhaseProps.playerNumbers` is `undefined` (`sharedProps` doesn't include it yet).

- [ ] **Step 3: Add the `playerNumbers` value to `GameScreen.tsx`**

`apps/expo/components/game/GameScreen.tsx` currently has:

```ts
  const joinIndexById = useMemo(
    () => buildJoinIndexById(participantsByJoin),
    [participantsByJoin],
  );
```

Change it to:

```ts
  const joinIndexById = useMemo(
    () => buildJoinIndexById(participantsByJoin),
    [participantsByJoin],
  );

  // Frozen-at-start numbers for the admin checklist and guess-picker only.
  // Falls back to the live joinIndexById for games created before this field existed.
  const playerNumbers = useMemo(
    () => currentGame?.playerNumbers ?? joinIndexById,
    [currentGame?.playerNumbers, joinIndexById],
  );
```

Then, in the same file, `sharedProps` currently reads:

```ts
  const sharedProps = {
    game: currentGame!,
    isAdmin,
    user,
    participantsByJoin,
    joinIndexById,
    getDisplayName,
    showFancyAlert,
    showFaceMessage,
    locale,
    isDark,
  };
```

Change it to:

```ts
  const sharedProps = {
    game: currentGame!,
    isAdmin,
    user,
    participantsByJoin,
    joinIndexById,
    playerNumbers,
    getDisplayName,
    showFancyAlert,
    showFaceMessage,
    locale,
    isDark,
  };
```

This adds `playerNumbers` to what's spread into `WaitingPhase`, `ActivePhase`, and `GuessingPhase` alike (all three receive `{...sharedProps}`). `WaitingPhase` will silently ignore the extra prop (it isn't declared in — or used by — its `Props` interface), matching this app's existing pattern of over-supplying `sharedProps` to phase components that don't need every field.

- [ ] **Step 4: Run the wiring test again and confirm it passes**

```bash
npm test -- __tests__/GameScreen.playerNumbers.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run the existing memoization test to confirm no regression**

```bash
npm test -- __tests__/GameScreen.memo.test.tsx
```

Expected: PASS unchanged (it only spies on `sortParticipantsByJoin`, which this step doesn't touch).

- [ ] **Step 6: Write the failing `GuessingPhase` numbering test**

In `apps/expo/__tests__/GuessingPhase.test.tsx`, add this new `describe` block at the end of the file (after the existing `'GuessingPhase — 7.3 ...'` block):

```tsx
// ─── playerNumbers takes precedence over joinIndexById for author-pill numbers ──

describe('GuessingPhase — playerNumbers prop numbers the author pills', () => {
  const COMMENT = { id: 'c1', text: 'Great player', authorId: 'admin-1' };

  it('uses playerNumbers instead of joinIndexById when both are supplied', () => {
    const { getByText, queryByText } = render(
      <GuessingPhase
        game={makeGame()}
        isAdmin={false}
        user={{ uid: PLAYER_UID }}
        participantsByJoin={participants}
        joinIndexById={{ 'admin-1': 1, [PLAYER_UID]: 2, [TARGET_UID]: 3 }}
        playerNumbers={{ 'admin-1': 9, [PLAYER_UID]: 8, [TARGET_UID]: 7 }}
        getDisplayName={(name: string) => name.split(' ')[0]}
        commentsForPlayer={[COMMENT]}
        showFancyAlert={jest.fn()}
        locale="en"
      />
    );
    expect(getByText('9. Admin')).toBeTruthy();
    expect(queryByText('1. Admin')).toBeNull();
  });

  it('falls back to joinIndexById when playerNumbers is not supplied', () => {
    const { getByText } = render(
      <GuessingPhase
        game={makeGame()}
        isAdmin={false}
        user={{ uid: PLAYER_UID }}
        participantsByJoin={participants}
        joinIndexById={{ 'admin-1': 1, [PLAYER_UID]: 2, [TARGET_UID]: 3 }}
        getDisplayName={(name: string) => name.split(' ')[0]}
        commentsForPlayer={[COMMENT]}
        showFancyAlert={jest.fn()}
        locale="en"
      />
    );
    expect(getByText('1. Admin')).toBeTruthy();
  });
});
```

- [ ] **Step 7: Run it and confirm the first test fails**

```bash
npm test -- __tests__/GuessingPhase.test.tsx
```

Expected: the new `'uses playerNumbers instead of joinIndexById...'` test FAILS (pill still reads "1. Admin", `playerNumbers` prop doesn't exist on the component yet so it's ignored); the fallback test passes already (no code change needed for it since it doesn't pass `playerNumbers`).

- [ ] **Step 8: Add the `playerNumbers` prop to `GuessingPhase.tsx`**

In `apps/expo/components/game/mirror/GuessingPhase.tsx`, the `Props` interface currently includes:

```ts
interface Props {
  game: Game;
  isAdmin: boolean;
  user: { uid: string } | null;
  participantsByJoin: Participant[];
  joinIndexById: Record<string, number>;
  getDisplayName: (name: string) => string;
  commentsForPlayer: Comment[];
  showFancyAlert: ShowFancyAlertFn;
  locale: string;
}
```

Change it to:

```ts
interface Props {
  game: Game;
  isAdmin: boolean;
  user: { uid: string } | null;
  participantsByJoin: Participant[];
  joinIndexById: Record<string, number>;
  playerNumbers?: Record<string, number>;
  getDisplayName: (name: string) => string;
  commentsForPlayer: Comment[];
  showFancyAlert: ShowFancyAlertFn;
  locale: string;
}
```

The component's destructured parameters currently read:

```ts
export const GuessingPhase: React.FC<Props> = ({
  game,
  isAdmin,
  user,
  participantsByJoin,
  joinIndexById,
  getDisplayName,
  commentsForPlayer,
  showFancyAlert,
  locale,
}) => {
```

Change it to:

```ts
export const GuessingPhase: React.FC<Props> = ({
  game,
  isAdmin,
  user,
  participantsByJoin,
  joinIndexById,
  playerNumbers,
  getDisplayName,
  commentsForPlayer,
  showFancyAlert,
  locale,
}) => {
```

- [ ] **Step 9: Use it for the author-pill numbering**

The author-pill line currently reads:

```tsx
                          <ThemedText style={[
                            styles.authorName,
                            selectedGuesses[comment.id] === author.userId && styles.selectedAuthorName,
                          ]}>
                            {joinIndexById[author.userId] ? `${joinIndexById[author.userId]}. ` : ''}{getDisplayName(author.userName)}
                          </ThemedText>
```

Change it to:

```tsx
                          <ThemedText style={[
                            styles.authorName,
                            selectedGuesses[comment.id] === author.userId && styles.selectedAuthorName,
                          ]}>
                            {(() => {
                              const numbers = playerNumbers ?? joinIndexById;
                              return numbers[author.userId] ? `${numbers[author.userId]}. ` : '';
                            })()}{getDisplayName(author.userName)}
                          </ThemedText>
```

- [ ] **Step 10: Run the tests again and confirm they pass**

```bash
npm test -- __tests__/GuessingPhase.test.tsx
```

Expected: PASS, all tests including both new ones.

- [ ] **Step 11: Run the full existing suite for this area to confirm no regressions**

```bash
npm test -- __tests__/GameScreen.test.tsx __tests__/GameScreen.memo.test.tsx __tests__/GameScreen.adminLeft.test.tsx __tests__/GuessingPhase.test.tsx
```

Expected: all pass (same pre-existing baseline as Task 1 — no new failures).

- [ ] **Step 12: Commit**

```bash
git add components/game/GameScreen.tsx components/game/mirror/GuessingPhase.tsx __tests__/GameScreen.playerNumbers.test.tsx __tests__/GuessingPhase.test.tsx
git commit -m "$(cat <<'EOF'
Number guessing-phase author pills with frozen player numbers (Expo)

Adds an additive playerNumbers prop (game.playerNumbers, falling back to
the existing dynamic joinIndexById) used only by the author pills.
Leaderboard, WaitingPhase, PostGuessingPointsPanel, and ResultsPhase keep
their existing dynamic numbering unchanged, per product decision.
EOF
)"
```

---

## Task 3: Admin comment-completion checklist

**Files:**
- Modify: `apps/expo/components/game/mirror/ActivePhase.tsx`
- Modify: `apps/expo/locales/en.json`
- Modify: `apps/expo/locales/uk.json`
- Modify: `apps/expo/__tests__/ActivePhase.test.tsx`

**Interfaces:**
- Consumes: `playerNumbers?: Record<string, number>` and the existing `joinIndexById: Record<string, number>` prop (Task 2) — same "prefer frozen, fall back to dynamic" pattern as `GuessingPhase`.
- Consumes: `game.currentRound.comments: Comment[]` (each with `authorId: string`) and `game.participants`, `game.adminId`, `game.adminWritesComments` — no new context methods, pure derived UI state.

- [ ] **Step 1: Add the new locale keys**

In `apps/expo/locales/en.json`, the block currently reads:

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

In `apps/expo/locales/uk.json`, the block currently reads:

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

- [ ] **Step 2: Write the failing tests**

In `apps/expo/__tests__/ActivePhase.test.tsx`, add this new `describe` block at the end of the file (after the existing `'ActivePhase — 6.1 ...'` block). It needs its own `makeGame()`-style fixture because the existing one has `commentsVisible: true` by default and doesn't vary submitted/pending state:

```tsx
// ─── admin comment-completion checklist ──────────────────────────────────────

describe('ActivePhase — admin comment-completion checklist', () => {
  function makeWritingPhaseGame(overrides: Record<string, unknown> = {}) {
    return {
      id: 'game-1',
      adminId: 'admin-1',
      adminName: 'Admin User',
      status: 'active',
      adminWritesComments: true,
      showSurnames: true,
      participants,
      playersWhoCompletedPostCommentPhase: [],
      scores: {},
      postGuessingPointPhase: false,
      currentRound: {
        roundNumber: 1,
        targetUserId: TARGET_UID,
        targetUserName: TARGET_NAME,
        // Only player-1 has submitted so far; admin-1 (expected, since
        // adminWritesComments is true) has not.
        comments: [
          { id: 'c1', text: 'Nice work', authorId: PLAYER_UID },
        ],
        commentsVisible: false,
        pointsGiven: false,
        targetPointsGivenBy: [],
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    mockGivePointsToTarget = jest.fn().mockResolvedValue(undefined);
  });

  it('shows the checklist with progress count and per-player status while writing', () => {
    const { getByText } = render(
      <ActivePhase
        game={makeWritingPhaseGame()}
        isAdmin
        user={{ uid: 'admin-1' }}
        participantsByJoin={participants}
        joinIndexById={joinIndexById}
        playerNumbers={joinIndexById}
        getDisplayName={(name: string) => name.split(' ')[0]}
        showFancyAlert={jest.fn()}
        showFaceMessage={jest.fn()}
        locale="en"
        isDark={false}
      />
    );

    expect(getByText('game.ui.commentersStatusTitle')).toBeTruthy();
    // received=1, required=2 (admin-1 and player-1 are expected; target-1 excluded)
    expect(getByText('game.ui.commentsProgress[1:2]')).toBeTruthy();
    // player-1 already submitted
    expect(getByText(`✅ game.ui.submitted`)).toBeTruthy();
    // admin-1 has not
    expect(getByText(`⏳ game.ui.pending`)).toBeTruthy();
  });

  it('does not show the checklist once comments are visible', () => {
    const { queryByText } = render(
      <ActivePhase
        game={makeWritingPhaseGame({
          currentRound: {
            roundNumber: 1,
            targetUserId: TARGET_UID,
            targetUserName: TARGET_NAME,
            comments: [
              { id: 'c1', text: 'Nice work', authorId: PLAYER_UID },
              { id: 'c2', text: 'Great too', authorId: 'admin-1' },
            ],
            commentsVisible: true,
            pointsGiven: false,
            targetPointsGivenBy: [],
          },
        })}
        isAdmin
        user={{ uid: 'admin-1' }}
        participantsByJoin={participants}
        joinIndexById={joinIndexById}
        playerNumbers={joinIndexById}
        getDisplayName={(name: string) => name.split(' ')[0]}
        showFancyAlert={jest.fn()}
        showFaceMessage={jest.fn()}
        locale="en"
        isDark={false}
      />
    );

    expect(queryByText('game.ui.commentersStatusTitle')).toBeNull();
  });

  it('is not shown to non-admin players', () => {
    const { queryByText } = render(
      <ActivePhase
        game={makeWritingPhaseGame()}
        isAdmin={false}
        user={{ uid: PLAYER_UID }}
        participantsByJoin={participants}
        joinIndexById={joinIndexById}
        playerNumbers={joinIndexById}
        getDisplayName={(name: string) => name.split(' ')[0]}
        showFancyAlert={jest.fn()}
        showFaceMessage={jest.fn()}
        locale="en"
        isDark={false}
      />
    );

    expect(queryByText('game.ui.commentersStatusTitle')).toBeNull();
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

```bash
npm test -- __tests__/ActivePhase.test.tsx
```

Expected: the three new tests FAIL (`getByText('game.ui.commentersStatusTitle')` not found — nothing renders it yet). The pre-existing baseline failure from Global Constraints is still there too; ignore it, don't let it block you — you're only checking that your three new tests currently fail for the *expected* reason.

- [ ] **Step 4: Add `playerNumbers` to `ActivePhase.tsx`'s `Props`**

The `Props` interface currently reads:

```ts
interface Props {
  game: Game;
  isAdmin: boolean;
  user: { uid: string } | null;
  participantsByJoin: Participant[];
  joinIndexById: Record<string, number>;
  getDisplayName: (name: string) => string;
  showFancyAlert: ShowFancyAlertFn;
  showFaceMessage: (message: string, face?: string) => void; 
  locale: string;
  isDark: boolean;
}
```

Change it to:

```ts
interface Props {
  game: Game;
  isAdmin: boolean;
  user: { uid: string } | null;
  participantsByJoin: Participant[];
  joinIndexById: Record<string, number>;
  playerNumbers?: Record<string, number>;
  getDisplayName: (name: string) => string;
  showFancyAlert: ShowFancyAlertFn;
  showFaceMessage: (message: string, face?: string) => void; 
  locale: string;
  isDark: boolean;
}
```

The component's destructured parameters currently read:

```ts
export const ActivePhase: React.FC<Props> = ({
  game,
  isAdmin,
  user,
  participantsByJoin,
  joinIndexById,
  getDisplayName,
  showFancyAlert,
  showFaceMessage,
  locale,
  isDark,
}) => {
```

Change it to:

```ts
export const ActivePhase: React.FC<Props> = ({
  game,
  isAdmin,
  user,
  participantsByJoin,
  joinIndexById,
  playerNumbers,
  getDisplayName,
  showFancyAlert,
  showFaceMessage,
  locale,
  isDark,
}) => {
```

- [ ] **Step 5: Derive the checklist data**

`ActivePhase.tsx` has this early-return guard partway down the component body:

```ts
  if (!game.currentRound) return null;

  return (
```

Change it to:

```ts
  if (!game.currentRound) return null;

  const numbers = playerNumbers ?? joinIndexById;
  const expectedCommenters = game.participants.filter(p => {
    if (p.userId === game.currentRound!.targetUserId) return false;
    if (p.userId === game.adminId && !game.adminWritesComments) return false;
    return true;
  });
  const submittedAuthorIds = new Set(game.currentRound.comments?.map((c: Comment) => c.authorId) ?? []);
  const submittedCount = expectedCommenters.filter(p => submittedAuthorIds.has(p.userId)).length;

  return (
```

`expectedCommenters` is deliberately a plain computation, not `useMemo` — it's placed after the `if (!game.currentRound) return null;` guard (hooks can't follow a conditional return, but plain consts can), matching how several other derived values already work further down in this same component (e.g. `shouldUserWriteComments`, `userComment` inside the non-target branch).

- [ ] **Step 6: Render the checklist**

The admin-controls block currently reads:

```tsx
        {/* Admin controls */}
        {isAdmin && (
          <View style={styles.adminControls}>
            <View style={styles.adminButtonsRow}>
              {!game.currentRound.commentsVisible && (
```

Change the opening of that block to:

```tsx
        {/* Admin controls */}
        {isAdmin && (
          <View style={styles.adminControls}>
            {!game.currentRound.commentsVisible && (
              <View style={styles.checklistContainer}>
                <ThemedText style={styles.checklistTitle}>
                  {t('game.ui.commentersStatusTitle', { locale })}
                </ThemedText>
                <ThemedText style={styles.checklistProgress}>
                  {t('game.ui.commentsProgress', { locale, received: submittedCount, required: expectedCommenters.length })}
                </ThemedText>
                {expectedCommenters.map(p => {
                  const hasSubmitted = submittedAuthorIds.has(p.userId);
                  return (
                    <View key={p.userId} style={styles.checklistRow}>
                      <ThemedText style={styles.checklistNumber}>
                        {numbers[p.userId] ? `${numbers[p.userId]}.` : ''}
                      </ThemedText>
                      <ThemedText style={styles.checklistName}>{getDisplayName(p.userName)}</ThemedText>
                      <ThemedText style={hasSubmitted ? styles.checklistStatusDone : styles.checklistStatusPending}>
                        {hasSubmitted ? `✅ ${t('game.ui.submitted', { locale })}` : `⏳ ${t('game.ui.pending', { locale })}`}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            )}
            <View style={styles.adminButtonsRow}>
              {!game.currentRound.commentsVisible && (
```

The rest of that block (the "Show Comments" / "Start guessing phase" buttons and their closing tags) is unchanged — you're only adding the new `checklistContainer` View before the existing `adminButtonsRow` View, both now siblings inside the same outer `styles.adminControls` View.

- [ ] **Step 7: Add the new styles**

At the bottom of `ActivePhase.tsx`, the `styles` object (`StyleSheet.create({...})`) currently includes `adminControls` and `adminButtonsRow`. Add these new keys anywhere in that object:

```ts
  checklistContainer: { marginBottom: 12, padding: 12, borderRadius: 8, backgroundColor: GameColors.cardBg },
  checklistTitle: { textAlign: 'center', fontWeight: '600', fontSize: 14, marginBottom: 4, fontFamily: Fonts.sans },
  checklistProgress: { textAlign: 'center', fontSize: 12, opacity: 0.7, marginBottom: 8, fontFamily: Fonts.sans },
  checklistRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  checklistNumber: { width: 20, fontSize: 13, opacity: 0.6, fontFamily: Fonts.sans },
  checklistName: { flex: 1, fontSize: 13, fontWeight: '500', fontFamily: Fonts.sans },
  checklistStatusDone: { fontSize: 12, fontWeight: '600', color: GameColors.green, fontFamily: Fonts.sans },
  checklistStatusPending: { fontSize: 12, fontWeight: '600', opacity: 0.5, fontFamily: Fonts.sans },
```

- [ ] **Step 8: Run the tests again and confirm they pass**

```bash
npm test -- __tests__/ActivePhase.test.tsx
```

Expected: PASS for all your new tests, plus the same three pre-existing tests that passed before (`3.3`, `7.1`) — and the same single pre-existing `6.1` failure from Global Constraints, unchanged.

- [ ] **Step 9: Run the full suite to confirm no regressions elsewhere**

```bash
npm test
```

Expected: identical failure count to your Step 1 baseline (only the one pre-existing `ActivePhase` `6.1` failure), nothing new.

- [ ] **Step 10: Commit**

```bash
git add components/game/mirror/ActivePhase.tsx locales/en.json locales/uk.json __tests__/ActivePhase.test.tsx
git commit -m "$(cat <<'EOF'
Show admin a live comment-submission checklist during the writing phase (Expo)

Mirrors the apps/web admin checklist. Admin previously had no way to tell
who still needed to write a comment, beyond a received/required warning
shown only when clicking "Show Comments" early.
EOF
)"
```
