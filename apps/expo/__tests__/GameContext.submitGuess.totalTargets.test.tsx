/**
 * Regression coverage: submitGuess's own "did this player finish guessing"
 * auto-completion check had the same totalTargets bug as
 * markPlayerGuessesSubmitted (see GameContext.markPlayerGuessesSubmitted.test.tsx) —
 * it used `participants.length - 1` instead of the actual number of targets
 * in guessingData.commentsByTarget, so with 3+ participants in the
 * single-round-target guessing phase, the sole target finishing their
 * guesses never flipped allPlayersSubmitted to true.
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

const ADMIN = { userId: 'admin-uid', userName: 'Admin', userEmail: 'admin@test.com', joinedAt: new Date() };
const PLAYER = { userId: 'player-uid', userName: 'Player', userEmail: 'player@test.com', joinedAt: new Date() };
const PLAYER2 = { userId: 'player2-uid', userName: 'Player2', userEmail: 'player2@test.com', joinedAt: new Date() };

const COMMENT = { id: 'c1', authorId: 'player-uid', text: 'hello', submittedAt: new Date() };

const FINALIZED_ROUND = {
  roundNumber: 1,
  targetUserId: 'admin-uid',
  targetUserName: 'Admin',
  comments: [COMMENT],
  commentsVisible: true,
  pointsGiven: true,
  startedAt: new Date(),
  guesses: [] as unknown[],
};

function makeGuessingGame(overrides: Record<string, unknown> = {}) {
  return {
    adminId: 'admin-uid',
    adminName: 'Admin',
    adminEmail: 'admin@test.com',
    status: 'guessing_phase',
    participants: [ADMIN, PLAYER, PLAYER2],
    rounds: [FINALIZED_ROUND],
    scores: {},
    // Single-round guessing phase: only admin-uid is a target here.
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

describe('submitGuess — auto-completion totalTargets in single-round-target guessing phase', () => {
  it("marks allPlayersSubmitted true once the sole target's last guess lands, with 3 participants", async () => {
    const gameDoc = makeGuessingGame();
    const firestore = require('firebase/firestore');

    firestore.doc.mockReturnValue({ path: 'games/game-x' });
    firestore.setDoc.mockResolvedValue(undefined);
    firestore.updateDoc.mockResolvedValue(undefined);
    firestore.serverTimestamp.mockReturnValue(new Date());
    firestore.arrayUnion.mockImplementation((v: unknown) => v);
    firestore.onSnapshot.mockReturnValue(jest.fn());

    // Round after the transaction has committed the guess (what the code's
    // post-transaction getDoc(gameRef) call will observe).
    const gameDocAfterGuess = makeGuessingGame({
      rounds: [{
        ...FINALIZED_ROUND,
        guesses: [{ commentId: 'c1', guesserId: 'admin-uid', guessedAuthorId: 'player-uid', correct: true, guessedAt: new Date() }],
      }],
    });

    firestore.getDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ password: 'SECRET' }) }) // password
      .mockResolvedValueOnce({ exists: () => false }) // uniqueness
      .mockResolvedValueOnce(makeSnap(gameDocAfterGuess)); // submitGuess's post-transaction getDoc

    firestore.onSnapshot.mockImplementationOnce((_ref: unknown, cb: (s: unknown) => void) => {
      cb(makeSnap(gameDoc));
      return jest.fn();
    });

    firestore.runTransaction.mockImplementation(
      async (_db: unknown, cb: (t: { get: jest.Mock; update: jest.Mock }) => Promise<void>) => {
        const txn = { get: jest.fn().mockResolvedValue(makeSnap(gameDoc)), update: jest.fn() };
        await cb(txn);
      },
    );

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });

    await act(async () => { await result.current.submitGuess(1, 'c1', 'player-uid'); });

    const call = firestore.updateDoc.mock.calls.find(
      (c: unknown[]) => (c[1] as Record<string, unknown>)['guessingData.allPlayersSubmitted'] !== undefined,
    );
    expect(call).toBeDefined();
    expect((call![1] as Record<string, unknown>)['guessingData.allPlayersSubmitted']).toBe(true);
  });
});
