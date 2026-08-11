/**
 * Edge-case tests for GameContext:
 *   - startGame with fewer than 2 participants
 *   - Duplicate comment submission (concurrent-submission guard)
 *   - Admin leaving a mid-game (marks finished, clears local state)
 *   - Non-admin leaving (does NOT set adminLeft / finished)
 */
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

// ─── shared fixtures ──────────────────────────────────────────────────────────

const ADMIN = { userId: 'admin-uid', userName: 'Admin', userEmail: 'admin@test.com', joinedAt: new Date() };
const PLAYER = { userId: 'player-uid', userName: 'Player', userEmail: 'player@test.com', joinedAt: new Date() };

function makeGameDoc(overrides: Record<string, unknown> = {}) {
  return {
    adminId: 'admin-uid',
    adminName: 'Admin',
    adminEmail: 'admin@test.com',
    status: 'waiting',
    participants: [ADMIN, PLAYER],
    rounds: [],
    scores: {},
    guessingData: { commentsByTarget: {}, possibleAuthors: [], playersWhoSubmittedGuesses: [], allPlayersSubmitted: false },
    guessResults: {},
    createdAt: new Date(),
    currentRound: null,
    ...overrides,
  };
}

function makeSnap(data: Record<string, unknown>, id = 'game-x') {
  return { exists: () => true, id, data: () => data };
}

const ACTIVE_ROUND = {
  roundNumber: 1,
  targetUserId: 'player-uid',
  targetUserName: 'Player',
  comments: [],
  commentsVisible: false,
  pointsGiven: false,
  startedAt: new Date(),
};

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <GameProvider>{children}</GameProvider>
);

// ─── common per-suite setup helpers ──────────────────────────────────────────

function setupEnterGameMocks(firestore: ReturnType<typeof require>, gameDoc: Record<string, unknown>) {
  firestore.doc.mockReturnValue({ path: 'games/game-x' });
  firestore.setDoc.mockResolvedValue(undefined);
  firestore.updateDoc.mockResolvedValue(undefined);
  firestore.serverTimestamp.mockReturnValue(new Date());
  firestore.arrayUnion.mockImplementation((v: unknown) => v);
  firestore.onSnapshot.mockReturnValue(jest.fn()); // default for re-subscriptions

  firestore.getDoc
    .mockResolvedValueOnce({ exists: () => true, data: () => ({ password: 'SECRET' }) }) // password
    .mockResolvedValueOnce({ exists: () => false }); // uniqueness

  firestore.onSnapshot.mockImplementationOnce((_ref: unknown, cb: (s: unknown) => void) => {
    cb(makeSnap(gameDoc));
    return jest.fn();
  });
}

// ─── 1. startGame — too few participants ──────────────────────────────────────

describe('startGame — fewer than 2 participants', () => {
  beforeEach(() => {
    const firestore = require('firebase/firestore');
    setupEnterGameMocks(firestore, makeGameDoc({
      participants: [ADMIN], // admin only, no players
    }));
  });

  it('throws when admin is the only participant', async () => {
    const { result } = renderHook(() => useGame(), { wrapper });

    await act(async () => { await result.current.enterGame('SECRET'); });
    expect(result.current.currentGame?.participants).toHaveLength(1);

    let caught: Error | null = null;
    await act(async () => {
      try { await result.current.startGame(); }
      catch (e) { caught = e as Error; }
    });

    expect(caught?.message).toBe('Need at least 2 participants to start the game');
  });

  it('does not write to Firestore when start is rejected', async () => {
    const firestore = require('firebase/firestore');
    const { result } = renderHook(() => useGame(), { wrapper });

    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => {
      try { await result.current.startGame(); } catch (_) {}
    });

    // updateDoc should NOT have been called for status:'active'
    const statusWrites = firestore.updateDoc.mock.calls.filter(
      (call: unknown[]) => (call[1] as Record<string, unknown>).status === 'active',
    );
    expect(statusWrites).toHaveLength(0);
  });
});

// ─── 2. submitComment — duplicate submission guard ────────────────────────────

describe('submitComment — duplicate submission guard', () => {
  const EXISTING_COMMENT = {
    id: 'c0',
    authorId: 'admin-uid',
    text: 'First comment',
    submittedAt: new Date(),
  };

  const gameWithComment = makeGameDoc({
    status: 'active',
    currentRound: { ...ACTIVE_ROUND, comments: [EXISTING_COMMENT] },
  });

  beforeEach(() => {
    const firestore = require('firebase/firestore');

    firestore.doc.mockReturnValue({ path: 'games/game-x' });
    firestore.setDoc.mockResolvedValue(undefined);
    firestore.updateDoc.mockResolvedValue(undefined);
    firestore.serverTimestamp.mockReturnValue(new Date());
    firestore.arrayUnion.mockImplementation((v: unknown) => v);
    firestore.onSnapshot.mockReturnValue(jest.fn());

    // getDoc: password check, uniqueness check
    firestore.getDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ password: 'SECRET' }) })
      .mockResolvedValueOnce({ exists: () => false });

    // Initial snapshot: active game with admin's existing comment
    firestore.onSnapshot.mockImplementationOnce((_ref: unknown, cb: (s: unknown) => void) => {
      cb(makeSnap(gameWithComment));
      return jest.fn();
    });

    // runTransaction: txn.get returns the round that already has admin's comment
    firestore.runTransaction.mockImplementation(async (_db: unknown, cb: (t: { get: jest.Mock; update: jest.Mock }) => Promise<void>) => {
      const txn = {
        get: jest.fn().mockResolvedValue(makeSnap(gameWithComment)),
        update: jest.fn(),
      };
      await cb(txn);
    });
  });

  it('throws when the same author tries to submit a second comment', async () => {
    const { result } = renderHook(() => useGame(), { wrapper });

    await act(async () => { await result.current.enterGame('SECRET'); });

    let caught: Error | null = null;
    await act(async () => {
      try { await result.current.submitComment('Trying again'); }
      catch (e) { caught = e as Error; }
    });

    expect(caught?.message).toBe('You have already submitted a comment for this round');
  });

  it('does not write the duplicate comment to Firestore', async () => {
    const firestore = require('firebase/firestore');
    const { result } = renderHook(() => useGame(), { wrapper });

    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => {
      try { await result.current.submitComment('Trying again'); } catch (_) {}
    });

    const commentWrites = firestore.updateDoc.mock.calls.filter(
      (call: unknown[]) => JSON.stringify(call[1]).includes('currentRound.comments'),
    );
    expect(commentWrites).toHaveLength(0);
  });
});

// ─── 3. leaveGame — admin leaves mid-game ────────────────────────────────────

describe('leaveGame — admin abandons an active game', () => {
  const mockTxn = { get: jest.fn(), update: jest.fn() };

  const activeGame = makeGameDoc({
    status: 'active',
    currentRound: ACTIVE_ROUND,
    adminNextTargetPreference: 'player-uid',
  });

  beforeEach(() => {
    const firestore = require('firebase/firestore');
    setupEnterGameMocks(firestore, activeGame);

    // runTransaction executes the callback immediately with our mock txn object
    mockTxn.get.mockResolvedValue(makeSnap(activeGame));
    mockTxn.update.mockImplementation(() => {});
    firestore.runTransaction.mockImplementation(async (_db: unknown, cb: (t: typeof mockTxn) => Promise<void>) => {
      await cb(mockTxn);
    });
  });

  it('marks the game as finished with adminLeft:true in the transaction', async () => {
    const { result } = renderHook(() => useGame(), { wrapper });

    await act(async () => { await result.current.enterGame('SECRET'); });
    expect(result.current.currentGame).not.toBeNull();

    await act(async () => { await result.current.leaveGame(); });

    expect(mockTxn.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'finished', adminLeft: true }),
    );
  });

  it('clears adminNextTargetPreference when admin leaves', async () => {
    const { result } = renderHook(() => useGame(), { wrapper });

    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.leaveGame(); });

    expect(mockTxn.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ adminNextTargetPreference: null }),
    );
  });

  it('clears currentGame locally after admin leaves', async () => {
    const { result } = renderHook(() => useGame(), { wrapper });

    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.leaveGame(); });

    expect(result.current.currentGame).toBeNull();
  });
});

// ─── 4. leaveGame — non-admin leaves ─────────────────────────────────────────

describe('leaveGame — non-admin participant leaves', () => {
  const mockTxn = { get: jest.fn(), update: jest.fn() };

  // Game whose adminId is a DIFFERENT user, so the acting user (admin-uid) is a regular participant
  const gameWithOtherAdmin = makeGameDoc({
    adminId: 'other-admin',
    status: 'active',
    participants: [
      PLAYER,
      { userId: 'other-admin', userName: 'OtherAdmin', userEmail: 'o@t.com', joinedAt: new Date() },
      ADMIN, // admin-uid is just a regular participant here
    ],
  });

  beforeEach(() => {
    const firestore = require('firebase/firestore');
    setupEnterGameMocks(firestore, gameWithOtherAdmin);

    mockTxn.get.mockResolvedValue(makeSnap(gameWithOtherAdmin));
    mockTxn.update.mockImplementation(() => {});
    firestore.runTransaction.mockImplementation(async (_db: unknown, cb: (t: typeof mockTxn) => Promise<void>) => {
      await cb(mockTxn);
    });
  });

  it('does not set adminLeft or finished when a non-admin leaves', async () => {
    const { result } = renderHook(() => useGame(), { wrapper });

    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.leaveGame(); });

    const updateArg = mockTxn.update.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(updateArg.adminLeft).toBeUndefined();
    expect(updateArg.status).toBeUndefined();
  });

  it('clears currentGame locally after non-admin leaves', async () => {
    const { result } = renderHook(() => useGame(), { wrapper });

    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.leaveGame(); });

    expect(result.current.currentGame).toBeNull();
  });
});

// ─── 5. submitComment — uses runTransaction ───────────────────────────────────

describe('submitComment — uses runTransaction to prevent concurrent comment loss', () => {
  const mockTxn = { get: jest.fn(), update: jest.fn() };

  const activeGameDoc = makeGameDoc({
    status: 'active',
    currentRound: ACTIVE_ROUND,
  });

  beforeEach(() => {
    const firestore = require('firebase/firestore');

    firestore.doc.mockReturnValue({ path: 'games/game-x' });
    firestore.setDoc.mockResolvedValue(undefined);
    firestore.updateDoc.mockResolvedValue(undefined);
    firestore.serverTimestamp.mockReturnValue(new Date());
    firestore.arrayUnion.mockImplementation((v: unknown) => v);
    firestore.onSnapshot.mockReturnValue(jest.fn());

    // getDoc: password, uniqueness, then fallback for current getDoc-based impl
    firestore.getDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ password: 'SECRET' }) })
      .mockResolvedValueOnce({ exists: () => false })
      .mockResolvedValue(makeSnap(activeGameDoc));

    firestore.onSnapshot.mockImplementationOnce((_ref: unknown, cb: (s: unknown) => void) => {
      cb(makeSnap(activeGameDoc));
      return jest.fn();
    });

    // runTransaction executes the callback with the mock transaction object
    mockTxn.get.mockResolvedValue(makeSnap(activeGameDoc));
    mockTxn.update.mockImplementation(() => {});
    firestore.runTransaction.mockImplementation(async (_db: unknown, cb: (t: typeof mockTxn) => Promise<void>) => {
      await cb(mockTxn);
    });
  });

  it('calls runTransaction when submitting a comment', async () => {
    const firestore = require('firebase/firestore');
    const { result } = renderHook(() => useGame(), { wrapper });

    await act(async () => { await result.current.enterGame('SECRET'); });
    firestore.runTransaction.mockClear();

    await act(async () => { await result.current.submitComment('Hello there'); });

    expect(firestore.runTransaction).toHaveBeenCalled();
  });

  it('appends the new comment via txn.update inside the transaction', async () => {
    const { result } = renderHook(() => useGame(), { wrapper });

    await act(async () => { await result.current.enterGame('SECRET'); });
    mockTxn.update.mockClear();

    await act(async () => { await result.current.submitComment('Hello there'); });

    expect(mockTxn.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        'currentRound.comments': expect.arrayContaining([
          expect.objectContaining({ text: 'Hello there' }),
        ]),
      }),
    );
  });
});

// ─── 6. givePointsToTarget — uses runTransaction ──────────────────────────────

describe('givePointsToTarget — uses runTransaction to prevent concurrent point loss', () => {
  const mockTxn = { get: jest.fn(), update: jest.fn() };

  const activeGameDoc = makeGameDoc({
    status: 'active',
    currentRound: ACTIVE_ROUND,
    scores: { 'player-uid': 0 },
  });

  beforeEach(() => {
    const firestore = require('firebase/firestore');

    firestore.doc.mockReturnValue({ path: 'games/game-x' });
    firestore.setDoc.mockResolvedValue(undefined);
    firestore.updateDoc.mockResolvedValue(undefined);
    firestore.serverTimestamp.mockReturnValue(new Date());
    firestore.arrayUnion.mockImplementation((v: unknown) => v);
    firestore.onSnapshot.mockReturnValue(jest.fn());

    firestore.getDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ password: 'SECRET' }) })
      .mockResolvedValueOnce({ exists: () => false })
      .mockResolvedValue(makeSnap(activeGameDoc));

    firestore.onSnapshot.mockImplementationOnce((_ref: unknown, cb: (s: unknown) => void) => {
      cb(makeSnap(activeGameDoc));
      return jest.fn();
    });

    mockTxn.get.mockResolvedValue(makeSnap(activeGameDoc));
    mockTxn.update.mockImplementation(() => {});
    firestore.runTransaction.mockImplementation(async (_db: unknown, cb: (t: typeof mockTxn) => Promise<void>) => {
      await cb(mockTxn);
    });
  });

  it('calls runTransaction when giving points to target', async () => {
    const firestore = require('firebase/firestore');
    const { result } = renderHook(() => useGame(), { wrapper });

    await act(async () => { await result.current.enterGame('SECRET'); });
    firestore.runTransaction.mockClear();

    await act(async () => { await result.current.givePointsToTarget('player-uid', 1); });

    expect(firestore.runTransaction).toHaveBeenCalled();
  });

  it('writes updated targetPoints and scores via txn.update inside the transaction', async () => {
    const { result } = renderHook(() => useGame(), { wrapper });

    await act(async () => { await result.current.enterGame('SECRET'); });
    mockTxn.update.mockClear();

    await act(async () => { await result.current.givePointsToTarget('player-uid', 2); });

    expect(mockTxn.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        'currentRound.targetPoints': expect.any(Number),
        scores: expect.objectContaining({ 'player-uid': expect.any(Number) }),
      }),
    );
  });
});

// ─── 6b. awardCommentPoints — uses runTransaction ─────────────────────────────
//
// Regression coverage for a production-class bug: awardCommentPoints used to
// do a plain getDoc → compute → updateDoc (no transaction) to award points to
// one comment at a time. A target awarding points to several comments in
// quick succession could have a second call's getDoc land before the first
// call's updateDoc committed, so the second call's full-object score/comment
// write would silently discard the first award. Wrapping it in runTransaction
// (fresh read at commit time, same pattern as submitComment/givePointsToTarget)
// fixes this the same way.

describe('awardCommentPoints — uses runTransaction to prevent concurrent point loss', () => {
  const mockTxn = { get: jest.fn(), update: jest.fn() };

  const COMMENT_A = { id: 'c1', authorId: 'author-a', text: 'A', submittedAt: new Date() };
  const COMMENT_B = { id: 'c2', authorId: 'author-b', text: 'B', submittedAt: new Date() };

  const roundWithTwoComments = {
    ...ACTIVE_ROUND,
    targetUserId: 'admin-uid',
    comments: [COMMENT_A, COMMENT_B],
    commentsVisible: true,
  };

  const activeGameDoc = makeGameDoc({
    status: 'active',
    currentRound: roundWithTwoComments,
    scores: {},
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

  it('calls runTransaction when awarding comment points', async () => {
    const firestore = require('firebase/firestore');
    const { result } = renderHook(() => useGame(), { wrapper });

    await act(async () => { await result.current.enterGame('SECRET'); });
    firestore.runTransaction.mockClear();

    await act(async () => { await result.current.awardCommentPoints('c1', 3); });

    expect(firestore.runTransaction).toHaveBeenCalled();
  });

  it('writes the awarded comment and per-author score via a dot-path key, not the whole scores object', async () => {
    const { result } = renderHook(() => useGame(), { wrapper });

    await act(async () => { await result.current.enterGame('SECRET'); });
    mockTxn.update.mockClear();

    await act(async () => { await result.current.awardCommentPoints('c1', 3); });

    expect(mockTxn.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        'currentRound.comments': expect.arrayContaining([
          expect.objectContaining({ id: 'c1', points: 3 }),
        ]),
        'scores.author-a': 3,
      }),
    );
  });

  it('does not drop a concurrently-awarded comment when a second award reads fresh state', async () => {
    // Simulates awarding comment A, then quickly awarding comment B: the
    // second transaction's fresh read reflects comment A's already-applied
    // points/score, so that award must survive in the second write's array.
    const firestore = require('firebase/firestore');
    const gameAfterFirstAward = makeGameDoc({
      status: 'active',
      currentRound: {
        ...roundWithTwoComments,
        comments: [{ ...COMMENT_A, points: 3 }, COMMENT_B],
      },
      scores: { 'author-a': 3 },
    });
    mockTxn.get.mockResolvedValue(makeSnap(gameAfterFirstAward));

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    mockTxn.update.mockClear();

    await act(async () => { await result.current.awardCommentPoints('c2', 2); });

    const arg = mockTxn.update.mock.calls[0][1];
    expect(arg['currentRound.comments']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'c1', points: 3 }),
        expect.objectContaining({ id: 'c2', points: 2 }),
      ]),
    );
    expect(arg['scores.author-b']).toBe(2);
    // Untouched by this call — author-a's already-committed score isn't re-sent/clobbered
    expect(arg['scores.author-a']).toBeUndefined();
  });
});

// ─── 7. resetTargetControls clears playersWhoCompletedPostCommentPhase ─────────

describe('resetTargetControls — clears playersWhoCompletedPostCommentPhase', () => {
  const gameWithCompletions = makeGameDoc({
    status: 'active',
    currentRound: ACTIVE_ROUND,
    playersWhoCompletedPostCommentPhase: ['admin-uid'],
  });

  beforeEach(() => {
    const firestore = require('firebase/firestore');
    setupEnterGameMocks(firestore, gameWithCompletions);
  });

  it('resets playersWhoCompletedPostCommentPhase when admin resets target controls', async () => {
    const firestore = require('firebase/firestore');
    const { result } = renderHook(() => useGame(), { wrapper });

    await act(async () => { await result.current.enterGame('SECRET'); });
    firestore.updateDoc.mockClear();

    await act(async () => { await result.current.resetTargetControls(); });

    const calls = firestore.updateDoc.mock.calls;
    const resetCall = calls.find((call: unknown[]) =>
      JSON.stringify(call[1]).includes('adminSkippedTargets'),
    );
    expect(resetCall).toBeDefined();
    expect(resetCall![1]).toMatchObject({ playersWhoCompletedPostCommentPhase: [] });
  });
});

// ─── 8. leaveGame — admin path clears playersWhoCompletedPostCommentPhase ─────

describe('leaveGame — admin path clears playersWhoCompletedPostCommentPhase', () => {
  const mockTxn = { get: jest.fn(), update: jest.fn() };

  const gameWithCompletions = makeGameDoc({
    status: 'active',
    currentRound: ACTIVE_ROUND,
    playersWhoCompletedPostCommentPhase: ['player-uid'],
  });

  beforeEach(() => {
    const firestore = require('firebase/firestore');
    setupEnterGameMocks(firestore, gameWithCompletions);

    mockTxn.get.mockResolvedValue(makeSnap(gameWithCompletions));
    mockTxn.update.mockImplementation(() => {});
    firestore.runTransaction.mockImplementation(async (_db: unknown, cb: (t: typeof mockTxn) => Promise<void>) => {
      await cb(mockTxn);
    });
  });

  it('includes playersWhoCompletedPostCommentPhase:[] in the admin-leave transaction', async () => {
    const { result } = renderHook(() => useGame(), { wrapper });

    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.leaveGame(); });

    expect(mockTxn.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ playersWhoCompletedPostCommentPhase: [] }),
    );
  });
});

// ─── 9. createGame — adminAwards initialized ──────────────────────────────────

describe('createGame — adminAwards initialized to empty object', () => {
  beforeEach(() => {
    const firestore = require('firebase/firestore');
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
      cb(makeSnap(makeGameDoc({ status: 'waiting' })));
      return jest.fn();
    });
  });

  it('passes adminAwards:{} to setDoc when creating a game', async () => {
    const firestore = require('firebase/firestore');
    const { result } = renderHook(() => useGame(), { wrapper });

    await act(async () => { await result.current.enterGame('SECRET'); });

    const setDocCall = firestore.setDoc.mock.calls[0];
    expect(setDocCall).toBeDefined();
    expect(setDocCall[1]).toMatchObject({ adminAwards: {} });
  });
});

// ─── 10. submitGuess — blocks on guessesFinalized ────────────────────────────

describe('submitGuess — blocks re-guessing when round is already finalized', () => {
  const COMMENT = { id: 'c1', authorId: 'player-uid', text: 'hello', submittedAt: new Date() };

  // Round where admin-uid is the target (so admin can call submitGuess) and it's already finalized
  const finalizedRound = {
    roundNumber: 1,
    targetUserId: 'admin-uid',
    targetUserName: 'Admin',
    comments: [COMMENT],
    commentsVisible: true,
    pointsGiven: true,
    startedAt: new Date(),
    guessesFinalized: true,
  };

  const guessingGame = makeGameDoc({
    status: 'guessing_phase',
    currentRound: null,
    rounds: [finalizedRound],
    guessingData: {
      commentsByTarget: { 'admin-uid': [COMMENT] },
      possibleAuthors: [
        { userId: 'admin-uid', userName: 'Admin' },
        { userId: 'player-uid', userName: 'Player' },
      ],
      playersWhoSubmittedGuesses: [],
      allPlayersSubmitted: false,
    },
  });

  beforeEach(() => {
    const firestore = require('firebase/firestore');
    setupEnterGameMocks(firestore, guessingGame);
  });

  it('throws when submitting a guess on a round that has guessesFinalized:true', async () => {
    const { result } = renderHook(() => useGame(), { wrapper });

    await act(async () => { await result.current.enterGame('SECRET'); });

    let caught: Error | null = null;
    await act(async () => {
      try { await result.current.submitGuess(1, 'c1', 'player-uid'); }
      catch (e) { caught = e as Error; }
    });

    expect(caught?.message).toBe("This round's guessing has already been finalized");
  });
});

// ─── 11. submitComment — 5.1 concurrent race from the same user ──────────────
//
// Scenario: a user double-taps Submit. Both calls start before either resolves
// and the React state has no comment yet. Firestore serializes the two
// transactions: the second re-reads after the first committed and must be
// rejected.  The guard lives inside runTransaction (fresh Firestore read), NOT
// in the stale React-state snapshot.

describe('submitComment — 5.1 concurrent race from the same user', () => {
  const activeGameNoComments = makeGameDoc({
    status: 'active',
    currentRound: ACTIVE_ROUND,
  });

  const activeGameWithMyComment = makeGameDoc({
    status: 'active',
    currentRound: {
      ...ACTIVE_ROUND,
      comments: [{ id: 'c1', authorId: 'admin-uid', text: 'First', submittedAt: new Date() }],
    },
  });

  function setupMocks(firestore: ReturnType<typeof require>) {
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
      cb(makeSnap(activeGameNoComments));
      return jest.fn();
    });
  }

  it('rejects the second simultaneous call with "already submitted"', async () => {
    const firestore = require('firebase/firestore');
    setupMocks(firestore);

    // Both calls start before either resolves. Firestore serialises them:
    // txn 1 sees no comment → succeeds; txn 2 re-reads after commit → throws.
    let txnCallCount = 0;
    firestore.runTransaction.mockImplementation(
      async (_db: unknown, cb: (t: { get: jest.Mock; update: jest.Mock }) => Promise<void>) => {
        txnCallCount++;
        const snap = txnCallCount === 1
          ? makeSnap(activeGameNoComments)
          : makeSnap(activeGameWithMyComment);
        const txn = { get: jest.fn().mockResolvedValue(snap), update: jest.fn() };
        await cb(txn);
      },
    );

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });

    let results: PromiseSettledResult<void>[] = [];
    await act(async () => {
      results = await Promise.allSettled([
        result.current.submitComment('First'),
        result.current.submitComment('Second'),
      ]);
    });

    expect(results[0].status).toBe('fulfilled');
    expect(results[1].status).toBe('rejected');
    expect((results[1] as PromiseRejectedResult).reason.message).toBe(
      'You have already submitted a comment for this round',
    );
  });

  it('writes exactly one comment to Firestore when two calls race', async () => {
    const firestore = require('firebase/firestore');
    setupMocks(firestore);

    let txnCallCount = 0;
    const txnUpdateMocks: jest.Mock[] = [];
    firestore.runTransaction.mockImplementation(
      async (_db: unknown, cb: (t: { get: jest.Mock; update: jest.Mock }) => Promise<void>) => {
        txnCallCount++;
        const snap = txnCallCount === 1
          ? makeSnap(activeGameNoComments)
          : makeSnap(activeGameWithMyComment);
        const txn = { get: jest.fn().mockResolvedValue(snap), update: jest.fn() };
        txnUpdateMocks.push(txn.update);
        await cb(txn);
      },
    );

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });

    await act(async () => {
      await Promise.allSettled([
        result.current.submitComment('First'),
        result.current.submitComment('Second'),
      ]);
    });

    expect(txnUpdateMocks[0]).toHaveBeenCalledTimes(1);
    expect(txnUpdateMocks[1]).toHaveBeenCalledTimes(0);
  });
});
