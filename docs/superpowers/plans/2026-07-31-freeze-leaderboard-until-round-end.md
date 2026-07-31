# Freeze Leaderboard Until Round End Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every leaderboard display (total scores per player) shows standings as of the end of the last completed round throughout the current round, updating the instant that round finishes — instead of reflecting live, in-progress scoring.

**Architecture:** Two new optional fields on the `Game` document, `roundStartScores` and `roundStartGuessResults`, captured the instant each round begins (`startGame()` for round 1, `startNextRound()` for every later round) from whatever `scores`/`guessResults` already are at that moment. Every leaderboard-rendering component that can appear mid-round reads these frozen fields (falling back to the live fields for backward compatibility with older game documents) instead of the live `scores`/`guessResults` fields directly.

**Tech Stack:** TypeScript (strict), React/React Native, Firebase Firestore. No new dependency.

## Global Constraints

- Scope is mirror mode only. Basket and clash modes never read `scores`/`guessResults` in any component (confirmed via repo-wide grep) — `startBasketGame`/`startClashGame` and all basket/clash components are untouched by this plan.
- `apps/web` consumes a duplicated `Game` interface from **two** places that must be kept structurally identical: `packages/shared/src/types.ts` (imported by components) and `apps/web/src/contexts/GameContext.tsx`'s own local `Game` interface (used internally by the context, e.g. `gameDoc.data() as Game`). Both must get the new fields — this duplication already exists in the codebase (e.g. `playerNumbers` is present in both) and is not something this plan introduces or should fix.
- `apps/expo` does not consume `packages/shared` (per project convention) — its own local `Game` interface in `apps/expo/contexts/GameContext.tsx` is the only place to edit there.
- New fields are optional (`?`) on both interfaces, and every read site uses a `??` fallback to the live field — this is the backward-compatibility requirement for games created before this ships (per `CLAUDE.md`: "New Firebase fields must be added to both the TypeScript interface and handled for backward compatibility").
- `apps/web` has no test runner (established in prior work) — verify web changes via `tsc --noEmit` only.
- `apps/expo` has a real Jest suite — run test commands from `apps/expo/` (`cd apps/expo` first). If `node`/`npx`/`npm` aren't on PATH, `export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"` first.
- Do not change `WaitingPhase.tsx` or `ResultsPhase.tsx` on either platform — both already show the correct thing (pre-game scores are always `{}`; the finished-game screen already shows live final totals) and are out of scope.
- Do not change the "Round History" section on the Results tab/page (either platform) — it already correctly gates on `commentsVisible && pointsGiven` per round and needs no changes.

---

## Task 1: Web data model — `roundStartScores`/`roundStartGuessResults`

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `apps/web/src/contexts/GameContext.tsx`

**Interfaces:**
- Produces: `Game.roundStartScores?: { [userId: string]: number }` and `Game.roundStartGuessResults?: { [userId: string]: { correctGuesses: number } }`, on both the shared and the local `Game` interface. Task 2 (web component wiring) consumes these two field names exactly as given here.

- [ ] **Step 1: Add the two fields to `packages/shared/src/types.ts`**

The `Game` interface currently ends:

```typescript
  adminNextTargetPreference?: string;
  adminSkippedTargets?: string[];
  // Stable per-participant display numbers, assigned once when the game starts.
  // Frozen for the lifetime of the game — does not shift if participants later leave.
  playerNumbers?: { [userId: string]: number };
}
```

Change it to:

```typescript
  adminNextTargetPreference?: string;
  adminSkippedTargets?: string[];
  // Stable per-participant display numbers, assigned once when the game starts.
  // Frozen for the lifetime of the game — does not shift if participants later leave.
  playerNumbers?: { [userId: string]: number };
  // Snapshot of scores/guessResults taken the instant the current round began.
  // Leaderboard displays use these (not the live scores/guessResults fields)
  // while a round is in progress, so round-in-progress scoring stays hidden
  // until the round ends and a fresh snapshot is taken.
  roundStartScores?: { [userId: string]: number };
  roundStartGuessResults?: { [userId: string]: { correctGuesses: number } };
}
```

- [ ] **Step 2: Add the same two fields to `apps/web/src/contexts/GameContext.tsx`'s local `Game` interface**

That interface currently ends (same shape as Step 1, this is the local duplicate):

```typescript
  // Admin target control preferences
  adminNextTargetPreference?: string;
  adminSkippedTargets?: string[];
  // Stable per-participant display numbers, assigned once when the game starts.
  // Frozen for the lifetime of the game — does not shift if participants later leave.
  playerNumbers?: { [userId: string]: number };
}
```

Change it to:

```typescript
  // Admin target control preferences
  adminNextTargetPreference?: string;
  adminSkippedTargets?: string[];
  // Stable per-participant display numbers, assigned once when the game starts.
  // Frozen for the lifetime of the game — does not shift if participants later leave.
  playerNumbers?: { [userId: string]: number };
  // Snapshot of scores/guessResults taken the instant the current round began.
  // Leaderboard displays use these (not the live scores/guessResults fields)
  // while a round is in progress, so round-in-progress scoring stays hidden
  // until the round ends and a fresh snapshot is taken.
  roundStartScores?: { [userId: string]: number };
  roundStartGuessResults?: { [userId: string]: { correctGuesses: number } };
}
```

- [ ] **Step 3: Capture the snapshot in `startGame()`**

The `updateDoc` call in `startGame()` currently reads:

```typescript
      await updateDoc(gameRef, {
        status: "active",
        currentRound: round,
        rounds: [round],
        scores: {},
        playerNumbers: buildJoinIndexById(currentGame.participants),
      });
```

Change it to:

```typescript
      await updateDoc(gameRef, {
        status: "active",
        currentRound: round,
        rounds: [round],
        scores: {},
        roundStartScores: {},
        roundStartGuessResults: {},
        playerNumbers: buildJoinIndexById(currentGame.participants),
      });
```

(Round 1 begins with nobody having scored anything yet, so the snapshot is `{}`, matching the fresh `scores: {}` on the same line.)

- [ ] **Step 4: Capture the snapshot in `startNextRound()`**

The `updateDoc` call in `startNextRound()` currently reads:

```typescript
      await updateDoc(gameRef, {
        currentRound: nextRound,
        rounds: previousRounds,
        postGuessingPointPhase: false,
        playersWhoAwardedPostGuessPoints: [],
        // Reset admin target controls for new round
        adminNextTargetPreference: null,
        adminSkippedTargets: [],
        playersWhoCompletedPostCommentPhase: [],
        guessingData: null,
      });
```

Change it to:

```typescript
      await updateDoc(gameRef, {
        currentRound: nextRound,
        rounds: previousRounds,
        postGuessingPointPhase: false,
        playersWhoAwardedPostGuessPoints: [],
        // Reset admin target controls for new round
        adminNextTargetPreference: null,
        adminSkippedTargets: [],
        playersWhoCompletedPostCommentPhase: [],
        guessingData: null,
        // Freeze the leaderboard for the round that's about to start at
        // whatever scores/guessResults stood the instant it began — i.e.
        // the just-finished round's final results.
        roundStartScores: gameData.scores ?? {},
        roundStartGuessResults: gameData.guessResults ?? {},
      });
```

`gameData` is the freshly-read game document already in scope earlier in this same function (`const gameData = gameDoc.data() as Game;`) — do not re-fetch it.

- [ ] **Step 5: Verify**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx tsc --noEmit -p apps/web/tsconfig.json
```

Confirm no new errors beyond the 3 pre-existing baseline errors (`PostCommentPointsPanel.tsx:69`, `GameContext.tsx:427`, `packages/shared/src/i18n.ts:2`).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/types.ts apps/web/src/contexts/GameContext.tsx
git commit -m "$(cat <<'EOF'
Add roundStartScores/roundStartGuessResults snapshot fields (web)

Captured in startGame() (round 1, empty) and startNextRound() (copy
of the scores/guessResults that stood the instant the new round
began — i.e. the just-finished round's final results). Component
wiring to actually display these instead of live scores is a
separate task.
EOF
)"
```

---

## Task 2: Web component wiring

**Files:**
- Modify: `apps/web/src/components/game/mirror/ActivePhase.tsx`
- Modify: `apps/web/src/components/game/mirror/GuessingPhase.tsx`
- Modify: `apps/web/src/pages/ResultsPage.tsx`

**Interfaces:**
- Consumes: `Game.roundStartScores` and `Game.roundStartGuessResults` (Task 1).

- [ ] **Step 1: `ActivePhase.tsx`**

The `Leaderboard` render currently reads:

```tsx
        <Leaderboard
          participants={game.participants}
          scores={game.scores}
          guessResults={game.guessResults}
          maxHeight="max-h-80"
        />
```

Change it to:

```tsx
        <Leaderboard
          participants={game.participants}
          scores={game.roundStartScores ?? game.scores}
          guessResults={game.roundStartGuessResults ?? game.guessResults}
          maxHeight="max-h-80"
        />
```

- [ ] **Step 2: `GuessingPhase.tsx`**

The `Leaderboard` render currently reads:

```tsx
        <Leaderboard
          participants={game.participants}
          scores={game.scores}
          guessResults={game.guessResults}
          maxHeight="max-h-80"
        />
```

Change it to:

```tsx
        <Leaderboard
          participants={game.participants}
          scores={game.roundStartScores ?? game.scores}
          guessResults={game.roundStartGuessResults ?? game.guessResults}
          maxHeight="max-h-80"
        />
```

(Same substitution as `ActivePhase.tsx` — if the two blocks look identical after editing, that's correct; they're separate call sites with separate JSX contexts.)

- [ ] **Step 3: `ResultsPage.tsx`**

This one needs a status-conditional swap, not a straight substitution — the standalone Results tab is reachable both mid-round (should show frozen) and after the game finishes (should show live final totals, since no further snapshot is ever taken after the last round).

The score computation currently reads:

```tsx
  const participantsWithScores = (currentGame?.participants || [])
    .map(p => {
      const gamePoints = currentGame?.scores?.[p.userId] ?? 0;
      const guessPoints = currentGame?.guessResults?.[p.userId]?.correctGuesses ?? 0;
      return { ...p, gamePoints, guessPoints, totalPoints: gamePoints + guessPoints };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);
```

Change it to:

```tsx
  const displayedScores =
    currentGame?.status === 'finished'
      ? currentGame?.scores
      : (currentGame?.roundStartScores ?? currentGame?.scores);
  const displayedGuessResults =
    currentGame?.status === 'finished'
      ? currentGame?.guessResults
      : (currentGame?.roundStartGuessResults ?? currentGame?.guessResults);

  const participantsWithScores = (currentGame?.participants || [])
    .map(p => {
      const gamePoints = displayedScores?.[p.userId] ?? 0;
      const guessPoints = displayedGuessResults?.[p.userId]?.correctGuesses ?? 0;
      return { ...p, gamePoints, guessPoints, totalPoints: gamePoints + guessPoints };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);
```

- [ ] **Step 4: Verify**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx tsc --noEmit -p apps/web/tsconfig.json
```

Confirm no new errors beyond the 3 pre-existing baseline errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/game/mirror/ActivePhase.tsx apps/web/src/components/game/mirror/GuessingPhase.tsx apps/web/src/pages/ResultsPage.tsx
git commit -m "$(cat <<'EOF'
Wire web leaderboard displays to the round-start snapshot

ActivePhase and GuessingPhase now show roundStartScores/
roundStartGuessResults instead of live scores/guessResults while a
round is in progress. The standalone Results tab does the same,
except once the game is finished it shows live (now-final) totals,
since no snapshot is ever taken after the last round.
EOF
)"
```

---

## Task 3: Expo data model + TDD tests

**Files:**
- Modify: `apps/expo/contexts/GameContext.tsx`
- Create: `apps/expo/__tests__/GameContext.roundStartSnapshot.test.tsx`

**Interfaces:**
- Produces: `Game.roundStartScores?: { [userId: string]: number }` and `Game.roundStartGuessResults?: { [userId: string]: { correctGuesses: number } }` on `apps/expo/contexts/GameContext.tsx`'s `Game` interface. Task 4 (expo component wiring) consumes these two field names exactly as given here.

- [ ] **Step 1: Confirm the baseline**

```bash
cd apps/expo
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npm test 2>&1 | tail -10
```

Note the current failing-test count — compare against the ~30 failed / 285 passed documented baseline (confirmed multiple times in prior work, all pre-existing and unrelated to this change).

- [ ] **Step 2: Write the failing test**

Create `apps/expo/__tests__/GameContext.roundStartSnapshot.test.tsx`:

```tsx
// TDD: startGame() and startNextRound() must write a roundStartScores/
// roundStartGuessResults snapshot — round 1 starts empty, later rounds
// capture whatever scores/guessResults stood the instant the round began.
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

const ADMIN  = { userId: 'admin-uid', userName: 'Admin',  userEmail: 'admin@test.com', joinedAt: new Date(0) };
const PLAYER = { userId: 'player-uid', userName: 'Player', userEmail: 'p@test.com',    joinedAt: new Date(1) };
const THIRD  = { userId: 'third-uid', userName: 'Third',  userEmail: 't@test.com',     joinedAt: new Date(2) };

function makeGameDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'game-x',
    adminId: 'admin-uid',
    adminName: 'Admin',
    adminEmail: 'admin@test.com',
    status: 'waiting',
    participants: [ADMIN, PLAYER, THIRD],
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
    adminSkippedTargets: [],
    adminNextTargetPreference: null,
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

describe('startGame — writes an empty round-start snapshot', () => {
  it('writes roundStartScores/roundStartGuessResults as {} alongside scores: {}', async () => {
    const firestore = require('firebase/firestore');
    setupEnterGame(firestore, makeGameDoc());

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.startGame(); });

    const startCalls = firestore.updateDoc.mock.calls.filter(
      (call: unknown[]) => (call[1] as Record<string, unknown>).status === 'active',
    );
    expect(startCalls.length).toBe(1);
    const payload = startCalls[0][1] as Record<string, unknown>;
    expect(payload.roundStartScores).toEqual({});
    expect(payload.roundStartGuessResults).toEqual({});
  });
});

describe('startNextRound — snapshots the just-finished round\'s final scores', () => {
  it('writes roundStartScores/roundStartGuessResults as a copy of the pre-transition scores/guessResults', async () => {
    const firestore = require('firebase/firestore');
    const completedRound = {
      roundNumber: 1,
      targetUserId: 'player-uid',
      targetUserName: 'Player',
      comments: [],
      commentsVisible: true,
      pointsGiven: true,
      startedAt: new Date(),
    };
    const gameDoc = makeGameDoc({
      status: 'active',
      rounds: [completedRound],
      currentRound: completedRound,
      scores: { 'admin-uid': 3, 'player-uid': 7 },
      guessResults: { 'third-uid': { correctGuesses: 2 } },
      roundStartScores: {},
      roundStartGuessResults: {},
    });
    setupEnterGame(firestore, gameDoc);
    firestore.getDoc.mockResolvedValueOnce(makeSnap(gameDoc));

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.startNextRound(); });

    const roundWrite = firestore.updateDoc.mock.calls.find(
      (call: unknown[]) => (call[1] as Record<string, unknown>).currentRound != null,
    );
    expect(roundWrite).toBeDefined();
    const payload = roundWrite![1] as Record<string, unknown>;
    expect(payload.roundStartScores).toEqual({ 'admin-uid': 3, 'player-uid': 7 });
    expect(payload.roundStartGuessResults).toEqual({ 'third-uid': { correctGuesses: 2 } });
  });
});
```

- [ ] **Step 3: Run it and confirm it fails**

```bash
npm test -- __tests__/GameContext.roundStartSnapshot.test.tsx
```

Expected: FAIL — `startGame()`/`startNextRound()` don't write these fields yet, so `payload.roundStartScores`/`payload.roundStartGuessResults` are `undefined`, not `{}` / the expected objects.

- [ ] **Step 4: Add the two fields to the `Game` interface**

The `Game` interface currently ends:

```typescript
  // Admin target control preferences
  adminNextTargetPreference?: string;
  adminSkippedTargets?: string[];
  // Stable per-participant display numbers, assigned once when the game starts.
  // Frozen for the lifetime of the game — does not shift if participants later leave.
  playerNumbers?: { [userId: string]: number };
}
```

Change it to:

```typescript
  // Admin target control preferences
  adminNextTargetPreference?: string;
  adminSkippedTargets?: string[];
  // Stable per-participant display numbers, assigned once when the game starts.
  // Frozen for the lifetime of the game — does not shift if participants later leave.
  playerNumbers?: { [userId: string]: number };
  // Snapshot of scores/guessResults taken the instant the current round began.
  // Leaderboard displays use these (not the live scores/guessResults fields)
  // while a round is in progress, so round-in-progress scoring stays hidden
  // until the round ends and a fresh snapshot is taken.
  roundStartScores?: { [userId: string]: number };
  roundStartGuessResults?: { [userId: string]: { correctGuesses: number } };
}
```

- [ ] **Step 5: Capture the snapshot in `startGame()`**

The `updateDoc` call in `startGame()` currently reads:

```typescript
      await updateDoc(gameRef, {
        status: "active",
        currentRound: round,
        rounds: [round],
        scores: {},
        playerNumbers: buildJoinIndexById(currentGame.participants),
      });
```

Change it to:

```typescript
      await updateDoc(gameRef, {
        status: "active",
        currentRound: round,
        rounds: [round],
        scores: {},
        roundStartScores: {},
        roundStartGuessResults: {},
        playerNumbers: buildJoinIndexById(currentGame.participants),
      });
```

- [ ] **Step 6: Capture the snapshot in `startNextRound()`**

The `updateDoc` call in `startNextRound()` currently reads:

```typescript
      await updateDoc(gameRef, {
        currentRound: nextRound,
        rounds: previousRounds,
        postGuessingPointPhase: false,
        playersWhoAwardedPostGuessPoints: [],
        // Reset admin target controls for new round
        adminNextTargetPreference: null,
        adminSkippedTargets: [],
        playersWhoCompletedPostCommentPhase: [],
        guessingData: null,
      });
```

Change it to:

```typescript
      await updateDoc(gameRef, {
        currentRound: nextRound,
        rounds: previousRounds,
        postGuessingPointPhase: false,
        playersWhoAwardedPostGuessPoints: [],
        // Reset admin target controls for new round
        adminNextTargetPreference: null,
        adminSkippedTargets: [],
        playersWhoCompletedPostCommentPhase: [],
        guessingData: null,
        // Freeze the leaderboard for the round that's about to start at
        // whatever scores/guessResults stood the instant it began — i.e.
        // the just-finished round's final results.
        roundStartScores: gameData.scores ?? {},
        roundStartGuessResults: gameData.guessResults ?? {},
      });
```

`gameData` is the freshly-read game document already in scope earlier in this same function (`const gameData = gameDoc.data() as Game;`) — do not re-fetch it.

- [ ] **Step 7: Run the test again and confirm it passes**

```bash
npm test -- __tests__/GameContext.roundStartSnapshot.test.tsx
```

Expected: PASS, both tests.

- [ ] **Step 8: Run the full suite**

```bash
npm test 2>&1 | tail -10
```

Confirm no new failures beyond the Step 1 baseline (plus the 2 new passing tests).

- [ ] **Step 9: Commit**

```bash
git add apps/expo/contexts/GameContext.tsx apps/expo/__tests__/GameContext.roundStartSnapshot.test.tsx
git commit -m "$(cat <<'EOF'
Add roundStartScores/roundStartGuessResults snapshot fields (Expo)

Captured in startGame() (round 1, empty) and startNextRound() (copy
of the scores/guessResults that stood the instant the new round
began — i.e. the just-finished round's final results). Component
wiring to actually display these instead of live scores is a
separate task.
EOF
)"
```

---

## Task 4: Expo component wiring

**Files:**
- Modify: `apps/expo/app/(tabs)/results.tsx`
- Modify: `apps/expo/__tests__/Results.test.tsx`

**Interfaces:**
- Consumes: `Game.roundStartScores` and `Game.roundStartGuessResults` (Task 3).

Note: unlike web, Expo's mirror-mode `ActivePhase.tsx` and `GuessingPhase.tsx` do not render a leaderboard at all (confirmed via repo-wide grep — no `score`/`Leaderboard` reference in either file), so there is no mid-round inline leaderboard to wire on this platform. Only the standalone Results tab needs this change.

- [ ] **Step 1: `results.tsx`**

The score computation currently reads:

```tsx
  const participantsWithScores = (currentGame?.participants || []).map(p => {
    const gamePoints = currentGame?.scores?.[p.userId] || 0;
    const guessPoints = currentGame?.guessResults?.[p.userId]?.correctGuesses || 0;
    return { ...p, gamePoints, guessPoints, totalPoints: gamePoints + guessPoints };
  }).sort((a, b) => b.totalPoints - a.totalPoints);
```

Change it to:

```tsx
  const displayedScores =
    currentGame?.status === 'finished'
      ? currentGame?.scores
      : (currentGame?.roundStartScores ?? currentGame?.scores);
  const displayedGuessResults =
    currentGame?.status === 'finished'
      ? currentGame?.guessResults
      : (currentGame?.roundStartGuessResults ?? currentGame?.guessResults);

  const participantsWithScores = (currentGame?.participants || []).map(p => {
    const gamePoints = displayedScores?.[p.userId] || 0;
    const guessPoints = displayedGuessResults?.[p.userId]?.correctGuesses || 0;
    return { ...p, gamePoints, guessPoints, totalPoints: gamePoints + guessPoints };
  }).sort((a, b) => b.totalPoints - a.totalPoints);
```

- [ ] **Step 2: Add test coverage in `Results.test.tsx`**

The existing `describe('Results screen — active game leaderboard', ...)` block (around line 70) uses a mock game with `status: 'active'` and only `scores`/`guessResults` (no `roundStartScores`/`roundStartGuessResults`) — this already exercises the `?? currentGame?.scores` fallback path and must keep passing unchanged after Step 1 (do not modify that existing `describe` block).

Add a new `describe` block immediately after it (after its closing `});`, before `describe('Results screen — round history', ...)`):

```tsx
describe('Results screen — frozen leaderboard mid-round', () => {
  beforeEach(() => {
    mockCurrentGame = {
      id: 'game1',
      status: 'active',
      adminId: 'u1',
      participants: [
        { userId: 'u1', userName: 'Alice', userEmail: 'a@t.com', joinedAt: new Date(1000) },
        { userId: 'u2', userName: 'Bob',   userEmail: 'b@t.com', joinedAt: new Date(2000) },
      ],
      // Live scores reflect this round's in-progress scoring...
      scores: { u1: 100, u2: 100 },
      guessResults: { u1: { correctGuesses: 9 } },
      // ...but the round-start snapshot reflects the last completed round,
      // and must be what's actually displayed.
      roundStartScores: { u1: 10, u2: 5 },
      roundStartGuessResults: { u1: { correctGuesses: 2 } },
      rounds: [],
    };
  });

  it('shows the round-start snapshot totals, not the live in-progress scores', () => {
    const { getByText, queryByText } = renderScreen();
    // Alice: 10 + 2 = 12 (frozen), NOT 100 + 9 = 109 (live)
    expect(getByText(/12/)).toBeTruthy();
    expect(queryByText(/109/)).toBeNull();
  });

  it('shows the frozen guess points, not the live guess points', () => {
    const { getByText, queryByText } = renderScreen();
    expect(getByText(/\(2\)/)).toBeTruthy();
    expect(queryByText(/\(9\)/)).toBeNull();
  });
});

describe('Results screen — finished game shows live final totals', () => {
  beforeEach(() => {
    mockCurrentGame = {
      id: 'game1',
      status: 'finished',
      adminId: 'u1',
      participants: [
        { userId: 'u1', userName: 'Alice', userEmail: 'a@t.com', joinedAt: new Date(1000) },
      ],
      // Live scores are the final, correct totals once the game is over...
      scores: { u1: 50 },
      guessResults: { u1: { correctGuesses: 4 } },
      // ...even though the last round-start snapshot is now stale (it was
      // never refreshed for "after the final round").
      roundStartScores: { u1: 10 },
      roundStartGuessResults: { u1: { correctGuesses: 1 } },
      rounds: [],
    };
  });

  it('shows the live final total, not the stale round-start snapshot', () => {
    const { getByText, queryByText } = renderScreen();
    // Alice: 50 + 4 = 54 (live final), NOT 10 + 1 = 11 (stale snapshot)
    expect(getByText(/54/)).toBeTruthy();
    expect(queryByText(/^11$/)).toBeNull();
  });
});
```

- [ ] **Step 3: Verify**

```bash
cd apps/expo
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npm test -- __tests__/Results.test.tsx
```

Confirm all tests pass, including the pre-existing ones in the file (they must be unaffected by this change).

Then run the full suite:

```bash
npm test 2>&1 | tail -10
```

Confirm no new failures beyond the documented baseline.

- [ ] **Step 4: Commit**

```bash
git add "apps/expo/app/(tabs)/results.tsx" apps/expo/__tests__/Results.test.tsx
git commit -m "$(cat <<'EOF'
Wire Expo Results tab to the round-start snapshot

Shows roundStartScores/roundStartGuessResults instead of live
scores/guessResults while a round is in progress, except once the
game is finished it shows live (now-final) totals, since no
snapshot is ever taken after the last round. Expo's ActivePhase/
GuessingPhase don't render a leaderboard at all, so no wiring is
needed there (unlike web).
EOF
)"
```
