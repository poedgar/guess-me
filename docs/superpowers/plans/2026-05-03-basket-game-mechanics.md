# Basket Game Mechanics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full Basket game mode — secret 1-to-1 assignments, comment writing, anonymous reveal, and two-step guessing.

**Architecture:** A pure schedule-generation utility produces a Latin-square round plan at game start; six new GameContext methods drive Firestore transitions; two new phase components handle writing and guessing UI; BasketScreen routes between them.

**Tech Stack:** Expo React Native, Firebase Firestore, React Context, Jest + RNTL

---

## File Map

| Action | Path |
|--------|------|
| Create | `utils/basketSchedule.ts` |
| Create | `__tests__/basketSchedule.test.ts` |
| Modify | `contexts/GameContext.tsx` |
| Create | `__tests__/GameContext.basket.test.ts` |
| Modify | `locales/en.json` |
| Modify | `locales/uk.json` |
| Create | `components/game/basket/BasketWritingPhase.tsx` |
| Create | `__tests__/BasketWritingPhase.test.tsx` |
| Create | `components/game/basket/BasketGuessingPhase.tsx` |
| Create | `__tests__/BasketGuessingPhase.test.tsx` |
| Modify | `components/game/basket/BasketScreen.tsx` |
| Modify | `components/game/GameScreen.tsx` |

---

## Task 1: generateBasketSchedule utility

**Files:**
- Create: `utils/basketSchedule.ts`
- Create: `__tests__/basketSchedule.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/basketSchedule.test.ts
import { generateBasketSchedule } from '../utils/basketSchedule';

describe('generateBasketSchedule', () => {
  it('generates N-1 rounds for N players', () => {
    expect(generateBasketSchedule(['a','b','c','d']).length).toBe(3);
    expect(generateBasketSchedule(['a','b','c']).length).toBe(2);
    expect(generateBasketSchedule(['a','b']).length).toBe(1);
    expect(generateBasketSchedule(['a']).length).toBe(0);
  });

  it('each round has exactly N assignments', () => {
    const ids = ['a','b','c','d'];
    for (const round of generateBasketSchedule(ids)) {
      expect(round.assignments.length).toBe(ids.length);
    }
  });

  it('has no self-assignments in any round', () => {
    for (const n of [2, 3, 4, 5]) {
      const ids = Array.from({ length: n }, (_, i) => `p${i}`);
      for (const round of generateBasketSchedule(ids)) {
        for (const a of round.assignments) {
          expect(a.writerId).not.toBe(a.subjectId);
        }
      }
    }
  });

  it('every player writes about every other player exactly once', () => {
    for (const n of [2, 3, 4, 5]) {
      const ids = Array.from({ length: n }, (_, i) => `p${i}`);
      const pairs = new Map<string, number>();
      for (const round of generateBasketSchedule(ids)) {
        for (const a of round.assignments) {
          const key = `${a.writerId}->${a.subjectId}`;
          pairs.set(key, (pairs.get(key) ?? 0) + 1);
        }
      }
      for (const w of ids) {
        for (const s of ids) {
          if (w === s) continue;
          expect(pairs.get(`${w}->${s}`)).toBe(1);
        }
      }
    }
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror && npx jest __tests__/basketSchedule.test.ts --no-coverage 2>&1 | tail -10
```
Expected: `Cannot find module '../utils/basketSchedule'`

- [ ] **Step 3: Implement the utility**

```typescript
// utils/basketSchedule.ts
export interface BasketAssignment {
  writerId: string;
  subjectId: string;
}

export interface BasketRound {
  assignments: BasketAssignment[];
}

export function generateBasketSchedule(participantIds: string[]): BasketRound[] {
  const n = participantIds.length;
  if (n < 2) return [];

  // Fisher-Yates shuffle for unpredictable order
  const ids = [...participantIds];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  const rounds: BasketRound[] = [];
  for (let r = 0; r < n - 1; r++) {
    const assignments: BasketAssignment[] = ids.map((writerId, i) => ({
      writerId,
      subjectId: ids[(i + r + 1) % n],
    }));
    rounds.push({ assignments });
  }
  return rounds;
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest __tests__/basketSchedule.test.ts --no-coverage 2>&1 | tail -5
```
Expected: `Tests: 4 passed`

- [ ] **Step 5: Commit**

```bash
git add utils/basketSchedule.ts __tests__/basketSchedule.test.ts
git commit -m "feat: add generateBasketSchedule utility with tests"
```

---

## Task 2: GameContext — types and status

**Files:**
- Modify: `contexts/GameContext.tsx`

- [ ] **Step 1: Add basket interfaces and extend Game**

In `contexts/GameContext.tsx`, after the existing imports add:

```typescript
import { BasketAssignment, BasketRound, generateBasketSchedule } from '@/utils/basketSchedule';
```

After the `GuessingData` interface (around line 124), add:

```typescript
export interface BasketComment {
  writerId: string;
  subjectId: string;
  text: string;
  submittedAt: number;
}

export interface BasketGuess {
  guesserId: string;
  commentWriterId: string;
  authorGuessId?: string;
  commentCorrect: boolean;
  authorCorrect: boolean;
  pointsAwarded: number;
}

export interface BasketData {
  schedule: BasketRound[];
  currentRoundIndex: number;
  currentRoundComments: BasketComment[];
  currentRoundGuesses: BasketGuess[];
}
```

- [ ] **Step 2: Extend Game.status and add basketData**

In the `Game` interface, change the `status` line from:
```typescript
status: "waiting" | "active" | "guessing_phase" | "finished";
```
to:
```typescript
status: "waiting" | "active" | "guessing_phase" | "finished" | "basket_writing" | "basket_guessing";
```

Add after the `gameType` field (around line 66):
```typescript
basketData?: BasketData;
```

- [ ] **Step 3: Add 6 method signatures to GameContextType**

In the `GameContextType` interface, after `setGameType`:
```typescript
startBasketGame: () => Promise<void>;
submitBasketComment: (text: string) => Promise<void>;
revealBasketComments: () => Promise<void>;
submitBasketCommentGuess: (commentWriterId: string) => Promise<void>;
submitBasketAuthorGuess: (authorGuessId: string) => Promise<void>;
startNextBasketRound: () => Promise<void>;
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: errors only about missing implementations (method bodies not yet added to value object). If errors mention `BasketRound` or `BasketAssignment` not found, check the import path.

---

## Task 3: GameContext — six new methods

**Files:**
- Modify: `contexts/GameContext.tsx`
- Create: `__tests__/GameContext.basket.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/GameContext.basket.test.ts
import { act, renderHook } from '@testing-library/react-native';
import React from 'react';
import { GameProvider, useGame } from '../contexts/GameContext';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-1', displayName: 'Alice', email: 'alice@example.com' },
    isSignedIn: true,
  }),
}));

const PLAYERS = [
  { userId: 'user-1', userName: 'Alice', userEmail: 'alice@example.com', joinedAt: new Date() },
  { userId: 'user-2', userName: 'Bob',   userEmail: 'bob@example.com',   joinedAt: new Date() },
  { userId: 'user-3', userName: 'Carol', userEmail: 'carol@example.com', joinedAt: new Date() },
];

const BASE_GAME = {
  adminId: 'user-1', adminName: 'Alice', adminEmail: 'alice@example.com',
  status: 'waiting', participants: PLAYERS,
  rounds: [], scores: {}, guessingData: { commentsByTarget: {}, possibleAuthors: [] },
  guessResults: {}, createdAt: new Date(), currentRound: null, gameType: 'basket',
};

const SCHEDULE = [
  { assignments: [
    { writerId: 'user-1', subjectId: 'user-2' },
    { writerId: 'user-2', subjectId: 'user-3' },
    { writerId: 'user-3', subjectId: 'user-1' },
  ]},
  { assignments: [
    { writerId: 'user-1', subjectId: 'user-3' },
    { writerId: 'user-2', subjectId: 'user-1' },
    { writerId: 'user-3', subjectId: 'user-2' },
  ]},
];

beforeEach(() => {
  const config = require('@/config/firebase');
  config.auth.currentUser = { uid: 'user-1', displayName: 'Alice', email: 'alice@example.com', photoURL: null };
  const f = require('firebase/firestore');
  f.doc.mockReturnValue({ path: 'games/game-abc' });
  f.getDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
  f.setDoc.mockResolvedValue(undefined);
  f.updateDoc.mockResolvedValue(undefined);
  f.onSnapshot.mockReturnValue(jest.fn());
  f.arrayUnion.mockImplementation((val: any) => val);
  f.serverTimestamp.mockReturnValue(new Date());
});

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(GameProvider, null, children);

async function enterWithGame(gameData: object) {
  const f = require('firebase/firestore');
  const gameDoc = { id: 'game-abc', path: 'games/game-abc' };
  f.doc.mockReturnValue(gameDoc);
  f.getDoc
    .mockResolvedValueOnce({ exists: () => true, data: () => ({ password: 'SECRET' }) })
    .mockResolvedValueOnce({ exists: () => false });
  f.onSnapshot.mockImplementationOnce((_ref: any, cb: (s: any) => void) => {
    cb({ exists: () => true, id: 'game-abc', data: () => gameData });
    return jest.fn();
  });
  const { result } = renderHook(() => useGame(), { wrapper });
  await act(async () => {
    try { await result.current.enterGame('SECRET'); } catch (_) {}
  });
  return { result, gameDoc };
}

// ── startBasketGame ─────────────────────────────────────────────────────────
describe('startBasketGame', () => {
  it('is exposed by useGame', () => {
    const { result } = renderHook(() => useGame(), { wrapper });
    expect(typeof result.current.startBasketGame).toBe('function');
  });

  it('sets status basket_writing with schedule, roundIndex 0, empty arrays', async () => {
    const { result, gameDoc } = await enterWithGame(BASE_GAME);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.startBasketGame(); });

    expect(f.updateDoc).toHaveBeenCalledWith(
      gameDoc,
      expect.objectContaining({
        status: 'basket_writing',
        basketData: expect.objectContaining({
          currentRoundIndex: 0,
          currentRoundComments: [],
          currentRoundGuesses: [],
          schedule: expect.any(Array),
        }),
      }),
    );
    const arg = f.updateDoc.mock.calls[0][1];
    // N-1 rounds for N players
    expect(arg.basketData.schedule.length).toBe(PLAYERS.length - 1);
  });

  it('throws when fewer than 2 participants', async () => {
    const onePlayerGame = { ...BASE_GAME, participants: [PLAYERS[0]] };
    const { result } = await enterWithGame(onePlayerGame);
    await expect(
      act(async () => { await result.current.startBasketGame(); })
    ).rejects.toThrow();
  });
});

// ── submitBasketComment ──────────────────────────────────────────────────────
describe('submitBasketComment', () => {
  const gameWithBasket = {
    ...BASE_GAME, status: 'basket_writing',
    basketData: {
      schedule: SCHEDULE, currentRoundIndex: 0,
      currentRoundComments: [], currentRoundGuesses: [],
    },
  };

  it('appends a comment with correct writerId and subjectId', async () => {
    const { result, gameDoc } = await enterWithGame(gameWithBasket);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.submitBasketComment('hello'); });

    expect(f.updateDoc).toHaveBeenCalledWith(
      gameDoc,
      expect.objectContaining({
        'basketData.currentRoundComments': expect.objectContaining({
          writerId: 'user-1',
          subjectId: 'user-2', // per SCHEDULE round 0
          text: 'hello',
        }),
      }),
    );
  });
});

// ── revealBasketComments ─────────────────────────────────────────────────────
describe('revealBasketComments', () => {
  it('sets status to basket_guessing', async () => {
    const game = { ...BASE_GAME, status: 'basket_writing', basketData: { schedule: SCHEDULE, currentRoundIndex: 0, currentRoundComments: [], currentRoundGuesses: [] } };
    const { result, gameDoc } = await enterWithGame(game);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.revealBasketComments(); });

    expect(f.updateDoc).toHaveBeenCalledWith(gameDoc, { status: 'basket_guessing' });
  });
});

// ── submitBasketCommentGuess ─────────────────────────────────────────────────
describe('submitBasketCommentGuess', () => {
  const COMMENTS = [
    { writerId: 'user-2', subjectId: 'user-1', text: 'A', submittedAt: 1 },
    { writerId: 'user-3', subjectId: 'user-2', text: 'B', submittedAt: 2 },
    { writerId: 'user-1', subjectId: 'user-3', text: 'C', submittedAt: 3 },
  ];
  const game = {
    ...BASE_GAME, status: 'basket_guessing',
    basketData: { schedule: SCHEDULE, currentRoundIndex: 0, currentRoundComments: COMMENTS, currentRoundGuesses: [] },
  };

  it('awards 1 point and records commentCorrect:true for correct guess', async () => {
    const { result, gameDoc } = await enterWithGame(game);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    // user-1's comment is written by user-2 — guess correctly
    await act(async () => { await result.current.submitBasketCommentGuess('user-2'); });

    expect(f.updateDoc).toHaveBeenCalledWith(
      gameDoc,
      expect.objectContaining({
        'scores.user-1': 1,
        'basketData.currentRoundGuesses': expect.objectContaining({
          guesserId: 'user-1',
          commentWriterId: 'user-2',
          commentCorrect: true,
          pointsAwarded: 1,
        }),
      }),
    );
  });

  it('awards 0 points and records commentCorrect:false for wrong guess', async () => {
    const { result, gameDoc } = await enterWithGame(game);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    // user-3 did NOT write about user-1
    await act(async () => { await result.current.submitBasketCommentGuess('user-3'); });

    const arg = f.updateDoc.mock.calls[0][1];
    expect(arg['scores.user-1']).toBeUndefined();
    expect(arg['basketData.currentRoundGuesses']).toMatchObject({
      commentCorrect: false,
      pointsAwarded: 0,
    });
  });
});

// ── submitBasketAuthorGuess ──────────────────────────────────────────────────
describe('submitBasketAuthorGuess', () => {
  const COMMENTS = [
    { writerId: 'user-2', subjectId: 'user-1', text: 'A', submittedAt: 1 },
    { writerId: 'user-1', subjectId: 'user-2', text: 'B', submittedAt: 2 },
  ];
  const existingGuess = { guesserId: 'user-1', commentWriterId: 'user-2', commentCorrect: true, authorCorrect: false, pointsAwarded: 1 };
  const game = {
    ...BASE_GAME, status: 'basket_guessing',
    participants: [PLAYERS[0], PLAYERS[1]],
    basketData: {
      schedule: [{ assignments: [{ writerId: 'user-2', subjectId: 'user-1' }, { writerId: 'user-1', subjectId: 'user-2' }] }],
      currentRoundIndex: 0, currentRoundComments: COMMENTS,
      currentRoundGuesses: [existingGuess],
    },
  };

  it('awards 1 additional point for correct author guess', async () => {
    const { result, gameDoc } = await enterWithGame(game);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.submitBasketAuthorGuess('user-2'); });

    expect(f.updateDoc).toHaveBeenCalledWith(
      gameDoc,
      expect.objectContaining({ 'scores.user-1': 1 }),
    );
    const arg = f.updateDoc.mock.calls[0][1];
    const updatedGuess = arg['basketData.currentRoundGuesses'].find((g: any) => g.guesserId === 'user-1');
    expect(updatedGuess.authorCorrect).toBe(true);
    expect(updatedGuess.pointsAwarded).toBe(2);
  });

  it('awards 0 additional points for wrong author guess', async () => {
    const { result, gameDoc } = await enterWithGame(game);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.submitBasketAuthorGuess('user-3'); });

    const arg = f.updateDoc.mock.calls[0][1];
    expect(arg['scores.user-1']).toBeUndefined();
    const updatedGuess = arg['basketData.currentRoundGuesses'].find((g: any) => g.guesserId === 'user-1');
    expect(updatedGuess.authorCorrect).toBe(false);
    expect(updatedGuess.pointsAwarded).toBe(1);
  });
});

// ── startNextBasketRound ─────────────────────────────────────────────────────
describe('startNextBasketRound', () => {
  it('increments roundIndex and sets status basket_writing when rounds remain', async () => {
    const game = { ...BASE_GAME, status: 'basket_guessing', basketData: { schedule: SCHEDULE, currentRoundIndex: 0, currentRoundComments: [], currentRoundGuesses: [] } };
    const { result, gameDoc } = await enterWithGame(game);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.startNextBasketRound(); });

    expect(f.updateDoc).toHaveBeenCalledWith(gameDoc, {
      status: 'basket_writing',
      'basketData.currentRoundIndex': 1,
      'basketData.currentRoundComments': [],
      'basketData.currentRoundGuesses': [],
    });
  });

  it('sets status finished on the last round', async () => {
    const game = { ...BASE_GAME, status: 'basket_guessing', basketData: { schedule: SCHEDULE, currentRoundIndex: 1, currentRoundComments: [], currentRoundGuesses: [] } };
    const { result, gameDoc } = await enterWithGame(game);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.startNextBasketRound(); });

    expect(f.updateDoc).toHaveBeenCalledWith(gameDoc, { status: 'finished' });
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx jest __tests__/GameContext.basket.test.ts --no-coverage 2>&1 | grep -E "FAIL|cannot|not a function" | head -10
```
Expected: failures about missing methods.

- [ ] **Step 3: Implement the six methods in GameContext.tsx**

Add these six functions **before** the `setGameType` function (around line 1527):

```typescript
const startBasketGame = async (): Promise<void> => {
  if (!auth.currentUser) throw new Error("You must be signed in");
  if (!currentGame || auth.currentUser.uid !== currentGame.adminId) {
    throw new Error("Only the admin can start the game");
  }
  if (currentGame.participants.length < 2) {
    throw new Error("Need at least 2 participants to start the game");
  }
  try {
    setLoading(true);
    const gameRef = doc(db, 'games', currentGame.id);
    const schedule = generateBasketSchedule(currentGame.participants.map(p => p.userId));
    await updateDoc(gameRef, {
      status: 'basket_writing',
      basketData: { schedule, currentRoundIndex: 0, currentRoundComments: [], currentRoundGuesses: [] },
    });
  } catch (err) {
    console.error('Error starting basket game:', err);
    throw err;
  } finally {
    setLoading(false);
  }
};

const submitBasketComment = async (text: string): Promise<void> => {
  if (!auth.currentUser) throw new Error("You must be signed in");
  if (!currentGame?.basketData) throw new Error("No active basket game");
  if (!text.trim()) throw new Error("Comment cannot be empty");
  const { schedule, currentRoundIndex } = currentGame.basketData;
  const assignment = schedule[currentRoundIndex].assignments.find(
    a => a.writerId === auth.currentUser!.uid
  );
  if (!assignment) throw new Error("No assignment found for this player");
  const comment: BasketComment = {
    writerId: auth.currentUser.uid,
    subjectId: assignment.subjectId,
    text: text.trim(),
    submittedAt: Date.now(),
  };
  try {
    setLoading(true);
    const gameRef = doc(db, 'games', currentGame.id);
    await updateDoc(gameRef, { 'basketData.currentRoundComments': arrayUnion(comment) });
  } catch (err) {
    console.error('Error submitting basket comment:', err);
    throw err;
  } finally {
    setLoading(false);
  }
};

const revealBasketComments = async (): Promise<void> => {
  if (!auth.currentUser) throw new Error("You must be signed in");
  if (!currentGame || auth.currentUser.uid !== currentGame.adminId) {
    throw new Error("Only the admin can reveal comments");
  }
  try {
    setLoading(true);
    const gameRef = doc(db, 'games', currentGame.id);
    await updateDoc(gameRef, { status: 'basket_guessing' });
  } catch (err) {
    console.error('Error revealing basket comments:', err);
    throw err;
  } finally {
    setLoading(false);
  }
};

const submitBasketCommentGuess = async (commentWriterId: string): Promise<void> => {
  if (!auth.currentUser) throw new Error("You must be signed in");
  if (!currentGame?.basketData) throw new Error("No active basket game");
  const { currentRoundComments } = currentGame.basketData;
  const guesserId = auth.currentUser.uid;
  const actualComment = currentRoundComments.find(c => c.subjectId === guesserId);
  if (!actualComment) throw new Error("No comment found for this player");
  const commentCorrect = actualComment.writerId === commentWriterId;
  const guess: BasketGuess = {
    guesserId, commentWriterId, commentCorrect, authorCorrect: false,
    pointsAwarded: commentCorrect ? 1 : 0,
  };
  try {
    setLoading(true);
    const gameRef = doc(db, 'games', currentGame.id);
    const updates: Record<string, unknown> = {
      'basketData.currentRoundGuesses': arrayUnion(guess),
    };
    if (commentCorrect) {
      updates[`scores.${guesserId}`] = (currentGame.scores?.[guesserId] ?? 0) + 1;
    }
    await updateDoc(gameRef, updates);
  } catch (err) {
    console.error('Error submitting basket comment guess:', err);
    throw err;
  } finally {
    setLoading(false);
  }
};

const submitBasketAuthorGuess = async (authorGuessId: string): Promise<void> => {
  if (!auth.currentUser) throw new Error("You must be signed in");
  if (!currentGame?.basketData) throw new Error("No active basket game");
  const { schedule, currentRoundIndex, currentRoundGuesses } = currentGame.basketData;
  const guesserId = auth.currentUser.uid;
  const existingGuess = currentRoundGuesses.find(g => g.guesserId === guesserId);
  if (!existingGuess?.commentCorrect) {
    throw new Error("Cannot guess author without a correct comment guess");
  }
  const assignment = schedule[currentRoundIndex].assignments.find(a => a.subjectId === guesserId);
  if (!assignment) throw new Error("No assignment found for this player");
  const authorCorrect = authorGuessId === assignment.writerId;
  const updatedGuesses = currentRoundGuesses.map(g =>
    g.guesserId === guesserId
      ? { ...g, authorGuessId, authorCorrect, pointsAwarded: g.pointsAwarded + (authorCorrect ? 1 : 0) }
      : g
  );
  try {
    setLoading(true);
    const gameRef = doc(db, 'games', currentGame.id);
    const updates: Record<string, unknown> = {
      'basketData.currentRoundGuesses': updatedGuesses,
    };
    if (authorCorrect) {
      updates[`scores.${guesserId}`] = (currentGame.scores?.[guesserId] ?? 0) + 1;
    }
    await updateDoc(gameRef, updates);
  } catch (err) {
    console.error('Error submitting basket author guess:', err);
    throw err;
  } finally {
    setLoading(false);
  }
};

const startNextBasketRound = async (): Promise<void> => {
  if (!auth.currentUser) throw new Error("You must be signed in");
  if (!currentGame || auth.currentUser.uid !== currentGame.adminId) {
    throw new Error("Only the admin can start the next round");
  }
  if (!currentGame.basketData) throw new Error("No active basket game");
  const { schedule, currentRoundIndex } = currentGame.basketData;
  try {
    setLoading(true);
    const gameRef = doc(db, 'games', currentGame.id);
    if (currentRoundIndex + 1 >= schedule.length) {
      await updateDoc(gameRef, { status: 'finished' });
    } else {
      await updateDoc(gameRef, {
        status: 'basket_writing',
        'basketData.currentRoundIndex': currentRoundIndex + 1,
        'basketData.currentRoundComments': [],
        'basketData.currentRoundGuesses': [],
      });
    }
  } catch (err) {
    console.error('Error starting next basket round:', err);
    throw err;
  } finally {
    setLoading(false);
  }
};
```

- [ ] **Step 4: Add all six methods to the `value` object**

In the `useMemo` value object (around line 1765), after `setGameType,` add:
```typescript
startBasketGame,
submitBasketComment,
revealBasketComments,
submitBasketCommentGuess,
submitBasketAuthorGuess,
startNextBasketRound,
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npx jest __tests__/GameContext.basket.test.ts --no-coverage 2>&1 | tail -8
```
Expected: all tests pass.

- [ ] **Step 6: Run full test suite — verify no regressions**

```bash
npx jest --no-coverage 2>&1 | tail -10
```
Expected: all existing tests still pass.

- [ ] **Step 7: Commit**

```bash
git add contexts/GameContext.tsx __tests__/GameContext.basket.test.ts utils/basketSchedule.ts
git commit -m "feat: add basket game methods to GameContext"
```

---

## Task 4: i18n keys

**Files:**
- Modify: `locales/en.json`
- Modify: `locales/uk.json`

- [ ] **Step 1: Add keys to en.json**

In `locales/en.json`, inside `"game": { "ui": { ... } }`, after the `"gameTypeBasket"` key add:

```json
"basket": {
  "round": "Round {current} of {total}",
  "yourSubject": "Write about:",
  "writeComment": "Write your comment...",
  "submit": "Submit",
  "waitingForOthers": "Waiting for others... ({count}/{total} submitted)",
  "revealComments": "Reveal Comments",
  "whichIsAboutYou": "Which comment is about you?",
  "whoWroteIt": "Who wrote it?",
  "correct": "Correct! +1 point",
  "correctAuthor": "Right author! +1 point",
  "wrong": "Not quite.",
  "nextRound": "Next Round",
  "finishGame": "Finish Game",
  "waitingForGuesses": "{count}/{total} players guessed"
}
```

- [ ] **Step 2: Add keys to uk.json**

In `locales/uk.json`, same location, add:

```json
"basket": {
  "round": "Раунд {current} з {total}",
  "yourSubject": "Напишіть про:",
  "writeComment": "Ваш коментар...",
  "submit": "Надіслати",
  "waitingForOthers": "Очікування... ({count}/{total} надіслано)",
  "revealComments": "Показати коментарі",
  "whichIsAboutYou": "Який коментар про вас?",
  "whoWroteIt": "Хто це написав?",
  "correct": "Правильно! +1 бал",
  "correctAuthor": "Автор вгаданий! +1 бал",
  "wrong": "Не вгадали.",
  "nextRound": "Наступний раунд",
  "finishGame": "Закінчити гру",
  "waitingForGuesses": "{count}/{total} гравців відгадали"
}
```

- [ ] **Step 3: Commit**

```bash
git add locales/en.json locales/uk.json
git commit -m "feat: add basket game i18n keys"
```

---

## Task 5: BasketWritingPhase component (TDD)

**Files:**
- Create: `__tests__/BasketWritingPhase.test.tsx`
- Create: `components/game/basket/BasketWritingPhase.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/BasketWritingPhase.test.tsx
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@/i18n', () => ({
  t: (key: string, opts?: Record<string, unknown>) => {
    const extras = opts
      ? Object.entries(opts).filter(([k]) => k !== 'locale').map(([, v]) => String(v)).join(':')
      : '';
    return extras ? `${key}[${extras}]` : key;
  },
}));

jest.mock('@/contexts/SoundContext', () => ({
  useSound: () => ({ playSound: jest.fn().mockResolvedValue(undefined) }),
}));

let mockSubmitBasketComment = jest.fn().mockResolvedValue(undefined);
let mockRevealBasketComments = jest.fn().mockResolvedValue(undefined);

jest.mock('@/contexts/GameContext', () => ({
  useGame: () => ({
    submitBasketComment: mockSubmitBasketComment,
    revealBasketComments: mockRevealBasketComments,
  }),
}));

jest.mock('@/components/themed-text', () => {
  const { Text } = require('react-native');
  return { ThemedText: ({ children, ...p }: any) => <Text {...p}>{children}</Text> };
});

jest.mock('@/constants/theme', () => ({
  Fonts: { sans: 'System' },
  GameColors: {
    white: '#fff', blue: '#007AFF', green: '#34C759', waiting: '#FF9500',
    shadow: '#000', textLight: '#888', cardBg: '#fafafa', inputBg: '#f2f2f2',
  },
}));

const { BasketWritingPhase } = require('../components/game/basket/BasketWritingPhase');

const SCHEDULE = [
  { assignments: [
    { writerId: 'user-1', subjectId: 'user-2' },
    { writerId: 'user-2', subjectId: 'user-3' },
    { writerId: 'user-3', subjectId: 'user-1' },
  ]},
  { assignments: [
    { writerId: 'user-1', subjectId: 'user-3' },
    { writerId: 'user-2', subjectId: 'user-1' },
    { writerId: 'user-3', subjectId: 'user-2' },
  ]},
];

const baseGame = {
  id: 'GAME-XYZ', adminId: 'user-1', status: 'basket_writing',
  participants: [
    { userId: 'user-1', userName: 'Alice', joinedAt: 0 },
    { userId: 'user-2', userName: 'Bob',   joinedAt: 1 },
    { userId: 'user-3', userName: 'Carol', joinedAt: 2 },
  ],
  scores: {},
  basketData: {
    schedule: SCHEDULE, currentRoundIndex: 0,
    currentRoundComments: [], currentRoundGuesses: [],
  },
};

function renderPhase(overrides = {}, isAdmin = true) {
  return render(
    <BasketWritingPhase
      game={{ ...baseGame, ...overrides }}
      user={{ uid: 'user-1' }}
      isAdmin={isAdmin}
      locale="en"
      isDark={false}
      getDisplayName={(n: string) => n}
    />
  );
}

beforeEach(() => {
  mockSubmitBasketComment = jest.fn().mockResolvedValue(undefined);
  mockRevealBasketComments = jest.fn().mockResolvedValue(undefined);
});

describe('BasketWritingPhase', () => {
  it('shows round number label', () => {
    const { queryByText } = renderPhase();
    // t('game.ui.basket.round', { current: 1, total: 2 }) → 'game.ui.basket.round[1:2]'
    expect(queryByText('game.ui.basket.round[1:2]')).toBeTruthy();
  });

  it('shows the assigned subject display name', () => {
    const { queryByText } = renderPhase();
    expect(queryByText('Bob')).toBeTruthy();
  });

  it('submit button calls submitBasketComment with the entered text', async () => {
    const { getByPlaceholderText, getByText } = renderPhase();
    fireEvent.changeText(getByPlaceholderText('game.ui.basket.writeComment'), 'great person');
    await act(async () => { fireEvent.press(getByText('game.ui.basket.submit')); });
    expect(mockSubmitBasketComment).toHaveBeenCalledWith('great person');
  });

  it('shows waiting state after submit', async () => {
    const { getByPlaceholderText, getByText, queryByText } = renderPhase();
    fireEvent.changeText(getByPlaceholderText('game.ui.basket.writeComment'), 'hi');
    await act(async () => { fireEvent.press(getByText('game.ui.basket.submit')); });
    expect(queryByText('game.ui.basket.writeComment')).toBeNull();
    expect(queryByText(/game\.ui\.basket\.waitingForOthers/)).toBeTruthy();
  });

  it('admin sees the reveal button', () => {
    const { queryByText } = renderPhase({}, true);
    expect(queryByText('game.ui.basket.revealComments')).toBeTruthy();
  });

  it('non-admin does not see the reveal button', () => {
    const { queryByText } = renderPhase({}, false);
    expect(queryByText('game.ui.basket.revealComments')).toBeNull();
  });

  it('reveal button calls revealBasketComments', async () => {
    const { getByText } = renderPhase({}, true);
    await act(async () => { fireEvent.press(getByText('game.ui.basket.revealComments')); });
    expect(mockRevealBasketComments).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx jest __tests__/BasketWritingPhase.test.tsx --no-coverage 2>&1 | tail -5
```
Expected: `Cannot find module '../components/game/basket/BasketWritingPhase'`

- [ ] **Step 3: Implement BasketWritingPhase**

```typescript
// components/game/basket/BasketWritingPhase.tsx
import { ThemedText } from '@/components/themed-text';
import type { Game } from '@/contexts/GameContext';
import { useGame } from '@/contexts/GameContext';
import { GameColors } from '@/constants/theme';
import { t } from '@/i18n';
import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

interface Props {
  game: Game;
  user: { uid: string } | null;
  isAdmin: boolean;
  locale: string;
  isDark: boolean;
  getDisplayName: (name: string) => string;
}

export const BasketWritingPhase: React.FC<Props> = ({
  game, user, isAdmin, locale, isDark, getDisplayName,
}) => {
  const { submitBasketComment, revealBasketComments } = useGame();
  const [commentText, setCommentText] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { schedule, currentRoundIndex, currentRoundComments } = game.basketData!;
  const totalRounds = schedule.length;
  const myAssignment = schedule[currentRoundIndex].assignments.find(
    a => a.writerId === user?.uid
  );
  const subjectParticipant = game.participants.find(p => p.userId === myAssignment?.subjectId);
  const subjectName = subjectParticipant ? getDisplayName(subjectParticipant.userName) : '?';

  const alreadySubmitted = submitted ||
    currentRoundComments.some(c => c.writerId === user?.uid);

  const handleSubmit = async () => {
    if (!commentText.trim()) return;
    try {
      await submitBasketComment(commentText.trim());
      setSubmitted(true);
      setCommentText('');
    } catch (e) {
      console.error('submitBasketComment error', e);
    }
  };

  return (
    <View style={styles.container}>
      <ThemedText style={styles.roundLabel}>
        {t('game.ui.basket.round', { locale, current: currentRoundIndex + 1, total: totalRounds })}
      </ThemedText>

      {alreadySubmitted ? (
        <ThemedText style={styles.waiting}>
          {t('game.ui.basket.waitingForOthers', {
            locale,
            count: currentRoundComments.length,
            total: game.participants.length,
          })}
        </ThemedText>
      ) : (
        <View style={styles.writeSection}>
          <ThemedText style={styles.subjectLabel}>
            {t('game.ui.basket.yourSubject', { locale })}
          </ThemedText>
          <ThemedText style={styles.subjectName}>{subjectName}</ThemedText>
          <TextInput
            style={[styles.input, isDark && styles.inputDark]}
            value={commentText}
            onChangeText={setCommentText}
            placeholder={t('game.ui.basket.writeComment', { locale })}
            multiline
            numberOfLines={3}
          />
          <TouchableOpacity
            style={[styles.submitButton, !commentText.trim() && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={!commentText.trim()}
            activeOpacity={0.8}
          >
            <ThemedText style={styles.submitText}>
              {t('game.ui.basket.submit', { locale })}
            </ThemedText>
          </TouchableOpacity>
        </View>
      )}

      {isAdmin && (
        <TouchableOpacity
          style={styles.revealButton}
          onPress={revealBasketComments}
          activeOpacity={0.8}
        >
          <ThemedText style={styles.revealText}>
            {t('game.ui.basket.revealComments', { locale })}
          </ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 16, paddingVertical: 8 },
  roundLabel: { fontSize: 14, opacity: 0.6, textAlign: 'center' },
  waiting: { textAlign: 'center', marginVertical: 16, opacity: 0.7 },
  writeSection: { gap: 8 },
  subjectLabel: { fontSize: 13, opacity: 0.6 },
  subjectName: { fontSize: 20, fontWeight: '700' },
  input: {
    borderRadius: 10, padding: 12, fontSize: 15,
    backgroundColor: '#f2f2f2', minHeight: 80, textAlignVertical: 'top',
  },
  inputDark: { backgroundColor: '#1c1c1e', color: '#fff' },
  submitButton: {
    backgroundColor: GameColors.blue, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  submitDisabled: { opacity: 0.4 },
  submitText: { color: GameColors.white, fontWeight: '600' },
  revealButton: {
    backgroundColor: GameColors.green, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', marginTop: 8,
  },
  revealText: { color: GameColors.white, fontWeight: '600' },
});
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest __tests__/BasketWritingPhase.test.tsx --no-coverage 2>&1 | tail -5
```
Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/game/basket/BasketWritingPhase.tsx __tests__/BasketWritingPhase.test.tsx
git commit -m "feat: add BasketWritingPhase component with tests"
```

---

## Task 6: BasketGuessingPhase component (TDD)

**Files:**
- Create: `__tests__/BasketGuessingPhase.test.tsx`
- Create: `components/game/basket/BasketGuessingPhase.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/BasketGuessingPhase.test.tsx
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@/i18n', () => ({
  t: (key: string, opts?: Record<string, unknown>) => {
    const extras = opts
      ? Object.entries(opts).filter(([k]) => k !== 'locale').map(([, v]) => String(v)).join(':')
      : '';
    return extras ? `${key}[${extras}]` : key;
  },
}));

let mockSubmitBasketCommentGuess = jest.fn().mockResolvedValue(undefined);
let mockSubmitBasketAuthorGuess = jest.fn().mockResolvedValue(undefined);
let mockStartNextBasketRound = jest.fn().mockResolvedValue(undefined);

jest.mock('@/contexts/GameContext', () => ({
  useGame: () => ({
    submitBasketCommentGuess: mockSubmitBasketCommentGuess,
    submitBasketAuthorGuess: mockSubmitBasketAuthorGuess,
    startNextBasketRound: mockStartNextBasketRound,
  }),
}));

jest.mock('@/components/themed-text', () => {
  const { Text } = require('react-native');
  return { ThemedText: ({ children, ...p }: any) => <Text {...p}>{children}</Text> };
});

jest.mock('@/constants/theme', () => ({
  Fonts: { sans: 'System' },
  GameColors: {
    white: '#fff', blue: '#007AFF', green: '#34C759',
    correct: '#34C759', shadow: '#000', cardBg: '#fafafa',
  },
}));

const { BasketGuessingPhase } = require('../components/game/basket/BasketGuessingPhase');

// comment about user-1 is written by user-2
const COMMENTS = [
  { writerId: 'user-2', subjectId: 'user-1', text: 'Great team player', submittedAt: 1 },
  { writerId: 'user-3', subjectId: 'user-2', text: 'Very creative', submittedAt: 2 },
  { writerId: 'user-1', subjectId: 'user-3', text: 'Natural leader', submittedAt: 3 },
];

const baseGame = {
  id: 'GAME-XYZ', adminId: 'user-1', status: 'basket_guessing',
  participants: [
    { userId: 'user-1', userName: 'Alice', joinedAt: 0 },
    { userId: 'user-2', userName: 'Bob',   joinedAt: 1 },
    { userId: 'user-3', userName: 'Carol', joinedAt: 2 },
  ],
  scores: {},
  basketData: {
    schedule: [{ assignments: [
      { writerId: 'user-2', subjectId: 'user-1' },
      { writerId: 'user-3', subjectId: 'user-2' },
      { writerId: 'user-1', subjectId: 'user-3' },
    ]}],
    currentRoundIndex: 0,
    currentRoundComments: COMMENTS,
    currentRoundGuesses: [],
  },
};

function renderPhase(gameOverrides = {}, isAdmin = true) {
  return render(
    <BasketGuessingPhase
      game={{ ...baseGame, ...gameOverrides }}
      user={{ uid: 'user-1' }}
      isAdmin={isAdmin}
      locale="en"
      isDark={false}
      getDisplayName={(n: string) => n}
    />
  );
}

beforeEach(() => {
  mockSubmitBasketCommentGuess = jest.fn().mockResolvedValue(undefined);
  mockSubmitBasketAuthorGuess  = jest.fn().mockResolvedValue(undefined);
  mockStartNextBasketRound     = jest.fn().mockResolvedValue(undefined);
});

describe('BasketGuessingPhase', () => {
  it('renders all comment texts as anonymous cards', () => {
    const { queryByText } = renderPhase();
    expect(queryByText('Great team player')).toBeTruthy();
    expect(queryByText('Very creative')).toBeTruthy();
    expect(queryByText('Natural leader')).toBeTruthy();
  });

  it('does not reveal writerId or subjectId in the UI', () => {
    const { queryByText } = renderPhase();
    expect(queryByText('user-1')).toBeNull();
    expect(queryByText('user-2')).toBeNull();
    expect(queryByText('user-3')).toBeNull();
  });

  it('tapping a comment card calls submitBasketCommentGuess with its writerId', async () => {
    const { getByText } = renderPhase();
    await act(async () => { fireEvent.press(getByText('Great team player')); });
    expect(mockSubmitBasketCommentGuess).toHaveBeenCalledWith('user-2');
  });

  it('shows success message and author list after correct guess', async () => {
    const { getByText, queryByText } = renderPhase();
    // 'Great team player' is written by user-2 about user-1 → correct
    await act(async () => { fireEvent.press(getByText('Great team player')); });
    expect(queryByText('game.ui.basket.correct')).toBeTruthy();
    expect(queryByText('game.ui.basket.whoWroteIt')).toBeTruthy();
    // Other players shown as author options (excluding self)
    expect(queryByText('Bob')).toBeTruthy();
    expect(queryByText('Carol')).toBeTruthy();
  });

  it('shows error message and no author list after wrong guess', async () => {
    const { getByText, queryByText } = renderPhase();
    // 'Very creative' is about user-2, not user-1 → wrong
    await act(async () => { fireEvent.press(getByText('Very creative')); });
    expect(queryByText('game.ui.basket.wrong')).toBeTruthy();
    expect(queryByText('game.ui.basket.whoWroteIt')).toBeNull();
  });

  it('tapping an author calls submitBasketAuthorGuess', async () => {
    const { getByText } = renderPhase();
    await act(async () => { fireEvent.press(getByText('Great team player')); });
    await act(async () => { fireEvent.press(getByText('Bob')); });
    expect(mockSubmitBasketAuthorGuess).toHaveBeenCalledWith('user-2');
  });

  it('admin sees the next-round button', () => {
    const { queryByText } = renderPhase({}, true);
    expect(queryByText('game.ui.basket.nextRound')).toBeTruthy();
  });

  it('non-admin does not see the next-round button', () => {
    const { queryByText } = renderPhase({}, false);
    expect(queryByText('game.ui.basket.nextRound')).toBeNull();
  });

  it('next-round button calls startNextBasketRound', async () => {
    const { getByText } = renderPhase({}, true);
    await act(async () => { fireEvent.press(getByText('game.ui.basket.nextRound')); });
    expect(mockStartNextBasketRound).toHaveBeenCalled();
  });

  it('shows finish-game label on last round', () => {
    const lastRoundGame = {
      ...baseGame,
      basketData: { ...baseGame.basketData, currentRoundIndex: 0 },
      // schedule.length === 1, so currentRoundIndex 0 is the last round
    };
    // isLastRound = currentRoundIndex + 1 >= schedule.length → 0+1 >= 1 → true
    const { queryByText } = renderPhase(lastRoundGame, true);
    expect(queryByText('game.ui.basket.finishGame')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx jest __tests__/BasketGuessingPhase.test.tsx --no-coverage 2>&1 | tail -5
```
Expected: `Cannot find module '../components/game/basket/BasketGuessingPhase'`

- [ ] **Step 3: Implement BasketGuessingPhase**

```typescript
// components/game/basket/BasketGuessingPhase.tsx
import { ThemedText } from '@/components/themed-text';
import type { Game } from '@/contexts/GameContext';
import { useGame } from '@/contexts/GameContext';
import { GameColors } from '@/constants/theme';
import { t } from '@/i18n';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

interface Props {
  game: Game;
  user: { uid: string } | null;
  isAdmin: boolean;
  locale: string;
  isDark: boolean;
  getDisplayName: (name: string) => string;
}

export const BasketGuessingPhase: React.FC<Props> = ({
  game, user, isAdmin, locale, isDark, getDisplayName,
}) => {
  const { submitBasketCommentGuess, submitBasketAuthorGuess, startNextBasketRound } = useGame();
  const [selectedWriterId, setSelectedWriterId] = useState<string | null>(null);
  const [isCommentCorrect, setIsCommentCorrect] = useState<boolean | null>(null);
  const [authorSubmitted, setAuthorSubmitted] = useState(false);

  const { schedule, currentRoundIndex, currentRoundComments, currentRoundGuesses } = game.basketData!;
  const guesserId = user?.uid ?? '';
  const isLastRound = currentRoundIndex + 1 >= schedule.length;

  // Re-hydrate state from Firestore (handles remount after page refresh)
  const existingGuess = currentRoundGuesses.find(g => g.guesserId === guesserId);
  const isDone = existingGuess && (
    !existingGuess.commentCorrect || existingGuess.authorGuessId !== undefined
  );

  // The comment that is actually about this player — used for local correctness check
  const actualComment = currentRoundComments.find(c => c.subjectId === guesserId);

  const handleCommentSelect = async (commentWriterId: string) => {
    if (selectedWriterId || isDone) return;
    setSelectedWriterId(commentWriterId);
    const correct = actualComment?.writerId === commentWriterId;
    setIsCommentCorrect(correct);
    await submitBasketCommentGuess(commentWriterId);
  };

  const handleAuthorSelect = async (authorId: string) => {
    if (authorSubmitted || isDone) return;
    setAuthorSubmitted(true);
    await submitBasketAuthorGuess(authorId);
  };

  const otherPlayers = game.participants.filter(p => p.userId !== guesserId);
  const effectiveCorrect = isCommentCorrect ?? (existingGuess?.commentCorrect ?? null);
  const showAuthorPrompt = effectiveCorrect === true && !authorSubmitted && existingGuess?.authorGuessId === undefined;

  const nextRoundLabel = isLastRound
    ? t('game.ui.basket.finishGame', { locale })
    : t('game.ui.basket.nextRound', { locale });

  if (isDone || authorSubmitted || (selectedWriterId !== null && isCommentCorrect === false)) {
    return (
      <View style={styles.container}>
        {effectiveCorrect === false && (
          <ThemedText style={styles.wrong}>{t('game.ui.basket.wrong', { locale })}</ThemedText>
        )}
        <ThemedText style={styles.waiting}>
          {t('game.ui.basket.waitingForGuesses', {
            locale, count: currentRoundGuesses.length, total: game.participants.length,
          })}
        </ThemedText>
        {isAdmin && (
          <TouchableOpacity style={styles.nextButton} onPress={startNextBasketRound} activeOpacity={0.8}>
            <ThemedText style={styles.nextText}>{nextRoundLabel}</ThemedText>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showAuthorPrompt ? (
        <View style={styles.authorSection}>
          <ThemedText style={styles.correct}>{t('game.ui.basket.correct', { locale })}</ThemedText>
          <ThemedText style={styles.prompt}>{t('game.ui.basket.whoWroteIt', { locale })}</ThemedText>
          {otherPlayers.map(p => (
            <TouchableOpacity
              key={p.userId}
              style={styles.authorCard}
              onPress={() => handleAuthorSelect(p.userId)}
              activeOpacity={0.8}
            >
              <ThemedText>{getDisplayName(p.userName)}</ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View>
          <ThemedText style={styles.prompt}>{t('game.ui.basket.whichIsAboutYou', { locale })}</ThemedText>
          {currentRoundComments.map(comment => (
            <TouchableOpacity
              key={comment.writerId}
              style={styles.commentCard}
              onPress={() => handleCommentSelect(comment.writerId)}
              activeOpacity={0.8}
            >
              <ThemedText>{comment.text}</ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {isAdmin && (
        <TouchableOpacity style={styles.nextButton} onPress={startNextBasketRound} activeOpacity={0.8}>
          <ThemedText style={styles.nextText}>{nextRoundLabel}</ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 12, paddingVertical: 8 },
  prompt: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  commentCard: {
    backgroundColor: GameColors.cardBg, borderRadius: 10, padding: 14,
    marginBottom: 8, shadowColor: GameColors.shadow, shadowOpacity: 0.06,
    shadowRadius: 4, elevation: 2,
  },
  authorSection: { gap: 8 },
  authorCard: {
    backgroundColor: GameColors.cardBg, borderRadius: 10,
    padding: 14, marginBottom: 6,
  },
  correct: { color: GameColors.correct, fontWeight: '700', fontSize: 15 },
  wrong: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  waiting: { textAlign: 'center', opacity: 0.7, marginVertical: 12 },
  nextButton: {
    backgroundColor: GameColors.blue, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', marginTop: 8,
  },
  nextText: { color: GameColors.white, fontWeight: '600' },
});
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx jest __tests__/BasketGuessingPhase.test.tsx --no-coverage 2>&1 | tail -5
```
Expected: all 10 tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/game/basket/BasketGuessingPhase.tsx __tests__/BasketGuessingPhase.test.tsx
git commit -m "feat: add BasketGuessingPhase component with tests"
```

---

## Task 7: Wire up BasketScreen and GameScreen

**Files:**
- Modify: `components/game/basket/BasketScreen.tsx`
- Modify: `components/game/GameScreen.tsx`

- [ ] **Step 1: Update BasketScreen**

Replace the entire contents of `components/game/basket/BasketScreen.tsx` with:

```typescript
import type { Game } from '@/contexts/GameContext';
import React from 'react';
import { BasketGuessingPhase } from './BasketGuessingPhase';
import { BasketWritingPhase } from './BasketWritingPhase';

interface Props {
  game: Game;
  user: { uid: string } | null;
  isAdmin: boolean;
  locale: string;
  isDark: boolean;
  getDisplayName: (name: string) => string;
  showFancyAlert: (title: string, message?: string | null, buttons?: any[], customContent?: React.ReactNode) => void;
  showFaceMessage: (message: string, face?: React.ReactNode) => void;
}

export const BasketScreen: React.FC<Props> = (props) => {
  const { game } = props;
  if (game.status === 'basket_writing') return <BasketWritingPhase {...props} />;
  if (game.status === 'basket_guessing') return <BasketGuessingPhase {...props} />;
  return null;
};
```

- [ ] **Step 2: Update GameScreen to pass full props to BasketScreen**

In `components/game/GameScreen.tsx`, find:
```tsx
<BasketScreen game={currentGame} user={user} locale={locale} />
```

Replace with:
```tsx
<BasketScreen
  game={currentGame}
  user={user}
  isAdmin={isAdmin}
  locale={locale}
  isDark={isDark}
  getDisplayName={getDisplayName}
  showFancyAlert={showFancyAlert}
  showFaceMessage={showFaceMessage}
/>
```

- [ ] **Step 3: Also handle basket_writing / basket_guessing in WaitingPhase's startGame**

In `components/game/mirror/WaitingPhase.tsx`, the Start button currently calls `startGame` (the Mirror start). When `game.gameType === 'basket'`, it should call `startBasketGame` instead.

First add `startBasketGame` to the `useGame()` destructure in WaitingPhase. Find the line:
```typescript
const { loading, startGame, updateAdminWritesComments, updateShowSurnames, updateTargetSelectionMode, updateShowGuessResults, setGameType } = useGame();
```
Change to:
```typescript
const { loading, startGame, startBasketGame, updateAdminWritesComments, updateShowSurnames, updateTargetSelectionMode, updateShowGuessResults, setGameType } = useGame();
```

Then find where `startGame` is called in the start button's `onPress` handler and wrap with a game-type check. Find:
```typescript
await startGame();
```
Replace with:
```typescript
if (game.gameType === 'basket') {
  await startBasketGame();
} else {
  await startGame();
}
```

- [ ] **Step 4: Run full test suite**

```bash
npx jest --no-coverage 2>&1 | tail -15
```
Expected: all tests pass. If `WaitingPhase.test.tsx` fails because `startBasketGame` is not in the mock, add it:
In the `jest.mock('@/contexts/GameContext', ...)` block in `__tests__/WaitingPhase.test.tsx`, add `startBasketGame: jest.fn()` to the `useGame()` return object.

- [ ] **Step 5: Commit**

```bash
git add components/game/basket/BasketScreen.tsx components/game/GameScreen.tsx components/game/mirror/WaitingPhase.tsx __tests__/WaitingPhase.test.tsx
git commit -m "feat: wire BasketScreen routing and connect start button to startBasketGame"
```

---

## Final Verification

- [ ] **Run complete test suite**

```bash
npx jest --no-coverage 2>&1 | tail -15
```
Expected: all suites pass, zero failures.

- [ ] **TypeScript check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors.
