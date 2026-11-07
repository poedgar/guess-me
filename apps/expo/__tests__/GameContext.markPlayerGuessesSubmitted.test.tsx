/**
 * Regression coverage: markPlayerGuessesSubmitted computed the number of
 * players expected to submit guesses ("totalTargets") as
 * `participants.length - 1`, which only holds for the legacy all-rounds
 * guessing flow. In the (now-default) single-round-target guessing phase,
 * guessingData.commentsByTarget has exactly ONE key — only that one target
 * ever needs to submit — so with 3+ participants the old formula could
 * never be satisfied and allPlayersSubmitted/postGuessingPointPhase would
 * never flip to true from this path.
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

describe('markPlayerGuessesSubmitted — totalTargets in single-round-target guessing phase', () => {
  it('marks allPlayersSubmitted true once the SOLE target submits, with 3 participants', async () => {
    const gameDoc = makeSingleTargetGuessingGame();
    const firestore = require('firebase/firestore');

    firestore.doc.mockReturnValue({ path: 'games/game-x' });
    firestore.setDoc.mockResolvedValue(undefined);
    firestore.updateDoc.mockResolvedValue(undefined);
    firestore.serverTimestamp.mockReturnValue(new Date());
    firestore.arrayUnion.mockImplementation((v: unknown) => v);
    firestore.onSnapshot.mockReturnValue(jest.fn());

    firestore.getDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ password: 'SECRET' }) }) // password
      .mockResolvedValueOnce({ exists: () => false }) // uniqueness
      .mockResolvedValue(makeSnap(gameDoc)); // markPlayerGuessesSubmitted's own getDoc

    firestore.onSnapshot.mockImplementationOnce((_ref: unknown, cb: (s: unknown) => void) => {
      cb(makeSnap(gameDoc));
      return jest.fn();
    });

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });

    await act(async () => { await result.current.markPlayerGuessesSubmitted(undefined, 1); });

    const call = firestore.updateDoc.mock.calls.find(
      (c: unknown[]) => (c[1] as Record<string, unknown>)['guessingData.allPlayersSubmitted'] !== undefined,
    );
    expect(call).toBeDefined();
    expect((call![1] as Record<string, unknown>)['guessingData.allPlayersSubmitted']).toBe(true);
    expect((call![1] as Record<string, unknown>).postGuessingPointPhase).toBe(true);
  });
});
