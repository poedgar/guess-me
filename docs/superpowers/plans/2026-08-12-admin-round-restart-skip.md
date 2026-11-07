# Admin Round Restart / Skip Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the admin two manual overrides, available at any point during the current round in every game mode (Mirror, Basket, Clash, Group Ideas): **Restart Round** (wipe this round's submissions, roll back its points, redo it) and **Skip Round** (abandon what's unfinished, move on, leave existing points alone).

**Architecture:** Eight new/changed `runTransaction`-based functions in `GameContext.tsx` (mirrored identically in `apps/expo` and `apps/web`), one shared `AdminRoundTools` UI component per app (collapsible "Admin tools" toggle + two confirm-gated buttons), and two new shared locale-string blocks. The component is dropped into all 8 existing phase screens (4 modes × writing/guessing step) with a one-line wire-up each.

**Tech Stack:** React Native + Expo (apps/expo), React + Vite (apps/web), Firebase Firestore (`runTransaction`), Jest + React Testing Library (apps/expo only — apps/web has no test runner, established in prior work).

## Global Constraints

- Every new game-mutating function throws unless the caller is `currentGame.adminId` — matches every existing admin-only action.
- Every read-modify-write touching round state + `scores` together uses `runTransaction` (fresh read at commit time), never a stale-local-state `updateDoc` — this is the same concurrency-safety requirement established in the basket/clash race-condition fixes earlier this session.
- `apps/web` and `apps/expo` get identical logic in `GameContext.tsx` — same "parity pattern" used throughout this codebase's history (confirm via `tsc --noEmit` on web, since it has no test runner).
- Locale strings live in **one shared place**: `packages/shared/src/locales/en.json` and `.../uk.json` — both apps import from `@mirror/shared`, so there is no per-app duplication needed.
- Spec reference: `docs/superpowers/specs/2026-08-11-admin-round-restart-skip-design.md` (as amended).

---

### Task 1: Mirror — `restartMirrorRound()` / `skipMirrorRound()`

**Files:**
- Modify: `apps/expo/contexts/GameContext.tsx`
- Modify: `apps/web/src/contexts/GameContext.tsx`
- Test: `apps/expo/__tests__/GameContext.edge-cases.test.tsx`

**Interfaces:**
- Produces: `restartMirrorRound(): Promise<void>`, `skipMirrorRound(): Promise<void>` — both added to `GameContextType` and the provider's exposed `value`.
- Consumes: existing `Round`, `Game`, `GuessingData` types; existing `startNextRound()`.

Mirror's round data does **not** live in one place. `currentRound` is only populated during the writing/point-giving step (`status: 'active'`). The moment `startGuessingPhase()` runs it sets `currentRound: null` and moves the round into `rounds[]` (naming it via `guessingData.singleRoundTargetId`) — it stays `null` through guessing, through the post-guessing bonus-points step, and through `finalizeGuessingPhase`, only reappearing once `startNextRound()` builds the next one. `restartMirrorRound` has to handle both cases.

- [ ] **Step 1: Write the failing tests**

Add to `apps/expo/__tests__/GameContext.edge-cases.test.tsx`, right after the existing `describe('awardCommentPoints — uses runTransaction...')` block (search for its closing `});` followed by `// ─── 7. resetTargetControls...`):

```typescript
// ─── 6c. restartMirrorRound / skipMirrorRound ─────────────────────────────────

describe('restartMirrorRound — resets the writing-step round in place', () => {
  const mockTxn = { get: jest.fn(), update: jest.fn() };

  const activeGameDoc = makeGameDoc({
    status: 'active',
    currentRound: {
      ...ACTIVE_ROUND,
      comments: [{ id: 'c1', authorId: 'admin-uid', text: 'hi', submittedAt: new Date(), points: 3 }],
      commentsVisible: true,
      pointsGiven: true,
      targetPoints: 2,
      targetPointsGivenBy: ['admin-uid'],
      targetPointsByPlayer: { 'admin-uid': 2 },
    },
    scores: { 'admin-uid': 3, 'player-uid': 2 },
    roundStartScores: {},
    roundStartGuessResults: {},
  });

  beforeEach(() => {
    const firestore = require('firebase/firestore');
    setupEnterGameMocks(firestore, activeGameDoc);
    mockTxn.get.mockResolvedValue(makeSnap(activeGameDoc));
    mockTxn.update.mockImplementation(() => {});
    firestore.runTransaction.mockImplementation(async (_db: unknown, cb: (t: typeof mockTxn) => Promise<void>) => {
      await cb(mockTxn);
    });
  });

  it('calls runTransaction and resets currentRound to an empty round with the same target/roundNumber', async () => {
    const firestore = require('firebase/firestore');
    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    firestore.runTransaction.mockClear();
    mockTxn.update.mockClear();

    await act(async () => { await result.current.restartMirrorRound(); });

    expect(firestore.runTransaction).toHaveBeenCalled();
    expect(mockTxn.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'active',
        currentRound: expect.objectContaining({
          roundNumber: 1,
          targetUserId: 'player-uid',
          comments: [],
          commentsVisible: false,
          pointsGiven: false,
          targetPoints: 0,
        }),
      }),
    );
  });

  it('restores scores/guessResults from the roundStartScores/roundStartGuessResults snapshot', async () => {
    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    mockTxn.update.mockClear();

    await act(async () => { await result.current.restartMirrorRound(); });

    const arg = mockTxn.update.mock.calls[0][1];
    expect(arg.scores).toEqual({});
    expect(arg.guessResults).toEqual({});
  });

  it('rejects a non-admin caller', async () => {
    const firestore = require('firebase/firestore');
    firestore.doc.mockReturnValue({ path: 'games/game-x' });
    // Re-enter as the non-admin player instead
    const config = require('@/config/firebase');
    config.auth.currentUser = { uid: 'player-uid' };
    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });

    await expect(
      act(async () => { await result.current.restartMirrorRound(); })
    ).rejects.toThrow('Only the admin can restart the round');
  });
});

describe('restartMirrorRound — mid-guessing (currentRound already null)', () => {
  const mockTxn = { get: jest.fn(), update: jest.fn() };

  const guessedComment = { id: 'c1', authorId: 'player-uid', text: 'hi', submittedAt: new Date() };
  const guessedRound = {
    roundNumber: 1,
    targetUserId: 'admin-uid',
    targetUserName: 'Admin',
    comments: [guessedComment],
    commentsVisible: true,
    pointsGiven: true,
    startedAt: new Date(),
    guesses: [],
  };
  const otherRound = { ...guessedRound, roundNumber: 2, targetUserId: 'someone-else' };

  const guessingGameDoc = makeGameDoc({
    status: 'guessing_phase',
    currentRound: null,
    rounds: [guessedRound, otherRound],
    guessingData: {
      commentsByTarget: { 'admin-uid': [guessedComment] },
      possibleAuthors: [],
      playersWhoSubmittedGuesses: [],
      allPlayersSubmitted: false,
      singleRoundTargetId: 'admin-uid',
    },
    roundStartScores: { 'admin-uid': 0 },
    roundStartGuessResults: {},
  });

  beforeEach(() => {
    const firestore = require('firebase/firestore');
    setupEnterGameMocks(firestore, guessingGameDoc);
    mockTxn.get.mockResolvedValue(makeSnap(guessingGameDoc));
    mockTxn.update.mockImplementation(() => {});
    firestore.runTransaction.mockImplementation(async (_db: unknown, cb: (t: typeof mockTxn) => Promise<void>) => {
      await cb(mockTxn);
    });
  });

  it('finds the round via guessingData.singleRoundTargetId, rebuilds currentRound, and removes it from rounds[]', async () => {
    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    mockTxn.update.mockClear();

    await act(async () => { await result.current.restartMirrorRound(); });

    const arg = mockTxn.update.mock.calls[0][1];
    expect(arg.currentRound).toEqual(
      expect.objectContaining({ roundNumber: 1, targetUserId: 'admin-uid', comments: [] }),
    );
    expect(arg.rounds).toEqual([otherRound]);
    expect(arg.status).toBe('active');
    expect(arg.guessingData).toBeNull();
  });

  it('throws "No active round to restart" when neither currentRound nor a matching guessingData round exists', async () => {
    const noRoundDoc = makeGameDoc({
      status: 'active',
      currentRound: null,
      rounds: [],
      guessingData: { commentsByTarget: {}, possibleAuthors: [] },
    });
    mockTxn.get.mockResolvedValue(makeSnap(noRoundDoc));
    const firestore = require('firebase/firestore');
    setupEnterGameMocks(firestore, noRoundDoc);
    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });

    await expect(
      act(async () => { await result.current.restartMirrorRound(); })
    ).rejects.toThrow('No active round to restart');
  });
});

describe('skipMirrorRound — thin wrapper around startNextRound', () => {
  it('is exposed by useGame and delegates to the same underlying advance logic as startNextRound', async () => {
    const firestore = require('firebase/firestore');
    // ACTIVE_ROUND has commentsVisible:false/pointsGiven:false, so it's still
    // "in progress" and startNextRound's completed-round archiving branch
    // doesn't fire — previousRounds stays [], so with only ADMIN+PLAYER as
    // participants the only available non-admin target is player-uid again,
    // producing a *new* round object at roundNumber 1 (not incremented,
    // since nothing was archived into `rounds` yet). What this test checks
    // is delegation — that skipMirrorRound triggers the exact same write
    // shape startNextRound itself produces — not the specific round number.
    const game = makeGameDoc({ status: 'active', currentRound: ACTIVE_ROUND, rounds: [] });
    setupEnterGameMocks(firestore, game);
    firestore.getDoc.mockResolvedValue(makeSnap(game));
    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    firestore.updateDoc.mockClear();

    await act(async () => { await result.current.skipMirrorRound(); });

    expect(firestore.updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        currentRound: expect.objectContaining({ roundNumber: 1, targetUserId: 'player-uid' }),
      }),
    );
  });
});

describe('awardPointsToPlayers — tags each award with the round it was given in', () => {
  const mockTxn = { get: jest.fn(), update: jest.fn() };

  const guessedComment = { id: 'c1', authorId: 'player-uid', text: 'hi', submittedAt: new Date() };
  const round1 = {
    roundNumber: 1, targetUserId: 'admin-uid', targetUserName: 'Admin',
    comments: [guessedComment], commentsVisible: true, pointsGiven: true, startedAt: new Date(), guesses: [],
  };

  const gameDoc = makeGameDoc({
    status: 'guessing_phase',
    currentRound: null,
    rounds: [round1],
    postGuessingPointPhase: true,
    playersWhoAwardedPostGuessPoints: [],
    guessingData: {
      commentsByTarget: {}, possibleAuthors: [], playersWhoSubmittedGuesses: [], allPlayersSubmitted: false,
      singleRoundTargetId: 'admin-uid',
    },
    adminAwards: {},
  });

  beforeEach(() => {
    const firestore = require('firebase/firestore');
    setupEnterGameMocks(firestore, gameDoc);
    mockTxn.get.mockResolvedValue(makeSnap(gameDoc));
    mockTxn.update.mockImplementation(() => {});
    firestore.runTransaction.mockImplementation(async (_db: unknown, cb: (t: typeof mockTxn) => Promise<void>) => {
      await cb(mockTxn);
    });
  });

  it('tags the stored award entry with roundNumber looked up via guessingData.singleRoundTargetId', async () => {
    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    mockTxn.update.mockClear();

    await act(async () => { await result.current.awardPointsToPlayers([{ recipientId: 'player-uid', points: 2 }]); });

    const arg = mockTxn.update.mock.calls[0][1];
    expect(arg.adminAwards['admin-uid'][0]).toEqual(
      expect.objectContaining({ recipientId: 'player-uid', points: 2, roundNumber: 1 }),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/expo && npx jest __tests__/GameContext.edge-cases.test.tsx -t "restartMirrorRound|skipMirrorRound|tags each award"`
Expected: FAIL — `restartMirrorRound is not a function`, `skipMirrorRound is not a function`, and the `roundNumber` assertion fails (currently `undefined`).

- [ ] **Step 3: Add the `roundNumber` field to `adminAwards` on the `Game` type**

In `apps/expo/contexts/GameContext.tsx`, find (around line 70):

```typescript
  adminAwards?: {
    [userId: string]: {
      recipientId: string;
      points: number;
      awardedBy: string;
      awardedAt: any;
    }[];
  };
```

Replace with:

```typescript
  adminAwards?: {
    [userId: string]: {
      recipientId: string;
      points: number;
      awardedBy: string;
      awardedAt: any;
      // Which round these points were given in, so a round restart can
      // strip stale entries from this history log. Undefined on entries
      // written before this field existed — safe, since restart never
      // applies to an already-finished game.
      roundNumber?: number;
    }[];
  };
```

- [ ] **Step 4: Update `awardPointsToPlayers` to tag each entry with `roundNumber`**

Find (around line 1934-1969):

```typescript
      await runTransaction(db, async (transaction) => {
        const gameSnap = await transaction.get(gameRef);
        if (!gameSnap.exists()) throw new Error("Game not found");
        const gameData = gameSnap.data() as Game;

        // Calculate new scores
        const currentScores = gameData.scores || {};
        const newScores = { ...currentScores };

        awards.forEach((award) => {
          newScores[award.recipientId] =
            (newScores[award.recipientId] || 0) + award.points;
        });

        // Store admin awards for history tracking
        const adminAwards = gameData.adminAwards || {};
        const currentAwards = adminAwards[userId] || [];
        const newAdminAwards = {
          ...adminAwards,
          [userId]: [
            ...currentAwards,
            ...awards.map((award) => ({
              ...award,
              awardedBy: userId,
              awardedAt: new Date(),
            })),
          ],
        };

        // Update game state
        transaction.update(gameRef, {
          scores: newScores,
          playersWhoAwardedPostGuessPoints: arrayUnion(userId),
          adminAwards: newAdminAwards,
        });
      });
```

Replace with:

```typescript
      await runTransaction(db, async (transaction) => {
        const gameSnap = await transaction.get(gameRef);
        if (!gameSnap.exists()) throw new Error("Game not found");
        const gameData = gameSnap.data() as Game;

        // Calculate new scores
        const currentScores = gameData.scores || {};
        const newScores = { ...currentScores };

        awards.forEach((award) => {
          newScores[award.recipientId] =
            (newScores[award.recipientId] || 0) + award.points;
        });

        // This always runs while currentRound is null (post-guessing bonus
        // points are part of the guessing-phase screen, before finalize) —
        // look the round number up via guessingData instead.
        const singleTargetId = gameData.guessingData?.singleRoundTargetId;
        const activeRound = singleTargetId
          ? (gameData.rounds ?? []).find((r) => r.targetUserId === singleTargetId)
          : undefined;
        const roundNumber = activeRound?.roundNumber;

        // Store admin awards for history tracking
        const adminAwards = gameData.adminAwards || {};
        const currentAwards = adminAwards[userId] || [];
        const newAdminAwards = {
          ...adminAwards,
          [userId]: [
            ...currentAwards,
            ...awards.map((award) => ({
              ...award,
              awardedBy: userId,
              awardedAt: new Date(),
              roundNumber,
            })),
          ],
        };

        // Update game state
        transaction.update(gameRef, {
          scores: newScores,
          playersWhoAwardedPostGuessPoints: arrayUnion(userId),
          adminAwards: newAdminAwards,
        });
      });
```

- [ ] **Step 5: Add `restartMirrorRound()` and `skipMirrorRound()`**

Add these two new functions immediately after `finalizeGuessingPhase` closes (search for the end of that function — the `};` right before `const updateAdminWritesComments = async (`):

```typescript
  const restartMirrorRound = async (): Promise<void> => {
    if (!currentGame || !user || user.uid !== currentGame.adminId) {
      throw new Error("Only the admin can restart the round");
    }
    try {
      setLoading(true);
      const gameRef = doc(db, "games", currentGame.id);
      await runTransaction(db, async (transaction: Transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game not found");
        const gameData = gameDoc.data() as Game;

        let target: { targetUserId: string; targetUserName: string; roundNumber: number };
        let remainingRounds = gameData.rounds ?? [];

        if (gameData.currentRound) {
          target = gameData.currentRound;
        } else {
          const singleTargetId = gameData.guessingData?.singleRoundTargetId;
          const foundRound = singleTargetId
            ? remainingRounds.find((r) => r.targetUserId === singleTargetId)
            : undefined;
          if (!foundRound) throw new Error("No active round to restart");
          target = foundRound;
          remainingRounds = remainingRounds.filter((r) => r.roundNumber !== foundRound.roundNumber);
        }

        const restartedRound: Round = {
          roundNumber: target.roundNumber,
          targetUserId: target.targetUserId,
          targetUserName: target.targetUserName,
          comments: [],
          commentsVisible: false,
          pointsGiven: false,
          startedAt: new Date(),
          targetPoints: 0,
          targetPointsGivenBy: [],
          targetPointsByPlayer: {},
          guesses: [],
          targetCorrectGuesses: 0,
          guessesFinalized: false,
        };

        const adminAwards = gameData.adminAwards ?? {};
        const filteredAdminAwards = Object.fromEntries(
          Object.entries(adminAwards).map(([uid, awards]) => [
            uid,
            awards.filter((a) => a.roundNumber !== target.roundNumber),
          ]),
        );

        transaction.update(gameRef, {
          status: "active",
          currentRound: restartedRound,
          rounds: remainingRounds,
          scores: gameData.roundStartScores ?? {},
          guessResults: gameData.roundStartGuessResults ?? {},
          postGuessingPointPhase: false,
          playersWhoAwardedPostGuessPoints: [],
          guessingData: null,
          playersWhoCompletedPostCommentPhase: [],
          adminAwards: filteredAdminAwards,
        });
      });
    } catch (err) {
      console.error("Error restarting round:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const skipMirrorRound = async (): Promise<void> => {
    await startNextRound();
  };
```

- [ ] **Step 6: Expose the new functions on `GameContextType` and the provider value**

In the `GameContextType` interface, find `startNextRound: () => Promise<void>;` and add right after it:

```typescript
  restartMirrorRound: () => Promise<void>;
  skipMirrorRound: () => Promise<void>;
```

In the `useMemo(() => ({ ... }), ...)` return object, find `startNextRound,` and add right after it:

```typescript
      restartMirrorRound,
      skipMirrorRound,
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd apps/expo && npx jest __tests__/GameContext.edge-cases.test.tsx`
Expected: PASS — all new tests, plus every pre-existing test in the file still passes (no regressions).

- [ ] **Step 8: Apply the identical change to `apps/web/src/contexts/GameContext.tsx`**

Same four edits (Steps 3-6) against `apps/web/src/contexts/GameContext.tsx` — the surrounding code is byte-identical (confirmed: `adminAwards` type at line 47, `awardPointsToPlayers` at line 1934, `finalizeGuessingPhase` at line 1500, `startNextRound` at line 1158), so the same old_string/new_string pairs apply directly.

Run: `cd apps/web && npx tsc --noEmit -p .`
Expected: no new errors compared to the pre-existing baseline (run `git stash && npx tsc --noEmit -p . && git stash pop` to diff if unsure).

- [ ] **Step 9: Commit**

```bash
git add apps/expo/contexts/GameContext.tsx apps/web/src/contexts/GameContext.tsx apps/expo/__tests__/GameContext.edge-cases.test.tsx
git commit -m "Add restartMirrorRound/skipMirrorRound admin controls"
```

---

### Task 2: Basket — `restartBasketRound()` / `skipBasketRound()`

**Files:**
- Modify: `apps/expo/contexts/GameContext.tsx`
- Modify: `apps/web/src/contexts/GameContext.tsx`
- Test: `apps/expo/__tests__/GameContext.basket.test.ts`

**Interfaces:**
- Produces: `restartBasketRound(): Promise<void>`, `skipBasketRound(): Promise<void>`.
- Consumes: `BasketGuess`, `BasketData` types; existing `startNextBasketRound()`.

- [ ] **Step 1: Write the failing tests**

Add to `apps/expo/__tests__/GameContext.basket.test.ts`, after the `describe('submitBasketAuthorGuess', ...)` block and before `describe('startNextBasketRound', ...)`:

```typescript
// ── restartBasketRound ──────────────────────────────────────────────────────
describe('restartBasketRound', () => {
  const guesses = [
    { guesserId: 'user-1', commentWriterId: 'user-2', commentCorrect: true, authorCorrect: true, authorGuessId: 'user-2', pointsAwarded: 2 },
    { guesserId: 'user-2', commentWriterId: 'user-3', commentCorrect: false, authorCorrect: false, pointsAwarded: 0 },
  ];
  const game = {
    ...BASE_GAME, status: 'basket_guessing',
    scores: { 'user-1': 2, 'user-2': 5 },
    basketData: {
      schedule: SCHEDULE, currentRoundIndex: 0,
      currentRoundComments: [{ writerId: 'user-2', subjectId: 'user-1', text: 'A', submittedAt: 1 }],
      currentRoundGuesses: guesses,
    },
  };
  const mockTxn = { get: jest.fn(), update: jest.fn() };

  function mockTransactionOn(gameData: object) {
    const f = require('firebase/firestore');
    mockTxn.get.mockResolvedValue({ exists: () => true, id: 'game-abc', data: () => gameData });
    mockTxn.update.mockClear();
    f.runTransaction.mockImplementation(async (_db: unknown, cb: (t: typeof mockTxn) => Promise<void>) => {
      await cb(mockTxn);
    });
  }

  it('clears comments/guesses, sets status back to basket_writing, keeps schedule/currentRoundIndex', async () => {
    const { result } = await enterWithGame(game);
    mockTransactionOn(game);

    await act(async () => { await result.current.restartBasketRound(); });

    expect(mockTxn.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'basket_writing',
        'basketData.currentRoundComments': [],
        'basketData.currentRoundGuesses': [],
      }),
    );
  });

  it('rolls back each guesser\'s score by the pointsAwarded they earned this round', async () => {
    const { result } = await enterWithGame(game);
    mockTransactionOn(game);

    await act(async () => { await result.current.restartBasketRound(); });

    const arg = mockTxn.update.mock.calls[0][1];
    // user-1 earned 2 points this round (2 -> 0), user-2 earned 0 (5 -> 5, no key written)
    expect(arg['scores.user-1']).toBe(0);
    expect(arg['scores.user-2']).toBeUndefined();
  });

  it('is a safe no-op when nothing was submitted yet this round', async () => {
    const emptyGame = { ...game, basketData: { ...game.basketData, currentRoundComments: [], currentRoundGuesses: [] } };
    const { result } = await enterWithGame(emptyGame);
    mockTransactionOn(emptyGame);

    await act(async () => { await result.current.restartBasketRound(); });

    const arg = mockTxn.update.mock.calls[0][1];
    expect(arg['basketData.currentRoundComments']).toEqual([]);
    expect(Object.keys(arg).filter((k) => k.startsWith('scores.'))).toHaveLength(0);
  });

  it('rejects a non-admin caller', async () => {
    const { result } = await enterWithGame(game);
    mockTransactionOn(game);
    const config = require('@/config/firebase');
    config.auth.currentUser = { uid: 'user-2', displayName: 'Bob', email: 'bob@example.com', photoURL: null };

    await expect(
      act(async () => { await result.current.restartBasketRound(); })
    ).rejects.toThrow('Only the admin can restart the round');
  });
});

// ── skipBasketRound ──────────────────────────────────────────────────────────
describe('skipBasketRound', () => {
  it('delegates to the same advance logic as startNextBasketRound', async () => {
    const game = {
      ...BASE_GAME, status: 'basket_guessing',
      basketData: { schedule: SCHEDULE, currentRoundIndex: 0, currentRoundComments: [], currentRoundGuesses: [] },
    };
    const { result, gameDoc } = await enterWithGame(game);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.skipBasketRound(); });

    expect(f.updateDoc).toHaveBeenCalledWith(gameDoc, expect.objectContaining({
      status: 'basket_writing',
      'basketData.currentRoundIndex': 1,
    }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/expo && npx jest __tests__/GameContext.basket.test.ts -t "restartBasketRound|skipBasketRound"`
Expected: FAIL — `restartBasketRound is not a function`, `skipBasketRound is not a function`.

- [ ] **Step 3: Add `restartBasketRound()` and `skipBasketRound()`**

In `apps/expo/contexts/GameContext.tsx`, add immediately after `startNextBasketRound` closes (search for its closing `};` right before `const setGameType = async (`):

```typescript
  const restartBasketRound = async (): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame || auth.currentUser.uid !== currentGame.adminId) {
      throw new Error("Only the admin can restart the round");
    }
    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      await runTransaction(db, async (transaction: Transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game not found");
        const gameData = gameDoc.data() as Game;
        if (!gameData.basketData) throw new Error("No active basket game");
        const { currentRoundGuesses } = gameData.basketData;

        const scoreDeltas: Record<string, number> = {};
        currentRoundGuesses.forEach((g: BasketGuess) => {
          scoreDeltas[g.guesserId] = (scoreDeltas[g.guesserId] ?? 0) + g.pointsAwarded;
        });

        const updates: Record<string, unknown> = {
          status: 'basket_writing',
          'basketData.currentRoundComments': [],
          'basketData.currentRoundGuesses': [],
        };
        Object.entries(scoreDeltas).forEach(([uid, delta]) => {
          if (delta === 0) return;
          updates[`scores.${uid}`] = (gameData.scores?.[uid] ?? 0) - delta;
        });

        transaction.update(gameRef, updates);
      });
    } catch (err) {
      console.error('Error restarting basket round:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const skipBasketRound = async (): Promise<void> => {
    await startNextBasketRound();
  };
```

- [ ] **Step 4: Expose on `GameContextType` and provider value**

Interface — after `startNextBasketRound: () => Promise<void>;`:

```typescript
  restartBasketRound: () => Promise<void>;
  skipBasketRound: () => Promise<void>;
```

Provider value — after `startNextBasketRound,`:

```typescript
      restartBasketRound,
      skipBasketRound,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/expo && npx jest __tests__/GameContext.basket.test.ts`
Expected: PASS — all tests, no regressions.

- [ ] **Step 6: Apply the identical change to `apps/web/src/contexts/GameContext.tsx`**

Same edits, same anchors (`startNextBasketRound` at line 1877, `setGameType` immediately after).

Run: `cd apps/web && npx tsc --noEmit -p .` — expect no new errors vs. baseline.

- [ ] **Step 7: Commit**

```bash
git add apps/expo/contexts/GameContext.tsx apps/web/src/contexts/GameContext.tsx apps/expo/__tests__/GameContext.basket.test.ts
git commit -m "Add restartBasketRound/skipBasketRound admin controls"
```

---

### Task 3: Clash — `restartClashRound()` / `skipClashRound()` + `advanceClashGuessing` force path

**Files:**
- Modify: `apps/expo/contexts/GameContext.tsx`
- Modify: `apps/web/src/contexts/GameContext.tsx`
- Test: `apps/expo/__tests__/GameContext.clash.test.ts`

**Interfaces:**
- Produces: `restartClashRound(): Promise<void>`, `skipClashRound(): Promise<void>`.
- Changes: `advanceClashGuessing(force?: boolean): Promise<void>` (was `advanceClashGuessing(): Promise<void>` — existing callers passing no argument are unaffected, `force` defaults to `false`).

- [ ] **Step 1: Write the failing tests**

Add to `apps/expo/__tests__/GameContext.clash.test.ts`, after the `describe('submitClashAuthorGuess', ...)` block:

```typescript
// ── advanceClashGuessing(force) ───────────────────────────────────────────────
describe('advanceClashGuessing — force path', () => {
  const game = {
    ...BASE_GAME,
    clashData: {
      groupA: { leaderId: 'leader-a', memberIds: ['leader-a', 'member-a'] },
      groupB: { leaderId: 'leader-b', memberIds: ['leader-b', 'member-b'] },
      schedule: [{ assignmentsA: [], assignmentsB: [] }, { assignmentsA: [], assignmentsB: [] }],
      currentRoundIndex: 0,
      currentRoundCommentsA: [{ writerId: 'member-a', subjectId: 'x', text: 't', submittedAt: 1 }],
      currentRoundCommentsB: [{ writerId: 'member-b', subjectId: 'y', text: 't', submittedAt: 1 }],
      lastGroupToFinish: 'b',
      currentGuessingGroup: 'a',
      currentRoundGuessesA: [], // group A leader hasn't guessed at all — normally blocks advancing
      currentRoundGuessesB: [],
      teamScores: { a: 0, b: 0 },
    },
  };

  it('without force, moves to the other group when the current one is incomplete (unchanged behavior)', async () => {
    const { result, gameDoc } = await enterWithGame(game);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.advanceClashGuessing(); });

    expect(f.updateDoc).toHaveBeenCalledWith(gameDoc, { 'clashData.currentGuessingGroup': 'b' });
  });

  it('with force:true, jumps straight to the next round regardless of completion', async () => {
    const { result, gameDoc } = await enterWithGame(game);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.advanceClashGuessing(true); });

    expect(f.updateDoc).toHaveBeenCalledWith(gameDoc, expect.objectContaining({
      status: 'clash_writing',
      'clashData.currentRoundIndex': 1,
    }));
  });
});

// ── restartClashRound ───────────────────────────────────────────────────────
describe('restartClashRound', () => {
  const guessesA = [{ commentWriterId: 'member-b', guessedSubjectId: 'leader-a', subjectCorrect: true, guessedAuthorId: 'member-b', authorCorrect: true, pointsAwarded: 2 }];
  const guessesB = [{ commentWriterId: 'member-a', guessedSubjectId: 'x', subjectCorrect: false, pointsAwarded: 0 }];
  const game = {
    ...BASE_GAME,
    scores: { 'leader-a': 2, 'leader-b': 5 },
    clashData: {
      groupA: { leaderId: 'leader-a', memberIds: ['leader-a', 'member-a'] },
      groupB: { leaderId: 'leader-b', memberIds: ['leader-b', 'member-b'] },
      schedule: [{ assignmentsA: [], assignmentsB: [] }],
      currentRoundIndex: 0,
      currentRoundCommentsA: [{ writerId: 'member-a', subjectId: 'x', text: 't', submittedAt: 1 }],
      currentRoundCommentsB: [{ writerId: 'member-b', subjectId: 'leader-a', text: 't', submittedAt: 1 }],
      lastGroupToFinish: 'b',
      currentGuessingGroup: 'a',
      currentRoundGuessesA: guessesA,
      currentRoundGuessesB: guessesB,
      teamScores: { a: 2, b: 0 },
    },
  };
  const mockTxn = { get: jest.fn(), update: jest.fn() };

  function mockTransactionOn(gameData: object) {
    const f = require('firebase/firestore');
    mockTxn.get.mockResolvedValue({ exists: () => true, id: 'game-abc', data: () => gameData });
    mockTxn.update.mockClear();
    f.runTransaction.mockImplementation(async (_db: unknown, cb: (t: typeof mockTxn) => Promise<void>) => {
      await cb(mockTxn);
    });
  }

  it('clears both groups\' comments/guesses and resets turn state, sets status back to clash_writing', async () => {
    const { result } = await enterWithGame(game);
    mockTransactionOn(game);

    await act(async () => { await result.current.restartClashRound(); });

    expect(mockTxn.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'clash_writing',
        'clashData.currentRoundCommentsA': [],
        'clashData.currentRoundCommentsB': [],
        'clashData.currentRoundGuessesA': [],
        'clashData.currentRoundGuessesB': [],
        'clashData.lastGroupToFinish': null,
        'clashData.currentGuessingGroup': null,
      }),
    );
  });

  it('rolls back both individual and team scores for the points earned this round', async () => {
    const { result } = await enterWithGame(game);
    mockTransactionOn(game);

    await act(async () => { await result.current.restartClashRound(); });

    const arg = mockTxn.update.mock.calls[0][1];
    expect(arg['scores.leader-a']).toBe(0); // 2 - 2
    expect(arg['scores.leader-b']).toBeUndefined(); // group B earned 0 this round
    expect(arg['clashData.teamScores.a']).toBe(0); // 2 - 2
    expect(arg['clashData.teamScores.b']).toBe(0); // 0 - 0
  });

  it('rejects a non-admin caller', async () => {
    const { result } = await enterWithGame(game);
    mockTransactionOn(game);
    const config = require('@/config/firebase');
    config.auth.currentUser = { uid: 'member-a', displayName: 'MemberA', email: 'membera@example.com', photoURL: null };

    await expect(
      act(async () => { await result.current.restartClashRound(); })
    ).rejects.toThrow('Only the admin can restart the round');
  });
});

// ── skipClashRound ──────────────────────────────────────────────────────────
describe('skipClashRound', () => {
  it('calls advanceClashGuessing with force:true', async () => {
    const game = {
      ...BASE_GAME,
      clashData: {
        groupA: { leaderId: 'leader-a', memberIds: ['leader-a'] },
        groupB: { leaderId: 'leader-b', memberIds: ['leader-b'] },
        schedule: [{ assignmentsA: [], assignmentsB: [] }, { assignmentsA: [], assignmentsB: [] }],
        currentRoundIndex: 0,
        currentRoundCommentsA: [], currentRoundCommentsB: [],
        lastGroupToFinish: null, currentGuessingGroup: 'a',
        currentRoundGuessesA: [], currentRoundGuessesB: [],
        teamScores: { a: 0, b: 0 },
      },
    };
    const { result, gameDoc } = await enterWithGame(game);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.skipClashRound(); });

    expect(f.updateDoc).toHaveBeenCalledWith(gameDoc, expect.objectContaining({
      status: 'clash_writing',
      'clashData.currentRoundIndex': 1,
    }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/expo && npx jest __tests__/GameContext.clash.test.ts -t "force path|restartClashRound|skipClashRound"`
Expected: FAIL — `force:true` behaves the same as no-arg (since `advanceClashGuessing` doesn't accept a parameter yet), `restartClashRound`/`skipClashRound` are not functions.

- [ ] **Step 3: Add the `force` parameter to `advanceClashGuessing`**

Find (around line 2294):

```typescript
  const advanceClashGuessing = async (): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame || auth.currentUser.uid !== currentGame.adminId) throw new Error("Only the admin can advance guessing");
    const cd = currentGame.clashData;
    if (!cd || currentGame.status !== 'clash_guessing') throw new Error("Not in guessing phase");
    const currentGroup = cd.currentGuessingGroup!;
    const otherGroup: 'a' | 'b' = currentGroup === 'a' ? 'b' : 'a';
    const otherGuessCount = otherGroup === 'a' ? cd.currentRoundGuessesA.length : cd.currentRoundGuessesB.length;
    const otherCommentCount = otherGroup === 'a' ? cd.currentRoundCommentsB.length : cd.currentRoundCommentsA.length;
    const otherGroupDone = otherCommentCount > 0 && otherGuessCount >= otherCommentCount;
```

Replace with:

```typescript
  const advanceClashGuessing = async (force: boolean = false): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame || auth.currentUser.uid !== currentGame.adminId) throw new Error("Only the admin can advance guessing");
    const cd = currentGame.clashData;
    if (!cd || currentGame.status !== 'clash_guessing') throw new Error("Not in guessing phase");
    const currentGroup = cd.currentGuessingGroup!;
    const otherGroup: 'a' | 'b' = currentGroup === 'a' ? 'b' : 'a';
    const otherGuessCount = otherGroup === 'a' ? cd.currentRoundGuessesA.length : cd.currentRoundGuessesB.length;
    const otherCommentCount = otherGroup === 'a' ? cd.currentRoundCommentsB.length : cd.currentRoundCommentsA.length;
    const otherGroupDone = force || (otherCommentCount > 0 && otherGuessCount >= otherCommentCount);
```

(The rest of the function body is unchanged — `otherGroupDone` already drives every branch below it.)

- [ ] **Step 4: Add `restartClashRound()` and `skipClashRound()`**

Add immediately after `advanceClashGuessing` closes (search for its closing `};` right before `const startIdeaGame = async (`):

```typescript
  const restartClashRound = async (): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame || auth.currentUser.uid !== currentGame.adminId) {
      throw new Error("Only the admin can restart the round");
    }
    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      await runTransaction(db, async (transaction: Transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game not found");
        const gameData = gameDoc.data() as Game;
        const cd = gameData.clashData;
        if (!cd) throw new Error("No active clash game");

        const pointsA = cd.currentRoundGuessesA.reduce((sum: number, g: ClashGuess) => sum + g.pointsAwarded, 0);
        const pointsB = cd.currentRoundGuessesB.reduce((sum: number, g: ClashGuess) => sum + g.pointsAwarded, 0);

        const updates: Record<string, unknown> = {
          status: 'clash_writing',
          'clashData.currentRoundCommentsA': [],
          'clashData.currentRoundCommentsB': [],
          'clashData.currentRoundGuessesA': [],
          'clashData.currentRoundGuessesB': [],
          'clashData.lastGroupToFinish': null,
          'clashData.currentGuessingGroup': null,
          'clashData.teamScores.a': (cd.teamScores.a ?? 0) - pointsA,
          'clashData.teamScores.b': (cd.teamScores.b ?? 0) - pointsB,
        };
        if (pointsA > 0) {
          updates[`scores.${cd.groupA.leaderId}`] = (gameData.scores?.[cd.groupA.leaderId] ?? 0) - pointsA;
        }
        if (pointsB > 0) {
          updates[`scores.${cd.groupB.leaderId}`] = (gameData.scores?.[cd.groupB.leaderId] ?? 0) - pointsB;
        }

        transaction.update(gameRef, updates);
      });
    } catch (err) {
      console.error('Error restarting clash round:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const skipClashRound = async (): Promise<void> => {
    await advanceClashGuessing(true);
  };
```

- [ ] **Step 5: Expose on `GameContextType` and provider value**

Interface — replace `advanceClashGuessing: () => Promise<void>;` with:

```typescript
  advanceClashGuessing: (force?: boolean) => Promise<void>;
  restartClashRound: () => Promise<void>;
  skipClashRound: () => Promise<void>;
```

Provider value — after `advanceClashGuessing,`:

```typescript
      restartClashRound,
      skipClashRound,
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/expo && npx jest __tests__/GameContext.clash.test.ts`
Expected: PASS — all tests, no regressions.

- [ ] **Step 7: Apply the identical change to `apps/web/src/contexts/GameContext.tsx`**

Same three edits, same anchors (`advanceClashGuessing` at line 2318, `startIdeaGame` immediately after it).

Run: `cd apps/web && npx tsc --noEmit -p .` — expect no new errors vs. baseline.

- [ ] **Step 8: Commit**

```bash
git add apps/expo/contexts/GameContext.tsx apps/web/src/contexts/GameContext.tsx apps/expo/__tests__/GameContext.clash.test.ts
git commit -m "Add restartClashRound/skipClashRound admin controls, force-advance path"
```

---

### Task 4: Group Ideas — `restartIdeaRound()` / `skipIdeaRound()`

**Files:**
- Modify: `apps/expo/contexts/GameContext.tsx`
- Modify: `apps/web/src/contexts/GameContext.tsx`
- Test: `apps/expo/__tests__/GameContext.ideas.test.ts`

**Interfaces:**
- Produces: `restartIdeaRound(): Promise<void>`, `skipIdeaRound(): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

Add to `apps/expo/__tests__/GameContext.ideas.test.ts` (after the existing `describe('submitIdeaRating', ...)` block if present, otherwise at the end of the file, before any final closing):

```typescript
// ── restartIdeaRound ────────────────────────────────────────────────────────
describe('restartIdeaRound', () => {
  const IDEAS = [
    { id: 'i1', authorId: 'user-2', text: 'Idea from Bob', submittedAt: 1 },
    { id: 'i2', authorId: 'user-3', text: 'Idea from Carol', submittedAt: 2 },
  ];
  const ratings = [
    { raterId: 'user-1', ideaId: 'i1', points: 4 },
    { raterId: 'user-1', ideaId: 'i2', points: 1 },
  ];
  const game = {
    ...BASE_GAME,
    status: 'idea_rating',
    scores: { 'user-2': 4, 'user-3': 1 },
    ideaData: {
      incognitoMode: true,
      ideas: IDEAS,
      schedule: ['user-2', 'user-3'],
      currentRoundIndex: 0,
      currentRoundRatings: ratings,
    },
  };
  const mockTxn = { get: jest.fn(), update: jest.fn() };

  function mockTransactionOn(gameData: object) {
    const f = require('firebase/firestore');
    mockTxn.get.mockResolvedValue({ exists: () => true, id: 'game-abc', data: () => gameData });
    mockTxn.update.mockClear();
    f.runTransaction.mockImplementation(async (_db: unknown, cb: (t: typeof mockTxn) => Promise<void>) => {
      await cb(mockTxn);
    });
  }

  it('clears currentRoundRatings and keeps schedule/currentRoundIndex untouched', async () => {
    const { result } = await enterWithGame(game);
    mockTransactionOn(game);

    await act(async () => { await result.current.restartIdeaRound(); });

    const arg = mockTxn.update.mock.calls[0][1];
    expect(arg['ideaData.currentRoundRatings']).toEqual([]);
    expect(arg['ideaData.schedule']).toBeUndefined(); // not touched, so not written
  });

  it('rolls back each rated idea\'s author score by the points they were given this round', async () => {
    const { result } = await enterWithGame(game);
    mockTransactionOn(game);

    await act(async () => { await result.current.restartIdeaRound(); });

    const arg = mockTxn.update.mock.calls[0][1];
    expect(arg['scores.user-2']).toBe(0); // 4 - 4
    expect(arg['scores.user-3']).toBe(0); // 1 - 1
  });

  it('rejects a non-admin caller', async () => {
    const { result } = await enterWithGame(game);
    mockTransactionOn(game);
    const config = require('@/config/firebase');
    config.auth.currentUser = { uid: 'user-2', displayName: 'Bob', email: 'bob@example.com', photoURL: null };

    await expect(
      act(async () => { await result.current.restartIdeaRound(); })
    ).rejects.toThrow('Only the admin can restart the round');
  });
});

// ── skipIdeaRound ────────────────────────────────────────────────────────────
describe('skipIdeaRound', () => {
  it('delegates to the same advance logic as startNextIdeaRound', async () => {
    const game = {
      ...BASE_GAME, status: 'idea_rating',
      ideaData: { incognitoMode: true, ideas: [], schedule: ['user-1', 'user-2'], currentRoundIndex: 0, currentRoundRatings: [] },
    };
    const { result, gameDoc } = await enterWithGame(game);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.skipIdeaRound(); });

    expect(f.updateDoc).toHaveBeenCalledWith(gameDoc, {
      'ideaData.currentRoundIndex': 1,
      'ideaData.currentRoundRatings': [],
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/expo && npx jest __tests__/GameContext.ideas.test.ts -t "restartIdeaRound|skipIdeaRound"`
Expected: FAIL — `restartIdeaRound is not a function`, `skipIdeaRound is not a function`.

- [ ] **Step 3: Add `restartIdeaRound()` and `skipIdeaRound()`**

Add immediately after `startNextIdeaRound` closes (search for its closing `};` right before `const updateIdeaIncognitoMode = async (`):

```typescript
  const restartIdeaRound = async (): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame || auth.currentUser.uid !== currentGame.adminId) {
      throw new Error("Only the admin can restart the round");
    }
    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      await runTransaction(db, async (transaction: Transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game not found");
        const gameData = gameDoc.data() as Game;
        const ideaData = gameData.ideaData;
        if (!ideaData) throw new Error("No active Group Ideas game");

        const scoreDeltas: Record<string, number> = {};
        ideaData.currentRoundRatings.forEach((r: IdeaRating) => {
          const idea = ideaData.ideas.find((i: Idea) => i.id === r.ideaId);
          if (!idea) return;
          scoreDeltas[idea.authorId] = (scoreDeltas[idea.authorId] ?? 0) + r.points;
        });

        const updates: Record<string, unknown> = {
          'ideaData.currentRoundRatings': [],
        };
        Object.entries(scoreDeltas).forEach(([authorId, delta]) => {
          if (delta === 0) return;
          updates[`scores.${authorId}`] = (gameData.scores?.[authorId] ?? 0) - delta;
        });

        transaction.update(gameRef, updates);
      });
    } catch (err) {
      console.error('Error restarting idea round:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const skipIdeaRound = async (): Promise<void> => {
    await startNextIdeaRound();
  };
```

- [ ] **Step 4: Expose on `GameContextType` and provider value**

Interface — after `startNextIdeaRound: () => Promise<void>;`:

```typescript
  restartIdeaRound: () => Promise<void>;
  skipIdeaRound: () => Promise<void>;
```

Provider value — after `startNextIdeaRound,`:

```typescript
      restartIdeaRound,
      skipIdeaRound,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/expo && npx jest __tests__/GameContext.ideas.test.ts`
Expected: PASS — all tests, no regressions.

- [ ] **Step 6: Apply the identical change to `apps/web/src/contexts/GameContext.tsx`**

Same edits, same anchors (`startNextIdeaRound` at line 2470, `updateIdeaIncognitoMode` immediately after).

Run: `cd apps/web && npx tsc --noEmit -p .` — expect no new errors vs. baseline.

- [ ] **Step 7: Commit**

```bash
git add apps/expo/contexts/GameContext.tsx apps/web/src/contexts/GameContext.tsx apps/expo/__tests__/GameContext.ideas.test.ts
git commit -m "Add restartIdeaRound/skipIdeaRound admin controls"
```

---

### Task 5: Shared locale strings

**Files:**
- Modify: `packages/shared/src/locales/en.json`
- Modify: `packages/shared/src/locales/uk.json`

**Interfaces:**
- Produces: `game.ui.adminTools`, `game.ui.restartRound`, `game.ui.skipRound`, `game.alerts.restartRoundTitle`, `game.alerts.restartRoundMessage`, `game.alerts.skipRoundTitle`, `game.alerts.skipRoundMessage` — new translation keys consumed by Task 6's `AdminRoundTools` component.

Both apps import `t`/locale data from `@mirror/shared` (confirmed: `apps/expo/i18n/index.ts` and the web `LanguageContext` both source from this one package) — a single edit here covers both apps, no per-app duplication.

- [ ] **Step 1: Add the `game.ui.*` keys to `en.json`**

Find (the existing Force Finalize pair):

```json
    "forceFinalizeTitle": "Not all guesses submitted",
    "forceFinalizeMessage": "Some players haven't submitted their guesses. Finalize anyway?",
```

Replace with (adding the three new keys right after, preserving the existing pair and trailing comma):

```json
    "forceFinalizeTitle": "Not all guesses submitted",
    "forceFinalizeMessage": "Some players haven't submitted their guesses. Finalize anyway?",
    "adminTools": "Admin tools",
    "restartRound": "Restart Round",
    "skipRound": "Skip Round",
```

- [ ] **Step 2: Add the `game.alerts.*` keys to `en.json`**

Find (the existing leave-game confirm triplet):

```json
    "leaveGameTitle": "Leave game",
    "leaveGameMessage": "Are you sure you want to leave this game?",
    "confirmLeave": "Leave",
```

Replace with:

```json
    "leaveGameTitle": "Leave game",
    "leaveGameMessage": "Are you sure you want to leave this game?",
    "confirmLeave": "Leave",
    "restartRoundTitle": "Restart this round?",
    "restartRoundMessage": "Everyone's comments and guesses for this round will be cleared, and any points already given this round will be undone. This can't be undone.",
    "skipRoundTitle": "Skip to the next round?",
    "skipRoundMessage": "Not everyone has finished this round. Anything already submitted keeps its points — this just stops waiting and moves on.",
```

- [ ] **Step 3: Add the equivalent keys to `uk.json`**

Find (the existing Force Finalize pair):

```json
    "forceFinalizeTitle": "Не всі здогадки надіслано",
    "forceFinalizeMessage": "Деякі гравці ще не надіслали свої здогадки. Завершити все одно?",
```

Replace with:

```json
    "forceFinalizeTitle": "Не всі здогадки надіслано",
    "forceFinalizeMessage": "Деякі гравці ще не надіслали свої здогадки. Завершити все одно?",
    "adminTools": "Інструменти адміна",
    "restartRound": "Перезапустити раунд",
    "skipRound": "Пропустити раунд",
```

Find (the existing leave-game confirm triplet):

```json
    "leaveGameTitle": "Вийти з гри",
    "leaveGameMessage": "Ви впевнені, що хочете вийти з цієї гри?",
    "confirmLeave": "Вийти",
```

Replace with:

```json
    "leaveGameTitle": "Вийти з гри",
    "leaveGameMessage": "Ви впевнені, що хочете вийти з цієї гри?",
    "confirmLeave": "Вийти",
    "restartRoundTitle": "Перезапустити цей раунд?",
    "restartRoundMessage": "Коментарі та здогадки всіх гравців за цей раунд буде очищено, а вже нараховані цього раунду бали скасовано. Це неможливо скасувати.",
    "skipRoundTitle": "Перейти до наступного раунду?",
    "skipRoundMessage": "Не всі гравці завершили цей раунд. Уже надіслане збереже свої бали — це просто припиняє очікування і рухається далі.",
```

- [ ] **Step 4: Verify the JSON is still valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/shared/src/locales/en.json', 'utf8')); JSON.parse(require('fs').readFileSync('packages/shared/src/locales/uk.json', 'utf8')); console.log('valid')"`
Expected: prints `valid` with no errors.

- [ ] **Step 5: Run the existing i18n test suite to confirm nothing broke**

Run: `cd apps/expo && npx jest i18n`
Expected: PASS — no regressions from the new keys.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/locales/en.json packages/shared/src/locales/uk.json
git commit -m "Add restart/skip round locale strings"
```

---

### Task 6: `AdminRoundTools` shared component (both apps)

**Files:**
- Create: `apps/expo/components/game/AdminRoundTools.tsx`
- Create: `apps/web/src/components/game/AdminRoundTools.tsx`
- Test: `apps/expo/__tests__/AdminRoundTools.test.tsx`

**Interfaces:**
- Produces (expo): `AdminRoundTools: React.FC<{ isAdmin: boolean; locale: string; showFancyAlert?: ShowFancyAlertFn; onRestart: () => Promise<void>; onSkip: () => Promise<void> }>`.
- Produces (web): `AdminRoundTools: React.FC<{ isAdmin: boolean; onRestart: () => Promise<void>; onSkip: () => Promise<void> }>` (derives `t`/confirm dialog internally via `useLanguage()`/`useAlert()`, matching web's existing convention of not passing these as props).
- Consumes: Task 5's locale keys; expo's `ShowFancyAlertFn` type from `@/components/game/GameHeader`; web's `useAlert()`/`useLanguage()` hooks.

One component per app, dropped into all 8 phase screens in Tasks 7-10 — this is the only place the collapsible-toggle + confirm-dialog logic is written, rather than duplicating it 8 times per app.

- [ ] **Step 1: Write the failing tests (expo)**

Create `apps/expo/__tests__/AdminRoundTools.test.tsx`:

```tsx
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@/i18n', () => ({
  t: (key: string) => key,
}));

jest.mock('@/components/themed-text', () => {
  const { Text } = require('react-native');
  return { ThemedText: ({ children, ...p }: any) => <Text {...p}>{children}</Text> };
});

jest.mock('@/constants/theme', () => ({
  GameColors: { purple: '#AF52DE', neutral: '#8E8E93' },
}));

jest.mock('@/components/game/GameHeader', () => ({}));

const { AdminRoundTools } = require('../components/game/AdminRoundTools');

function confirmingShowFancyAlert(_title: string, _message: string, buttons?: any[]) {
  const confirmButton = buttons?.find((b) => b.style !== 'cancel');
  confirmButton?.onPress?.();
}

describe('AdminRoundTools', () => {
  it('renders nothing for a non-admin', () => {
    const { queryByText } = render(
      <AdminRoundTools isAdmin={false} locale="en" showFancyAlert={jest.fn()} onRestart={jest.fn()} onSkip={jest.fn()} />
    );
    expect(queryByText(/game.ui.adminTools/)).toBeNull();
  });

  it('shows the collapsed toggle for an admin, buttons hidden until expanded', () => {
    const { getByText, queryByText } = render(
      <AdminRoundTools isAdmin={true} locale="en" showFancyAlert={jest.fn()} onRestart={jest.fn()} onSkip={jest.fn()} />
    );
    expect(getByText(/game.ui.adminTools/)).toBeTruthy();
    expect(queryByText(/game.ui.restartRound/)).toBeNull();
    expect(queryByText(/game.ui.skipRound/)).toBeNull();
  });

  it('expanding the toggle reveals both buttons', () => {
    const { getByText, queryByText } = render(
      <AdminRoundTools isAdmin={true} locale="en" showFancyAlert={jest.fn()} onRestart={jest.fn()} onSkip={jest.fn()} />
    );
    fireEvent.press(getByText(/game.ui.adminTools/));
    expect(queryByText(/game.ui.restartRound/)).toBeTruthy();
    expect(queryByText(/game.ui.skipRound/)).toBeTruthy();
  });

  it('tapping Restart triggers the confirm dialog and, once confirmed, calls onRestart', async () => {
    const onRestart = jest.fn().mockResolvedValue(undefined);
    const { getByText } = render(
      <AdminRoundTools isAdmin={true} locale="en" showFancyAlert={confirmingShowFancyAlert} onRestart={onRestart} onSkip={jest.fn()} />
    );
    fireEvent.press(getByText(/game.ui.adminTools/));
    await act(async () => { fireEvent.press(getByText(/game.ui.restartRound/)); });
    expect(onRestart).toHaveBeenCalled();
  });

  it('tapping Skip triggers the confirm dialog and, once confirmed, calls onSkip', async () => {
    const onSkip = jest.fn().mockResolvedValue(undefined);
    const { getByText } = render(
      <AdminRoundTools isAdmin={true} locale="en" showFancyAlert={confirmingShowFancyAlert} onRestart={jest.fn()} onSkip={onSkip} />
    );
    fireEvent.press(getByText(/game.ui.adminTools/));
    await act(async () => { fireEvent.press(getByText(/game.ui.skipRound/)); });
    expect(onSkip).toHaveBeenCalled();
  });

  it('does not call onRestart if the confirm dialog never confirms', async () => {
    const onRestart = jest.fn();
    const neverConfirms = jest.fn(); // simulates the user dismissing/cancelling
    const { getByText } = render(
      <AdminRoundTools isAdmin={true} locale="en" showFancyAlert={neverConfirms} onRestart={onRestart} onSkip={jest.fn()} />
    );
    fireEvent.press(getByText(/game.ui.adminTools/));
    await act(async () => { fireEvent.press(getByText(/game.ui.restartRound/)); });
    expect(onRestart).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/expo && npx jest __tests__/AdminRoundTools.test.tsx`
Expected: FAIL — cannot find module `../components/game/AdminRoundTools` (doesn't exist yet).

- [ ] **Step 3: Create the expo component**

Create `apps/expo/components/game/AdminRoundTools.tsx`:

```tsx
import { ThemedText } from '@/components/themed-text';
import { ShowFancyAlertFn } from '@/components/game/GameHeader';
import { GameColors } from '@/constants/theme';
import { t } from '@/i18n';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';

interface Props {
  isAdmin: boolean;
  locale: string;
  showFancyAlert?: ShowFancyAlertFn;
  onRestart: () => Promise<void>;
  onSkip: () => Promise<void>;
}

export const AdminRoundTools: React.FC<Props> = ({
  isAdmin,
  locale,
  showFancyAlert,
  onRestart,
  onSkip,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);

  if (!isAdmin) return null;

  const confirmRestart = () => {
    showFancyAlert?.(
      t('game.alerts.restartRoundTitle', { locale }),
      t('game.alerts.restartRoundMessage', { locale }),
      [
        { text: t('common.cancel', { locale }), style: 'cancel' },
        {
          text: t('game.ui.restartRound', { locale }),
          style: 'destructive',
          onPress: async () => {
            setIsRestarting(true);
            try {
              await onRestart();
            } finally {
              setIsRestarting(false);
            }
          },
        },
      ],
    );
  };

  const confirmSkip = () => {
    showFancyAlert?.(
      t('game.alerts.skipRoundTitle', { locale }),
      t('game.alerts.skipRoundMessage', { locale }),
      [
        { text: t('common.cancel', { locale }), style: 'cancel' },
        {
          text: t('game.ui.skipRound', { locale }),
          onPress: async () => {
            setIsSkipping(true);
            try {
              await onSkip();
            } finally {
              setIsSkipping(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={() => setExpanded((e) => !e)}
        accessibilityRole="button"
        accessibilityLabel={t('game.ui.adminTools', { locale })}
      >
        <ThemedText style={styles.toggle}>
          {`${t('game.ui.adminTools', { locale })} ${expanded ? '▴' : '▾'}`}
        </ThemedText>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.restartButton, isRestarting && styles.buttonDisabled]}
            onPress={confirmRestart}
            disabled={isRestarting || isSkipping}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('game.ui.restartRound', { locale })}
          >
            {isRestarting ? (
              <ActivityIndicator size="small" color={GameColors.purple} />
            ) : (
              <ThemedText style={styles.restartButtonText}>
                {`↻ ${t('game.ui.restartRound', { locale })}`}
              </ThemedText>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.skipButton, isSkipping && styles.buttonDisabled]}
            onPress={confirmSkip}
            disabled={isRestarting || isSkipping}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('game.ui.skipRound', { locale })}
          >
            {isSkipping ? (
              <ActivityIndicator size="small" color={GameColors.neutral} />
            ) : (
              <ThemedText style={styles.skipButtonText}>
                {`⏭ ${t('game.ui.skipRound', { locale })}`}
              </ThemedText>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 22,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.2)',
    paddingTop: 10,
    width: '100%',
  },
  toggle: { fontSize: 12, opacity: 0.6 },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  button: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  restartButton: { borderColor: GameColors.purple },
  restartButtonText: { color: GameColors.purple, fontSize: 13, fontWeight: '600' },
  skipButton: { borderColor: GameColors.neutral },
  skipButtonText: { color: GameColors.neutral, fontSize: 13, fontWeight: '600' },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/expo && npx jest __tests__/AdminRoundTools.test.tsx`
Expected: PASS — all 6 tests.

- [ ] **Step 5: Create the web component**

Create `apps/web/src/components/game/AdminRoundTools.tsx`:

```tsx
import React, { useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAlert } from '../../hooks/useAlert';

interface Props {
  isAdmin: boolean;
  onRestart: () => Promise<void>;
  onSkip: () => Promise<void>;
}

export const AdminRoundTools: React.FC<Props> = ({ isAdmin, onRestart, onSkip }) => {
  const { t } = useLanguage();
  const { showAlert, AlertModal } = useAlert();
  const [expanded, setExpanded] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);

  if (!isAdmin) return null;

  const confirmRestart = () => {
    showAlert(
      t('game.alerts.restartRoundTitle'),
      t('game.alerts.restartRoundMessage'),
      [
        { text: t('common.cancel'), onPress: () => {}, style: 'secondary' },
        {
          text: t('game.ui.restartRound'),
          onPress: async () => {
            setIsRestarting(true);
            try {
              await onRestart();
            } finally {
              setIsRestarting(false);
            }
          },
          style: 'danger',
        },
      ],
    );
  };

  const confirmSkip = () => {
    showAlert(
      t('game.alerts.skipRoundTitle'),
      t('game.alerts.skipRoundMessage'),
      [
        { text: t('common.cancel'), onPress: () => {}, style: 'secondary' },
        {
          text: t('game.ui.skipRound'),
          onPress: async () => {
            setIsSkipping(true);
            try {
              await onSkip();
            } finally {
              setIsSkipping(false);
            }
          },
          style: 'primary',
        },
      ],
    );
  };

  return (
    <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700 flex flex-col items-center gap-2">
      {AlertModal}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        data-cy="admin-tools-toggle"
        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        {t('game.ui.adminTools')} {expanded ? '▴' : '▾'}
      </button>
      {expanded && (
        <div className="flex gap-2">
          <button
            type="button"
            data-cy="restart-round-button"
            onClick={confirmRestart}
            disabled={isRestarting || isSkipping}
            className="border border-game-purple text-game-purple px-4 py-1.5 rounded-full text-xs font-semibold hover:bg-game-purple hover:text-white disabled:opacity-50 transition-colors"
          >
            {isRestarting ? t('common.loading') : `↻ ${t('game.ui.restartRound')}`}
          </button>
          <button
            type="button"
            data-cy="skip-round-button"
            onClick={confirmSkip}
            disabled={isRestarting || isSkipping}
            className="border border-gray-400 text-gray-500 px-4 py-1.5 rounded-full text-xs font-semibold hover:bg-gray-400 hover:text-white disabled:opacity-50 transition-colors"
          >
            {isSkipping ? t('common.loading') : `⏭ ${t('game.ui.skipRound')}`}
          </button>
        </div>
      )}
    </div>
  );
};
```

- [ ] **Step 6: Verify the web component compiles**

Run: `cd apps/web && npx tsc --noEmit -p .`
Expected: no new errors vs. baseline (the new file itself must type-check cleanly).

- [ ] **Step 7: Commit**

```bash
git add apps/expo/components/game/AdminRoundTools.tsx apps/web/src/components/game/AdminRoundTools.tsx apps/expo/__tests__/AdminRoundTools.test.tsx
git commit -m "Add shared AdminRoundTools component (restart/skip round UI)"
```

---

### Task 7: Wire `AdminRoundTools` into Mirror's phase screens

**Files:**
- Modify: `apps/expo/components/game/mirror/ActivePhase.tsx`
- Modify: `apps/expo/components/game/mirror/GuessingPhase.tsx`
- Modify: `apps/web/src/components/game/mirror/ActivePhase.tsx`
- Modify: `apps/web/src/components/game/mirror/GuessingPhase.tsx`

**Interfaces:**
- Consumes: Task 1's `restartMirrorRound`/`skipMirrorRound`; Task 6's `AdminRoundTools`.

- [ ] **Step 1: Wire `apps/expo/components/game/mirror/ActivePhase.tsx`**

Add the import, alongside the existing `PostGuessingPointsPanel` import:

```tsx
import PostGuessingPointsPanel from './PostGuessingPointsPanel';
import { AdminRoundTools } from '@/components/game/AdminRoundTools';
```

In the `useGame()` destructure, add `restartMirrorRound, skipMirrorRound` to whatever's already being pulled out (find the line starting `const { loading, submitComment, ...`).

In the JSX, find the closing of the existing admin-controls block:

```tsx
                  <ThemedText style={styles.buttonText}>{t('game.ui.startGuessingPhase', { locale })}</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
          </ScrollIntoView>
        )}
```

Replace with (same content, plus the new component as a sibling right after, always rendered — it self-gates on `isAdmin`):

```tsx
                  <ThemedText style={styles.buttonText}>{t('game.ui.startGuessingPhase', { locale })}</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
          </ScrollIntoView>
        )}
        <AdminRoundTools
          isAdmin={isAdmin}
          locale={locale}
          showFancyAlert={showFancyAlert}
          onRestart={restartMirrorRound}
          onSkip={skipMirrorRound}
        />
```

- [ ] **Step 2: Wire `apps/expo/components/game/mirror/GuessingPhase.tsx`**

Add the import next to the existing `PostGuessingPointsPanel` import:

```tsx
import PostGuessingPointsPanel from './PostGuessingPointsPanel';
import { AdminRoundTools } from '@/components/game/AdminRoundTools';
```

In the `useGame()` destructure (`const { loading, submitGuess, markPlayerGuessesSubmitted, finalizeGuessingPhase, startNextRound } = useGame();`), add the two new functions:

```tsx
  const { loading, submitGuess, markPlayerGuessesSubmitted, finalizeGuessingPhase, startNextRound, restartMirrorRound, skipMirrorRound } = useGame();
```

In the JSX, find where the admin-controls `ScrollIntoView` block ends and `PostGuessingPointsPanel` begins:

```tsx
          </Animated.View>
          </ScrollIntoView>
        )}
      </View>

      {/* Post-Guessing Point Panel */}
      <PostGuessingPointsPanel
```

Replace with:

```tsx
          </Animated.View>
          </ScrollIntoView>
        )}
        <AdminRoundTools
          isAdmin={isAdmin}
          locale={locale}
          showFancyAlert={showFancyAlert}
          onRestart={restartMirrorRound}
          onSkip={skipMirrorRound}
        />
      </View>

      {/* Post-Guessing Point Panel */}
      <PostGuessingPointsPanel
```

- [ ] **Step 3: Wire `apps/web/src/components/game/mirror/ActivePhase.tsx`**

Add the import:

```tsx
import { AdminRoundTools } from '../AdminRoundTools';
```

In the `useGame()` destructure, add the two new functions:

```tsx
  const {
    loading,
    submitComment,
    showComments,
    awardCommentPoints,
    finishAwardingPoints,
    givePointsToTarget,
    startGuessingPhase,
    startNextRound,
    restartMirrorRound,
    skipMirrorRound,
  } = useGame();
```

In the JSX, find the closing of the admin-controls `<div>`:

```tsx
                {commentsVisible && (
                  <button
                    type="button"
                    onClick={handleStartGuessing}
                    disabled={loading || !targetFinishedPoints || !allPlayersCompletedPointsPhase}
                    data-cy="start-guessing-button"
                    className="bg-game-purple text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {loading ? t('common.loading') : t('game.ui.startGuessingPhase')}
                  </button>
                )}
              </div>
            </div>
          )}
```

Replace with:

```tsx
                {commentsVisible && (
                  <button
                    type="button"
                    onClick={handleStartGuessing}
                    disabled={loading || !targetFinishedPoints || !allPlayersCompletedPointsPhase}
                    data-cy="start-guessing-button"
                    className="bg-game-purple text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {loading ? t('common.loading') : t('game.ui.startGuessingPhase')}
                  </button>
                )}
              </div>
              <AdminRoundTools isAdmin={isAdmin} onRestart={restartMirrorRound} onSkip={skipMirrorRound} />
            </div>
          )}
```

- [ ] **Step 4: Wire `apps/web/src/components/game/mirror/GuessingPhase.tsx`**

Add the import:

```tsx
import { AdminRoundTools } from '../AdminRoundTools';
```

In the `useGame()` destructure, add the two new functions:

```tsx
  const { loading, submitGuess, markPlayerGuessesSubmitted, finalizeGuessingPhase, startNextRound, restartMirrorRound, skipMirrorRound } = useGame();
```

In the JSX, find the admin-controls block's closing `</div>`:

```tsx
              ) : (
                <button
                  type="button"
                  onClick={handleForceFinalize}
                  disabled={isFinalizing || loading}
                  data-cy="finalize-button"
                  className="bg-game-neutral text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isFinalizing ? t('common.loading') : t('game.ui.finalize')}
                </button>
              )}
            </div>
          )}
```

Replace with:

```tsx
              ) : (
                <button
                  type="button"
                  onClick={handleForceFinalize}
                  disabled={isFinalizing || loading}
                  data-cy="finalize-button"
                  className="bg-game-neutral text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isFinalizing ? t('common.loading') : t('game.ui.finalize')}
                </button>
              )}
              <AdminRoundTools isAdmin={isAdmin} onRestart={restartMirrorRound} onSkip={skipMirrorRound} />
            </div>
          )}
```

- [ ] **Step 5: Run the expo test suite for the touched files**

Run: `cd apps/expo && npx jest ActivePhase.test.tsx GuessingPhase.test.tsx`
Expected: PASS with the same pass/fail counts as before this task (no regressions) — these files call `useGame()` via a `jest.mock('@/contexts/GameContext', ...)` that doesn't include `restartMirrorRound`/`skipMirrorRound`, so those will be `undefined` when destructured; since `AdminRoundTools` is only invoked via a prop (`onRestart={undefined}`), and it's never *called* unless a button is pressed, this doesn't break existing tests. If any existing test explicitly asserts the exact shape of the destructured object, update it to include the two new keys as `jest.fn()` — check `ActivePhase.test.tsx`/`GuessingPhase.test.tsx`'s `jest.mock('@/contexts/GameContext', ...)` block for this exact pattern and add `restartMirrorRound: jest.fn().mockResolvedValue(undefined), skipMirrorRound: jest.fn().mockResolvedValue(undefined),` to the mocked return object if present.

- [ ] **Step 6: Verify web compiles**

Run: `cd apps/web && npx tsc --noEmit -p .` — expect no new errors vs. baseline.

- [ ] **Step 7: Commit**

```bash
git add apps/expo/components/game/mirror/ActivePhase.tsx apps/expo/components/game/mirror/GuessingPhase.tsx apps/web/src/components/game/mirror/ActivePhase.tsx apps/web/src/components/game/mirror/GuessingPhase.tsx
git commit -m "Wire Restart/Skip Round controls into Mirror mode"
```

---

### Task 8: Wire `AdminRoundTools` into Basket's phase screens

**Files:**
- Modify: `apps/expo/components/game/basket/BasketWritingPhase.tsx`
- Modify: `apps/expo/components/game/basket/BasketGuessingPhase.tsx`
- Modify: `apps/web/src/components/game/basket/BasketWritingPhase.tsx`
- Modify: `apps/web/src/components/game/basket/BasketGuessingPhase.tsx`

**Interfaces:**
- Consumes: Task 2's `restartBasketRound`/`skipBasketRound`; Task 6's `AdminRoundTools`.

- [ ] **Step 1: Wire `apps/expo/components/game/basket/BasketWritingPhase.tsx`**

Add the import next to the other `@/components/...` imports:

```tsx
import { AdminRoundTools } from '@/components/game/AdminRoundTools';
```

In the `useGame()` destructure (`const { submitBasketComment, revealBasketComments } = useGame();`), add the two new functions:

```tsx
  const { submitBasketComment, revealBasketComments, restartBasketRound, skipBasketRound } = useGame();
```

In the JSX, find the admin section's closing:

```tsx
              {isRevealing
                ? <ActivityIndicator size="small" color={GameColors.white} />
                : <IconSymbol name="eye.fill" size={16} color={GameColors.white} />}
              <ThemedText style={styles.wideButtonText}>{t('game.ui.basket.revealComments', { locale })}</ThemedText>
            </TouchableOpacity>
          </Animated.View>
          </ScrollIntoView>
        )}
```

Replace with:

```tsx
              {isRevealing
                ? <ActivityIndicator size="small" color={GameColors.white} />
                : <IconSymbol name="eye.fill" size={16} color={GameColors.white} />}
              <ThemedText style={styles.wideButtonText}>{t('game.ui.basket.revealComments', { locale })}</ThemedText>
            </TouchableOpacity>
          </Animated.View>
          </ScrollIntoView>
        )}
        <AdminRoundTools
          isAdmin={isAdmin}
          locale={locale}
          showFancyAlert={showFancyAlert}
          onRestart={restartBasketRound}
          onSkip={skipBasketRound}
        />
```

- [ ] **Step 2: Wire `apps/expo/components/game/basket/BasketGuessingPhase.tsx`**

Add the import:

```tsx
import { AdminRoundTools } from '@/components/game/AdminRoundTools';
```

In the `useGame()` destructure, add the two new functions:

```tsx
  const {
    submitBasketCommentGuess,
    submitBasketAuthorGuess,
    startNextBasketRound,
    restartBasketRound,
    skipBasketRound,
  } = useGame();
```

In the JSX, find the admin section's `TouchableOpacity` for "Next Round" and its closing tags (search for `t("game.ui.basket.nextRound"` and its enclosing `</Animated.View>\n          </ScrollIntoView>\n        )}`):

```tsx
              <ThemedText style={styles.wideButtonText}>{t("game.ui.basket.nextRound", { locale })}</ThemedText>
            </TouchableOpacity>
          </Animated.View>
          </ScrollIntoView>
        )}
```

Replace with:

```tsx
              <ThemedText style={styles.wideButtonText}>{t("game.ui.basket.nextRound", { locale })}</ThemedText>
            </TouchableOpacity>
          </Animated.View>
          </ScrollIntoView>
        )}
        <AdminRoundTools
          isAdmin={isAdmin}
          locale={locale}
          showFancyAlert={showFancyAlert}
          onRestart={restartBasketRound}
          onSkip={skipBasketRound}
        />
```

- [ ] **Step 3: Wire `apps/web/src/components/game/basket/BasketWritingPhase.tsx`**

Add the import:

```tsx
import { AdminRoundTools } from '../AdminRoundTools';
```

In the `useGame()` destructure, add the two new functions:

```tsx
  const { loading, submitBasketComment, revealBasketComments, restartBasketRound, skipBasketRound } = useGame();
```

In the JSX, find the admin section's closing `</div>`:

```tsx
            <button
              type="button"
              data-cy="basket-reveal-comments-button"
              onClick={handleReveal}
              disabled={isRevealing || loading || submittedCount < totalCount}
              className="bg-game-orange text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isRevealing ? t('common.loading') : t('game.ui.basket.revealComments')}
            </button>
          </div>
        )}
```

Replace with:

```tsx
            <button
              type="button"
              data-cy="basket-reveal-comments-button"
              onClick={handleReveal}
              disabled={isRevealing || loading || submittedCount < totalCount}
              className="bg-game-orange text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isRevealing ? t('common.loading') : t('game.ui.basket.revealComments')}
            </button>
            <AdminRoundTools isAdmin={isAdmin} onRestart={restartBasketRound} onSkip={skipBasketRound} />
          </div>
        )}
```

- [ ] **Step 4: Wire `apps/web/src/components/game/basket/BasketGuessingPhase.tsx`**

Add the import:

```tsx
import { AdminRoundTools } from '../AdminRoundTools';
```

In the `useGame()` destructure, add the two new functions:

```tsx
  const { loading, submitBasketCommentGuess, submitBasketAuthorGuess, startNextBasketRound, restartBasketRound, skipBasketRound } = useGame();
```

In the JSX, find the "Next Round" button's closing `</div>`:

```tsx
            <button
              type="button"
              data-cy="basket-next-round-button"
              onClick={handleNextRound}
              disabled={isAdvancing || loading || !allGuessersDone}
              className={`px-6 py-3 rounded-full text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity ${
                isLastRound ? 'bg-game-green' : 'bg-game-blue'
              }`}
            >
              {isAdvancing ? t('common.loading') : t('game.ui.basket.nextRound')}
            </button>
          </div>
        )}
```

Replace with:

```tsx
            <button
              type="button"
              data-cy="basket-next-round-button"
              onClick={handleNextRound}
              disabled={isAdvancing || loading || !allGuessersDone}
              className={`px-6 py-3 rounded-full text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity ${
                isLastRound ? 'bg-game-green' : 'bg-game-blue'
              }`}
            >
              {isAdvancing ? t('common.loading') : t('game.ui.basket.nextRound')}
            </button>
            <AdminRoundTools isAdmin={isAdmin} onRestart={restartBasketRound} onSkip={skipBasketRound} />
          </div>
        )}
```

- [ ] **Step 5: Run the expo test suite for the touched files**

Run: `cd apps/expo && npx jest BasketWritingPhase.test.tsx BasketGuessingPhase.test.tsx`
Expected: same pass/fail counts as the pre-existing baseline (recall `BasketGuessingPhase.test.tsx` already has 5 pre-existing unrelated failures from before this feature — confirmed via `git stash` diff earlier in this session; do not attempt to fix those as part of this task). If either file's `jest.mock('@/contexts/GameContext', ...)` block asserts an exact object shape, add `restartBasketRound: jest.fn().mockResolvedValue(undefined), skipBasketRound: jest.fn().mockResolvedValue(undefined),`.

- [ ] **Step 6: Verify web compiles**

Run: `cd apps/web && npx tsc --noEmit -p .` — expect no new errors vs. baseline.

- [ ] **Step 7: Commit**

```bash
git add apps/expo/components/game/basket/BasketWritingPhase.tsx apps/expo/components/game/basket/BasketGuessingPhase.tsx apps/web/src/components/game/basket/BasketWritingPhase.tsx apps/web/src/components/game/basket/BasketGuessingPhase.tsx
git commit -m "Wire Restart/Skip Round controls into Basket mode"
```

---

### Task 9: Wire `AdminRoundTools` into Clash's phase screens

**Files:**
- Modify: `apps/expo/components/game/clash/ClashWritingPhase.tsx`
- Modify: `apps/expo/components/game/clash/ClashGuessingPhase.tsx`
- Modify: `apps/web/src/components/game/clash/ClashWritingPhase.tsx`
- Modify: `apps/web/src/components/game/clash/ClashGuessingPhase.tsx`

**Interfaces:**
- Consumes: Task 3's `restartClashRound`/`skipClashRound`; Task 6's `AdminRoundTools`.

- [ ] **Step 1: Wire `apps/expo/components/game/clash/ClashWritingPhase.tsx`**

Add the import:

```tsx
import { AdminRoundTools } from '@/components/game/AdminRoundTools';
```

In the `useGame()` destructure (`const { submitClashComment, revealClashComments } = useGame();`):

```tsx
  const { submitClashComment, revealClashComments, restartClashRound, skipClashRound } = useGame();
```

In the JSX, find the admin section's closing (search for `t('game.ui.clash.revealComments'` and its enclosing block):

```tsx
              <ThemedText style={styles.wideButtonText}>{t('game.ui.clash.revealComments', { locale })}</ThemedText>
            </TouchableOpacity>
          </Animated.View>
          </ScrollIntoView>
        )}
```

Replace with:

```tsx
              <ThemedText style={styles.wideButtonText}>{t('game.ui.clash.revealComments', { locale })}</ThemedText>
            </TouchableOpacity>
          </Animated.View>
          </ScrollIntoView>
        )}
        <AdminRoundTools
          isAdmin={isAdmin}
          locale={locale}
          showFancyAlert={showFancyAlert}
          onRestart={restartClashRound}
          onSkip={skipClashRound}
        />
```

- [ ] **Step 2: Wire `apps/expo/components/game/clash/ClashGuessingPhase.tsx`**

Add the import:

```tsx
import { AdminRoundTools } from '@/components/game/AdminRoundTools';
```

In the `useGame()` destructure:

```tsx
  const { submitClashGuess, submitClashAuthorGuess, advanceClashGuessing, restartClashRound, skipClashRound } = useGame();
```

In the JSX, find the "advance" button's closing block:

```tsx
              <ThemedText style={styles.wideButtonText}>{advanceLabel}</ThemedText>
            </TouchableOpacity>
          </Animated.View>
          </ScrollIntoView>
        )}
```

Replace with:

```tsx
              <ThemedText style={styles.wideButtonText}>{advanceLabel}</ThemedText>
            </TouchableOpacity>
          </Animated.View>
          </ScrollIntoView>
        )}
        <AdminRoundTools
          isAdmin={isAdmin}
          locale={locale}
          showFancyAlert={showFancyAlert}
          onRestart={restartClashRound}
          onSkip={skipClashRound}
        />
```

- [ ] **Step 3: Wire `apps/web/src/components/game/clash/ClashWritingPhase.tsx`**

Add the import:

```tsx
import { AdminRoundTools } from '../AdminRoundTools';
```

In the `useGame()` destructure:

```tsx
  const { loading, submitClashComment, revealClashComments, restartClashRound, skipClashRound } = useGame();
```

In the JSX, find the admin section's closing `</div>`:

```tsx
            <button type="button" data-cy="clash-reveal-comments-button" onClick={handleReveal}
              disabled={isRevealing || loading || !allSubmitted}
              className="bg-game-orange text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
              {isRevealing ? t('common.loading') : t('game.ui.clash.revealComments')}
            </button>
          </div>
        )}
```

Replace with:

```tsx
            <button type="button" data-cy="clash-reveal-comments-button" onClick={handleReveal}
              disabled={isRevealing || loading || !allSubmitted}
              className="bg-game-orange text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
              {isRevealing ? t('common.loading') : t('game.ui.clash.revealComments')}
            </button>
            <AdminRoundTools isAdmin={isAdmin} onRestart={restartClashRound} onSkip={skipClashRound} />
          </div>
        )}
```

- [ ] **Step 4: Wire `apps/web/src/components/game/clash/ClashGuessingPhase.tsx`**

Add the import:

```tsx
import { AdminRoundTools } from '../AdminRoundTools';
```

In the `useGame()` destructure:

```tsx
  const { loading, submitClashGuess, submitClashAuthorGuess, advanceClashGuessing, restartClashRound, skipClashRound } = useGame();
```

In the JSX, find the "advance" button's closing `</div>`:

```tsx
            <button type="button" data-cy="clash-advance-button" onClick={handleAdvance}
              disabled={isAdvancing || loading || !currentGroupDone}
              className={`px-6 py-3 rounded-full text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity ${
                otherGroupDone && isLastRound ? 'bg-game-green' : 'bg-game-blue'
              }`}>
              {isAdvancing ? t('common.loading') : advanceLabel}
            </button>
          </div>
        )}
```

Replace with:

```tsx
            <button type="button" data-cy="clash-advance-button" onClick={handleAdvance}
              disabled={isAdvancing || loading || !currentGroupDone}
              className={`px-6 py-3 rounded-full text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity ${
                otherGroupDone && isLastRound ? 'bg-game-green' : 'bg-game-blue'
              }`}>
              {isAdvancing ? t('common.loading') : advanceLabel}
            </button>
            <AdminRoundTools isAdmin={isAdmin} onRestart={restartClashRound} onSkip={skipClashRound} />
          </div>
        )}
```

- [ ] **Step 5: Run the expo test suite for the touched files**

Run: `cd apps/expo && npx jest ClashWritingPhase.test.tsx ClashGuessingPhase.test.tsx`
Expected: same pass/fail counts as the pre-existing baseline (`ClashGuessingPhase.test.tsx` already has 4 pre-existing unrelated failures — confirmed earlier in this session; do not fix as part of this task). Add `restartClashRound: jest.fn().mockResolvedValue(undefined), skipClashRound: jest.fn().mockResolvedValue(undefined),` to either file's `jest.mock('@/contexts/GameContext', ...)` block if it asserts an exact shape.

- [ ] **Step 6: Verify web compiles**

Run: `cd apps/web && npx tsc --noEmit -p .` — expect no new errors vs. baseline.

- [ ] **Step 7: Commit**

```bash
git add apps/expo/components/game/clash/ClashWritingPhase.tsx apps/expo/components/game/clash/ClashGuessingPhase.tsx apps/web/src/components/game/clash/ClashWritingPhase.tsx apps/web/src/components/game/clash/ClashGuessingPhase.tsx
git commit -m "Wire Restart/Skip Round controls into Clash mode"
```

---

### Task 10: Wire `AdminRoundTools` into Group Ideas' phase screens

**Files:**
- Modify: `apps/expo/components/game/ideas/IdeaWritingPhase.tsx`
- Modify: `apps/expo/components/game/ideas/IdeaRatingPhase.tsx`
- Modify: `apps/web/src/components/game/ideas/IdeaWritingPhase.tsx`
- Modify: `apps/web/src/components/game/ideas/IdeaRatingPhase.tsx`

**Interfaces:**
- Consumes: Task 4's `restartIdeaRound`/`skipIdeaRound`; Task 6's `AdminRoundTools`.

- [ ] **Step 1: Wire `apps/expo/components/game/ideas/IdeaWritingPhase.tsx`**

Add the import:

```tsx
import { AdminRoundTools } from '@/components/game/AdminRoundTools';
```

In the `useGame()` destructure (`const { submitIdea, startIdeaRatingRounds } = useGame();`):

```tsx
  const { submitIdea, startIdeaRatingRounds, restartIdeaRound, skipIdeaRound } = useGame();
```

In the JSX, find the admin section's closing:

```tsx
            {isStarting
              ? <ActivityIndicator size="small" color={GameColors.white} />
              : <IconSymbol name="star.fill" size={16} color={GameColors.white} />}
            <ThemedText style={styles.wideButtonText}>{t('game.ui.ideas.startRating', { locale })}</ThemedText>
          </TouchableOpacity>
        </View>
      )}
```

Replace with:

```tsx
            {isStarting
              ? <ActivityIndicator size="small" color={GameColors.white} />
              : <IconSymbol name="star.fill" size={16} color={GameColors.white} />}
            <ThemedText style={styles.wideButtonText}>{t('game.ui.ideas.startRating', { locale })}</ThemedText>
          </TouchableOpacity>
        </View>
      )}
      <AdminRoundTools
        isAdmin={isAdmin}
        locale={locale}
        showFancyAlert={showFancyAlert}
        onRestart={restartIdeaRound}
        onSkip={skipIdeaRound}
      />
```

Note: unlike the other three modes' writing-phase files, `IdeaWritingPhase.tsx`'s admin block isn't wrapped in a `ScrollIntoView`, so this insertion sits one level shallower — verify against the actual file before applying (the `isAdmin && (...)` block here is a plain `View`, per Task-gathering research: `{isAdmin && (<View style={styles.adminSection}>...</View>)}`).

- [ ] **Step 2: Wire `apps/expo/components/game/ideas/IdeaRatingPhase.tsx`**

Add the import:

```tsx
import { AdminRoundTools } from '@/components/game/AdminRoundTools';
```

In the `useGame()` destructure (`const { submitIdeaRating, startNextIdeaRound } = useGame();`):

```tsx
  const { submitIdeaRating, startNextIdeaRound, restartIdeaRound, skipIdeaRound } = useGame();
```

In the JSX, find the "Next Round" button's closing:

```tsx
            {isAdvancing
              ? <ActivityIndicator size="small" color={GameColors.white} />
              : <IconSymbol name={isLastRound ? 'flag.checkered' : 'forward.end.fill'} size={16} color={GameColors.white} />}
            <ThemedText style={styles.wideButtonText}>{t('game.ui.ideas.nextRound', { locale })}</ThemedText>
          </TouchableOpacity>
        </View>
      )}
```

Replace with:

```tsx
            {isAdvancing
              ? <ActivityIndicator size="small" color={GameColors.white} />
              : <IconSymbol name={isLastRound ? 'flag.checkered' : 'forward.end.fill'} size={16} color={GameColors.white} />}
            <ThemedText style={styles.wideButtonText}>{t('game.ui.ideas.nextRound', { locale })}</ThemedText>
          </TouchableOpacity>
        </View>
      )}
      <AdminRoundTools
        isAdmin={isAdmin}
        locale={locale}
        showFancyAlert={showFancyAlert}
        onRestart={restartIdeaRound}
        onSkip={skipIdeaRound}
      />
```

- [ ] **Step 3: Wire `apps/web/src/components/game/ideas/IdeaWritingPhase.tsx`**

Add the import:

```tsx
import { AdminRoundTools } from '../AdminRoundTools';
```

In the `useGame()` destructure:

```tsx
  const { loading, submitIdea, startIdeaRatingRounds, restartIdeaRound, skipIdeaRound } = useGame();
```

In the JSX, find the admin section's closing `</div>`:

```tsx
            <button
              type="button"
              onClick={handleStartRating}
              disabled={isStarting || loading || !allSubmitted}
              data-cy="start-rating-rounds-button"
              className="bg-game-orange text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isStarting ? t('common.loading') : t('game.ui.ideas.startRating')}
            </button>
          </div>
        )}
```

Replace with:

```tsx
            <button
              type="button"
              onClick={handleStartRating}
              disabled={isStarting || loading || !allSubmitted}
              data-cy="start-rating-rounds-button"
              className="bg-game-orange text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isStarting ? t('common.loading') : t('game.ui.ideas.startRating')}
            </button>
            <AdminRoundTools isAdmin={isAdmin} onRestart={restartIdeaRound} onSkip={skipIdeaRound} />
          </div>
        )}
```

- [ ] **Step 4: Wire `apps/web/src/components/game/ideas/IdeaRatingPhase.tsx`**

Add the import:

```tsx
import { AdminRoundTools } from '../AdminRoundTools';
```

In the `useGame()` destructure:

```tsx
  const { loading, submitIdeaRating, startNextIdeaRound, restartIdeaRound, skipIdeaRound } = useGame();
```

In the JSX, find the "Next Round" button's closing `</div>`:

```tsx
            <button
              type="button"
              onClick={handleNextRound}
              disabled={isAdvancing || loading || !allRatersDone}
              data-cy="next-idea-round-button"
              className={`px-6 py-3 rounded-full text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity ${
                isLastRound ? 'bg-game-green' : 'bg-game-blue'
              }`}
            >
              {isAdvancing ? t('common.loading') : t('game.ui.ideas.nextRound')}
            </button>
          </div>
        )}
```

Replace with:

```tsx
            <button
              type="button"
              onClick={handleNextRound}
              disabled={isAdvancing || loading || !allRatersDone}
              data-cy="next-idea-round-button"
              className={`px-6 py-3 rounded-full text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity ${
                isLastRound ? 'bg-game-green' : 'bg-game-blue'
              }`}
            >
              {isAdvancing ? t('common.loading') : t('game.ui.ideas.nextRound')}
            </button>
            <AdminRoundTools isAdmin={isAdmin} onRestart={restartIdeaRound} onSkip={skipIdeaRound} />
          </div>
        )}
```

- [ ] **Step 5: Run the expo test suite for the touched files**

Run: `cd apps/expo && npx jest IdeaWritingPhase.test.tsx IdeaRatingPhase.test.tsx`
Expected: same pass/fail counts as the pre-existing baseline. Add `restartIdeaRound: jest.fn().mockResolvedValue(undefined), skipIdeaRound: jest.fn().mockResolvedValue(undefined),` to either file's `jest.mock('@/contexts/GameContext', ...)` block if it asserts an exact shape.

- [ ] **Step 6: Verify web compiles**

Run: `cd apps/web && npx tsc --noEmit -p .` — expect no new errors vs. baseline.

- [ ] **Step 7: Run the full expo suite once more, end to end**

Run: `cd apps/expo && npx jest`
Expected: identical failing-suite set to the pre-feature baseline (use `git stash` + rerun + `git stash pop` to diff if unsure — this is the same verification technique used for the earlier concurrency-fix work this session), plus every new test added across Tasks 1-10 passing.

- [ ] **Step 8: Commit**

```bash
git add apps/expo/components/game/ideas/IdeaWritingPhase.tsx apps/expo/components/game/ideas/IdeaRatingPhase.tsx apps/web/src/components/game/ideas/IdeaWritingPhase.tsx apps/web/src/components/game/ideas/IdeaRatingPhase.tsx
git commit -m "Wire Restart/Skip Round controls into Group Ideas mode"
```
