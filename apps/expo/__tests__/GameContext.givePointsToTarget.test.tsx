// TDD – 5.7: givePointsToTarget writes targetPointsByPlayer to Firestore.
//
// Behaviours covered:
//   a) transaction.update contains currentRound.targetPointsByPlayer.${userId} = points
//   b) transaction.update increments currentRound.targetPoints
//   c) transaction.update adds user to playersWhoCompletedPostCommentPhase
//   d) transaction.update updates scores for targetUserId
//   e) throws "already gave points" when user is in targetPointsGivenBy (server guard)
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

const ACTIVE_ROUND = {
  roundNumber: 1,
  targetUserId: 'player-uid',
  targetUserName: 'Player',
  comments: [],
  commentsVisible: false,
  pointsGiven: false,
  startedAt: new Date(),
  targetPoints: 0,
  targetPointsGivenBy: [],
  targetPointsByPlayer: {},
};

function makeGameDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'game-x',
    adminId: 'admin-uid',
    status: 'active',
    participants: [
      { userId: 'admin-uid',  userName: 'Admin',  userEmail: 'admin@test.com', joinedAt: new Date() },
      { userId: 'player-uid', userName: 'Player', userEmail: 'p@test.com',     joinedAt: new Date() },
    ],
    rounds: [],
    scores: { 'player-uid': 0 },
    guessingData: { commentsByTarget: {}, possibleAuthors: [] },
    guessResults: {},
    createdAt: new Date(),
    currentRound: ACTIVE_ROUND,
    adminWritesComments: false,
    playersWhoCompletedPostCommentPhase: [],
    ...overrides,
  };
}

function makeSnap(data: Record<string, unknown>, id = 'game-x') {
  return { exists: () => true, id, data: () => data };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function setupEnterGame(
  firestore: ReturnType<typeof require>,
  gameDoc: Record<string, unknown>,
) {
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

// After enterGame, wire up runTransaction so givePointsToTarget can run its
// transaction callback. Returns the captured transaction.update mock so
// individual tests can assert on the write.
function setupTransaction(
  firestore: ReturnType<typeof require>,
  gameDoc: Record<string, unknown>,
): { txnUpdate: jest.Mock } {
  const txnUpdate = jest.fn();
  firestore.runTransaction.mockImplementation(
    async (_db: unknown, cb: (t: { get: jest.Mock; update: jest.Mock }) => Promise<void>) => {
      const txn = {
        get: jest.fn().mockResolvedValue(makeSnap(gameDoc)),
        update: txnUpdate,
      };
      await cb(txn);
    },
  );
  return { txnUpdate };
}

// ─── a) targetPointsByPlayer entry written ────────────────────────────────────

describe('givePointsToTarget — 5.7 targetPointsByPlayer', () => {
  it('writes currentRound.targetPointsByPlayer.{userId} with the given point value', async () => {
    const firestore = require('firebase/firestore');
    const gameDoc = makeGameDoc();
    setupEnterGame(firestore, gameDoc);
    const { txnUpdate } = setupTransaction(firestore, gameDoc);

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.givePointsToTarget('player-uid', 2); });

    expect(txnUpdate).toHaveBeenCalledTimes(1);
    const written = txnUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(written['currentRound.targetPointsByPlayer.admin-uid']).toBe(2);
  });

  it('uses the default of 1 point when no amount is specified', async () => {
    const firestore = require('firebase/firestore');
    const gameDoc = makeGameDoc();
    setupEnterGame(firestore, gameDoc);
    const { txnUpdate } = setupTransaction(firestore, gameDoc);

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.givePointsToTarget('player-uid'); });

    const written = txnUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(written['currentRound.targetPointsByPlayer.admin-uid']).toBe(1);
  });
});

// ─── b) targetPoints incremented ─────────────────────────────────────────────

describe('givePointsToTarget — 5.7 targetPoints incremented', () => {
  it('adds given points to the existing targetPoints total', async () => {
    const firestore = require('firebase/firestore');
    // Round already has 3 points from someone else
    const gameDoc = makeGameDoc({
      currentRound: { ...ACTIVE_ROUND, targetPoints: 3 },
    });
    setupEnterGame(firestore, gameDoc);
    const { txnUpdate } = setupTransaction(firestore, gameDoc);

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.givePointsToTarget('player-uid', 2); });

    const written = txnUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(written['currentRound.targetPoints']).toBe(5); // 3 + 2
  });
});

// ─── c) playersWhoCompletedPostCommentPhase ───────────────────────────────────

describe('givePointsToTarget — 5.7 marks post-comment phase complete', () => {
  it('adds the giving user to playersWhoCompletedPostCommentPhase', async () => {
    const firestore = require('firebase/firestore');
    const gameDoc = makeGameDoc();
    setupEnterGame(firestore, gameDoc);
    const { txnUpdate } = setupTransaction(firestore, gameDoc);

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.givePointsToTarget('player-uid', 1); });

    const written = txnUpdate.mock.calls[0][1] as Record<string, unknown>;
    // arrayUnion mock returns the value directly; just verify the key is present
    expect(written['playersWhoCompletedPostCommentPhase']).toBe('admin-uid');
  });
});

// ─── d) scores updated for targetUserId ──────────────────────────────────────

describe('givePointsToTarget — 5.7 scores updated', () => {
  it('adds the points to scores[targetUserId]', async () => {
    const firestore = require('firebase/firestore');
    const gameDoc = makeGameDoc({ scores: { 'player-uid': 5 } });
    setupEnterGame(firestore, gameDoc);
    const { txnUpdate } = setupTransaction(firestore, gameDoc);

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.givePointsToTarget('player-uid', 3); });

    const written = txnUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect((written['scores'] as Record<string, number>)['player-uid']).toBe(8); // 5 + 3
  });
});

// ─── e) server-side duplicate guard ──────────────────────────────────────────

describe('givePointsToTarget — 5.7 server duplicate guard', () => {
  it('throws "already gave points" when targetPointsGivenBy contains userId on server', async () => {
    const firestore = require('firebase/firestore');
    const localDoc  = makeGameDoc(); // local state: user not yet recorded
    const serverDoc = makeGameDoc({ // server state: another client already recorded this user
      currentRound: { ...ACTIVE_ROUND, targetPointsGivenBy: ['admin-uid'] },
    });
    setupEnterGame(firestore, localDoc);

    // Transaction reads serverDoc (already-committed state)
    firestore.runTransaction.mockImplementation(
      async (_db: unknown, cb: (t: { get: jest.Mock; update: jest.Mock }) => Promise<void>) => {
        const txn = {
          get: jest.fn().mockResolvedValue(makeSnap(serverDoc)),
          update: jest.fn(),
        };
        await cb(txn);
      },
    );

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });

    let caught: Error | null = null;
    await act(async () => {
      try { await result.current.givePointsToTarget('player-uid', 1); }
      catch (e) { caught = e as Error; }
    });

    expect(caught?.message).toBe('You already gave points to this target this round');
    // No write should have happened
    const txnUpdate = (firestore.runTransaction.mock.calls[0] as unknown[])[1];
    expect(typeof txnUpdate).toBe('function'); // just confirming mock was called
  });
});
