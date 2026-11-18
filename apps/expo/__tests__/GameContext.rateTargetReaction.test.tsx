// rateTargetReaction writes a per-voter 0/1 rating of the target's reaction
// to the currently active comment, replacing the old round-level
// givePointsToTarget one-shot vote.
//
// Behaviours covered:
//   a) transaction.update writes the voter's entry into the active
//      comment's targetReactionPoints
//   b) transaction.update increments currentRound.targetPoints
//   c) transaction.update adds the voter to currentRound.targetPointsGivenBy
//   d) transaction.update updates scores for targetUserId
//   e) throws "already rated" when the server's active comment already has
//      this voter's entry (server guard)
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

const ACTIVE_COMMENT = {
  id: 'c1',
  authorId: 'admin-uid',
  text: 'A comment about the target',
  submittedAt: new Date(),
  points: 1,
  targetReactionPoints: {},
};

const ACTIVE_ROUND = {
  roundNumber: 1,
  targetUserId: 'player-uid',
  targetUserName: 'Player',
  comments: [ACTIVE_COMMENT],
  commentsVisible: true,
  pointsGiven: false,
  startedAt: new Date(),
  activeCommentIndex: 0,
  targetPoints: 0,
  targetPointsGivenBy: [],
  targetPointsByPlayer: {},
};

function makeGameDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'game-x',
    adminId: 'admin-uid',
    status: 'active',
    // adminWritesComments: true — makes the admin a required participant
    // (and here, the test's only non-target voter, since useAuth is
    // mocked to always return admin-uid).
    adminWritesComments: true,
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

// After enterGame, wire up runTransaction so rateTargetReaction can run its
// transaction callback against `serverGameDoc`. Returns the captured
// transaction.update mock so individual tests can assert on the write.
function setupTransaction(
  firestore: ReturnType<typeof require>,
  serverGameDoc: Record<string, unknown>,
): { txnUpdate: jest.Mock } {
  const txnUpdate = jest.fn();
  firestore.runTransaction.mockImplementation(
    async (_db: unknown, cb: (t: { get: jest.Mock; update: jest.Mock }) => Promise<void>) => {
      const txn = {
        get: jest.fn().mockResolvedValue(makeSnap(serverGameDoc)),
        update: txnUpdate,
      };
      await cb(txn);
    },
  );
  return { txnUpdate };
}

// ─── a) targetReactionPoints entry written on the active comment ────────────

describe('rateTargetReaction — targetReactionPoints', () => {
  it("writes the voter's entry into the active comment's targetReactionPoints", async () => {
    const firestore = require('firebase/firestore');
    const gameDoc = makeGameDoc();
    setupEnterGame(firestore, gameDoc);
    const { txnUpdate } = setupTransaction(firestore, gameDoc);

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.rateTargetReaction('c1', 1); });

    expect(txnUpdate).toHaveBeenCalledTimes(1);
    const written = txnUpdate.mock.calls[0][1] as Record<string, unknown>;
    const comments = written['currentRound.comments'] as Array<Record<string, unknown>>;
    const comment = comments.find((c) => c.id === 'c1')!;
    expect((comment.targetReactionPoints as Record<string, number>)['admin-uid']).toBe(1);
  });
});

// ─── b) targetPoints incremented ─────────────────────────────────────────────

describe('rateTargetReaction — targetPoints incremented', () => {
  it('adds the rating to the existing targetPoints total', async () => {
    const firestore = require('firebase/firestore');
    // Round already has 3 points from an earlier comment's votes
    const gameDoc = makeGameDoc({
      currentRound: { ...ACTIVE_ROUND, targetPoints: 3 },
    });
    setupEnterGame(firestore, gameDoc);
    const { txnUpdate } = setupTransaction(firestore, gameDoc);

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.rateTargetReaction('c1', 1); });

    const written = txnUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(written['currentRound.targetPoints']).toBe(4); // 3 + 1
  });
});

// ─── c) targetPointsGivenBy ──────────────────────────────────────────────────

describe('rateTargetReaction — marks voter in targetPointsGivenBy', () => {
  it('adds the voting user to currentRound.targetPointsGivenBy', async () => {
    const firestore = require('firebase/firestore');
    const gameDoc = makeGameDoc();
    setupEnterGame(firestore, gameDoc);
    const { txnUpdate } = setupTransaction(firestore, gameDoc);

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.rateTargetReaction('c1', 1); });

    const written = txnUpdate.mock.calls[0][1] as Record<string, unknown>;
    // arrayUnion mock returns the value directly; just verify the key is present
    expect(written['currentRound.targetPointsGivenBy']).toBe('admin-uid');
  });
});

// ─── d) scores updated for targetUserId ──────────────────────────────────────

describe('rateTargetReaction — scores updated', () => {
  it('adds the points to scores[targetUserId]', async () => {
    const firestore = require('firebase/firestore');
    const gameDoc = makeGameDoc({ scores: { 'player-uid': 5 } });
    setupEnterGame(firestore, gameDoc);
    const { txnUpdate } = setupTransaction(firestore, gameDoc);

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.rateTargetReaction('c1', 1); });

    const written = txnUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(written['scores.player-uid']).toBe(6); // 5 + 1
  });
});

// ─── e) server-side duplicate guard ──────────────────────────────────────────

describe('rateTargetReaction — server duplicate guard', () => {
  it('throws "already rated" when the active comment already has this voter on the server', async () => {
    const firestore = require('firebase/firestore');
    const localDoc = makeGameDoc(); // local state: user not yet recorded
    const serverDoc = makeGameDoc({ // server state: another client already recorded this user
      currentRound: {
        ...ACTIVE_ROUND,
        comments: [{ ...ACTIVE_COMMENT, targetReactionPoints: { 'admin-uid': 1 } }],
      },
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
      try { await result.current.rateTargetReaction('c1', 1); }
      catch (e) { caught = e as Error; }
    });

    expect(caught?.message).toBe('You already rated this comment');
  });
});
