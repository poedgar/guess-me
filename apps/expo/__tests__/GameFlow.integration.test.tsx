/**
 * Integration test: full happy-path round
 *   create → join (snapshot) → start → comment → show comments
 *   → start guessing → finalize → finished with scores
 *
 * One real GameProvider rendering. Firebase is mocked at the module level
 * (see jest.setup.js). Each Firestore call's return value is queued below
 * so the full sequence can be exercised without a real backend.
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

// Override the global firebase config mock so auth.currentUser is non-null
// (GameContext checks auth.currentUser directly for several operations).
jest.mock('@/config/firebase', () => ({
  db: {},
  auth: {
    currentUser: { uid: 'admin-uid' },
    signOut: jest.fn(() => Promise.resolve()),
  },
}));

// ─── shared fixture helpers ───────────────────────────────────────────────────

const ADMIN_PARTICIPANT = {
  userId: 'admin-uid',
  userName: 'Admin',
  userEmail: 'admin@test.com',
  joinedAt: new Date(1000),
};
const PLAYER_PARTICIPANT = {
  userId: 'player-uid',
  userName: 'Player',
  userEmail: 'player@test.com',
  joinedAt: new Date(2000),
};

const BASE_ROUND = {
  roundNumber: 1,
  targetUserId: 'player-uid',
  targetUserName: 'Player',
  comments: [],
  commentsVisible: false,
  pointsGiven: false,
  startedAt: new Date(),
};

const COMMENT = {
  id: 'c1',
  authorId: 'admin-uid',
  text: 'Great communicator',
  submittedAt: new Date(),
};

function makeGameData(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    adminId: 'admin-uid',
    adminName: 'Admin',
    adminEmail: 'admin@test.com',
    status: 'waiting',
    participants: [ADMIN_PARTICIPANT, PLAYER_PARTICIPANT],
    rounds: [],
    scores: {},
    guessingData: { commentsByTarget: {}, possibleAuthors: [], playersWhoSubmittedGuesses: [], allPlayersSubmitted: false },
    guessResults: {},
    createdAt: new Date(),
    currentRound: null,
    ...overrides,
  };
}

function makeSnap(data: Record<string, unknown>) {
  return { exists: () => true, id: 'game-abc', data: () => data };
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <GameProvider>{children}</GameProvider>
);

// ─── tests ────────────────────────────────────────────────────────────────────

describe('happy path integration — create → start → comment → guessing → finished', () => {
  let snapshotCb: ((snap: Record<string, unknown>) => void) | null = null;

  beforeEach(() => {
    snapshotCb = null;
    const firestore = require('firebase/firestore');

    // Queue getDoc responses in call order:
    //   1. password check  (enterGame)
    //   2. uniqueness check (createGame loop)
    //   3. submitComment fetches live game doc
    //   4. startGuessingPhase fetches game doc
    //   5. finalizeGuessingPhase fetches game doc
    firestore.getDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ password: 'SECRET' }) })
      .mockResolvedValueOnce({ exists: () => false })
      .mockResolvedValueOnce(makeSnap(makeGameData({
        status: 'active',
        currentRound: { ...BASE_ROUND },
      })))
      .mockResolvedValueOnce(makeSnap(makeGameData({
        status: 'active',
        currentRound: { ...BASE_ROUND, comments: [COMMENT], commentsVisible: true, pointsGiven: true },
      })))
      .mockResolvedValueOnce(makeSnap(makeGameData({
        status: 'guessing_phase',
        currentRound: null,
        rounds: [{ ...BASE_ROUND, comments: [COMMENT], commentsVisible: true, pointsGiven: true, guesses: [
          { commentId: 'c1', guesserId: 'player-uid', guessedAuthorId: 'admin-uid', correct: true, guessedAt: new Date() },
        ] }],
        guessingData: {
          commentsByTarget: { 'player-uid': [COMMENT] },
          possibleAuthors: [{ userId: 'admin-uid', userName: 'Admin' }],
          playersWhoSubmittedGuesses: ['player-uid'],
          allPlayersSubmitted: true,
          singleRoundTargetId: null,
        },
        scores: { 'admin-uid': 3 },
      })));

    firestore.setDoc.mockResolvedValue(undefined);
    firestore.updateDoc.mockResolvedValue(undefined);
    firestore.doc.mockReturnValue({ path: 'games/game-abc' });
    firestore.arrayUnion.mockImplementation((val: unknown) => val);
    firestore.serverTimestamp.mockReturnValue(new Date());

    // Subsequent onSnapshot calls (re-subscribe when currentGame.id changes) just
    // need to return a no-op unsubscribe so the useEffect cleanup doesn't throw.
    firestore.onSnapshot.mockReturnValue(jest.fn());

    // First onSnapshot call (triggered after createGame sets currentGame.id).
    // Fires the initial "waiting" snapshot immediately and saves the callback.
    firestore.onSnapshot.mockImplementationOnce((_ref: unknown, cb: (s: unknown) => void) => {
      snapshotCb = cb as (snap: Record<string, unknown>) => void;
      cb(makeSnap(makeGameData()));
      return jest.fn();
    });
  });

  it('transitions through every phase and ends with correct scores', async () => {
    const { result } = renderHook(() => useGame(), { wrapper });

    // ── Step 1: admin creates game via enterGame ────────────────────────────
    await act(async () => { await result.current.enterGame('SECRET'); });

    expect(result.current.currentGame?.status).toBe('waiting');
    expect(result.current.currentGame?.participants).toHaveLength(2);

    // ── Step 2: admin starts the game ──────────────────────────────────────
    await act(async () => { await result.current.startGame(); });

    // Firestore confirms: game is now active with round 1 targeting Player
    await act(async () => {
      snapshotCb?.(makeSnap(makeGameData({ status: 'active', currentRound: BASE_ROUND })));
    });

    expect(result.current.currentGame?.status).toBe('active');
    expect(result.current.currentGame?.currentRound?.targetUserId).toBe('player-uid');

    // ── Step 3: admin submits a comment about Player ────────────────────────
    await act(async () => { await result.current.submitComment('Great communicator'); });

    const firestore = require('firebase/firestore');
    const commentCalls = firestore.updateDoc.mock.calls.filter(
      (call: unknown[]) => JSON.stringify(call[1]).includes('currentRound.comments'),
    );
    expect(commentCalls.length).toBeGreaterThan(0);
    const commentArg = (commentCalls[0][1] as Record<string, unknown>)['currentRound.comments'] as Array<{ text: string }>;
    expect(commentArg.some(c => c.text === 'Great communicator')).toBe(true);

    // ── Step 4: admin reveals comments ─────────────────────────────────────
    await act(async () => { await result.current.showComments(); });

    const showCalls = firestore.updateDoc.mock.calls.filter(
      (call: unknown[]) => (call[1] as Record<string, unknown>)['currentRound.commentsVisible'] === true,
    );
    expect(showCalls.length).toBeGreaterThan(0);

    // Firestore confirms: comments now visible, points given
    await act(async () => {
      snapshotCb?.(makeSnap(makeGameData({
        status: 'active',
        currentRound: { ...BASE_ROUND, comments: [COMMENT], commentsVisible: true, pointsGiven: true },
      })));
    });

    // ── Step 5: admin starts the guessing phase ─────────────────────────────
    await act(async () => { await result.current.startGuessingPhase(); });

    // Firestore confirms: status → guessing_phase
    await act(async () => {
      snapshotCb?.(makeSnap(makeGameData({
        status: 'guessing_phase',
        currentRound: null,
        rounds: [{ ...BASE_ROUND, comments: [COMMENT], commentsVisible: true, pointsGiven: true }],
        guessingData: {
          commentsByTarget: { 'player-uid': [COMMENT] },
          possibleAuthors: [{ userId: 'admin-uid', userName: 'Admin' }],
          playersWhoSubmittedGuesses: ['player-uid'],
          allPlayersSubmitted: true,
        },
      })));
    });

    expect(result.current.currentGame?.status).toBe('guessing_phase');

    // ── Step 6: admin finalizes guessing (all players already submitted) ────
    await act(async () => { await result.current.finalizeGuessingPhase(); });

    // Firestore confirms: game finished with scores
    await act(async () => {
      snapshotCb?.(makeSnap(makeGameData({
        status: 'finished',
        currentRound: null,
        rounds: [{ ...BASE_ROUND, comments: [{ ...COMMENT, points: 3 }], commentsVisible: true, pointsGiven: true }],
        scores: { 'admin-uid': 3 },
        guessResults: { 'player-uid': { correctGuesses: 1 } },
      })));
    });

    expect(result.current.currentGame?.status).toBe('finished');
    expect(result.current.currentGame?.scores?.['admin-uid']).toBe(3);
    expect(result.current.currentGame?.guessResults?.['player-uid']?.correctGuesses).toBe(1);

    // ── Verify all expected Firestore writes occurred ───────────────────────
    const allUpdateCalls = firestore.updateDoc.mock.calls;

    const startedGame = allUpdateCalls.some(
      (call: unknown[]) => (call[1] as Record<string, unknown>).status === 'active',
    );
    expect(startedGame).toBe(true);

    const startedGuessing = allUpdateCalls.some(
      (call: unknown[]) => (call[1] as Record<string, unknown>).status === 'guessing_phase',
    );
    expect(startedGuessing).toBe(true);

    const finalized = allUpdateCalls.some(
      (call: unknown[]) => (call[1] as Record<string, unknown>).status === 'finished',
    );
    expect(finalized).toBe(true);
  });
});
