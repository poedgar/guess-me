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

  beforeEach(() => {
    const firestore = require('firebase/firestore');

    // getDoc sequence:
    //   1. password check
    //   2. uniqueness
    //   3. submitComment live fetch — returns round that already has admin's comment
    firestore.getDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ password: 'SECRET' }) })
      .mockResolvedValueOnce({ exists: () => false })
      .mockResolvedValueOnce(makeSnap(makeGameDoc({
        status: 'active',
        currentRound: { ...ACTIVE_ROUND, comments: [EXISTING_COMMENT] },
      })));

    firestore.doc.mockReturnValue({ path: 'games/game-x' });
    firestore.setDoc.mockResolvedValue(undefined);
    firestore.updateDoc.mockResolvedValue(undefined);
    firestore.serverTimestamp.mockReturnValue(new Date());
    firestore.arrayUnion.mockImplementation((v: unknown) => v);
    firestore.onSnapshot.mockReturnValue(jest.fn());

    // Initial snapshot: active game so submitComment guard doesn't fire early
    firestore.onSnapshot.mockImplementationOnce((_ref: unknown, cb: (s: unknown) => void) => {
      cb(makeSnap(makeGameDoc({
        status: 'active',
        currentRound: { ...ACTIVE_ROUND, comments: [EXISTING_COMMENT] },
      })));
      return jest.fn();
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
