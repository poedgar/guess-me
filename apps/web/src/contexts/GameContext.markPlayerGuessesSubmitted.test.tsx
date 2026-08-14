// @vitest-environment jsdom
/**
 * Regression coverage: markPlayerGuessesSubmitted computed the number of
 * players expected to submit guesses ("totalTargets") as
 * `participants.length - 1`, which only holds for the legacy all-rounds
 * guessing flow. In the (now-default) single-round-target guessing phase,
 * guessingData.commentsByTarget has exactly ONE key — only that one target
 * ever needs to submit — so with 3+ participants the old formula could
 * never be satisfied and allPlayersSubmitted/postGuessingPointPhase would
 * never flip to true from this path.
 *
 * apps/expo's submitGuess already carries this same fix (see
 * apps/expo/contexts/GameContext.tsx and the parallel tests in
 * apps/expo/__tests__/GameContext.*.totalTargets.test.tsx) — this brings
 * apps/web's markPlayerGuessesSubmitted in line with it.
 */
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({ currentUser: { uid: 'admin-uid' } })),
  GoogleAuthProvider: vi.fn(),
}));

const firestoreMocks = {
  doc: vi.fn(() => ({ path: 'games/game-x' })),
  getDoc: vi.fn(),
  getDocs: vi.fn(() => Promise.resolve({ docs: [] })),
  setDoc: vi.fn(() => Promise.resolve()),
  updateDoc: vi.fn((_ref: unknown, _data: Record<string, unknown>) => Promise.resolve()),
  deleteDoc: vi.fn(() => Promise.resolve()),
  collection: vi.fn(),
  runTransaction: vi.fn(),
  arrayUnion: vi.fn((v: unknown) => v),
  onSnapshot: vi.fn(() => vi.fn()),
  serverTimestamp: vi.fn(() => new Date()),
  Timestamp: { now: vi.fn(() => new Date()) },
};
vi.mock('firebase/firestore', () => ({ getFirestore: vi.fn(() => ({})), ...firestoreMocks }));

vi.mock('./AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'admin-uid', displayName: 'Admin', email: 'admin@test.com', photoURL: null },
  }),
}));

const { GameProvider, useGame } = await import('./GameContext');

const ADMIN = { userId: 'admin-uid', userName: 'Admin', userEmail: 'admin@test.com', joinedAt: new Date() };
const PLAYER = { userId: 'player-uid', userName: 'Player', userEmail: 'player@test.com', joinedAt: new Date() };
const PLAYER2 = { userId: 'player2-uid', userName: 'Player2', userEmail: 'player2@test.com', joinedAt: new Date() };

const COMMENT = { id: 'c1', authorId: 'player-uid', text: 'hello', submittedAt: new Date() };

function makeSingleTargetGuessingGame(overrides: Record<string, unknown> = {}) {
  return {
    adminId: 'admin-uid',
    adminName: 'Admin',
    adminEmail: 'admin@test.com',
    status: 'guessing_phase',
    participants: [ADMIN, PLAYER, PLAYER2],
    rounds: [{
      roundNumber: 1,
      targetUserId: 'admin-uid',
      targetUserName: 'Admin',
      comments: [COMMENT],
      commentsVisible: true,
      pointsGiven: true,
      startedAt: new Date(),
      guesses: [],
    }],
    scores: {},
    guessingData: {
      commentsByTarget: { 'admin-uid': [COMMENT] },
      possibleAuthors: [
        { userId: 'admin-uid', userName: 'Admin' },
        { userId: 'player-uid', userName: 'Player' },
        { userId: 'player2-uid', userName: 'Player2' },
      ],
      playersWhoSubmittedGuesses: [],
      allPlayersSubmitted: false,
      singleRoundTargetId: 'admin-uid',
    },
    guessResults: {},
    createdAt: new Date(),
    currentRound: null,
    ...overrides,
  };
}

function makeSnap(data: Record<string, unknown>, id = 'game-x') {
  return { exists: () => true, id, data: () => data };
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <GameProvider>{children}</GameProvider>
);

describe('markPlayerGuessesSubmitted — totalTargets in single-round-target guessing phase', () => {
  beforeEach(() => {
    Object.values(firestoreMocks).forEach((m) => 'mockReset' in m && (m as ReturnType<typeof vi.fn>).mockReset());
    firestoreMocks.doc.mockReturnValue({ path: 'games/game-x' });
    firestoreMocks.arrayUnion.mockImplementation((v: unknown) => v);
    firestoreMocks.onSnapshot.mockReturnValue(vi.fn());
    firestoreMocks.updateDoc.mockResolvedValue(undefined);
  });

  it('marks allPlayersSubmitted true once the SOLE target submits, with 3 participants', async () => {
    const gameDoc = makeSingleTargetGuessingGame();

    // joinGame's "already a participant" path -> refreshGame -> getDoc,
    // then markPlayerGuessesSubmitted's own getDoc.
    firestoreMocks.getDoc.mockResolvedValue(makeSnap(gameDoc));

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.joinGame('game-x'); });

    await act(async () => { await result.current.markPlayerGuessesSubmitted(undefined, 1); });

    const updateDocCalls = firestoreMocks.updateDoc.mock.calls as [unknown, Record<string, unknown>][];
    const call = updateDocCalls.find((c) => c[1]['guessingData.allPlayersSubmitted'] !== undefined);
    expect(call).toBeDefined();
    expect(call![1]['guessingData.allPlayersSubmitted']).toBe(true);
    expect(call![1].postGuessingPointPhase).toBe(true);
  });
});
