// TDD: startGame() and startNextRound() must write a roundStartScores/
// roundStartGuessResults snapshot — round 1 starts empty, later rounds
// capture whatever scores/guessResults stood the instant the round began.
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

const ADMIN  = { userId: 'admin-uid', userName: 'Admin',  userEmail: 'admin@test.com', joinedAt: new Date(0) };
const PLAYER = { userId: 'player-uid', userName: 'Player', userEmail: 'p@test.com',    joinedAt: new Date(1) };
const THIRD  = { userId: 'third-uid', userName: 'Third',  userEmail: 't@test.com',     joinedAt: new Date(2) };

function makeGameDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'game-x',
    adminId: 'admin-uid',
    adminName: 'Admin',
    adminEmail: 'admin@test.com',
    status: 'waiting',
    participants: [ADMIN, PLAYER, THIRD],
    rounds: [],
    scores: {},
    guessingData: { commentsByTarget: {}, possibleAuthors: [], playersWhoSubmittedGuesses: [], allPlayersSubmitted: false },
    guessResults: {},
    createdAt: new Date(),
    currentRound: null,
    adminWritesComments: false,
    showSurnames: false,
    showGuessResults: false,
    targetSelectionMode: 'random',
    adminAwards: {},
    adminSkippedTargets: [],
    adminNextTargetPreference: null,
    ...overrides,
  };
}

function makeSnap(data: Record<string, unknown>, id = 'game-x') {
  return { exists: () => true, id, data: () => data };
}

function setupEnterGame(firestore: ReturnType<typeof require>, gameDoc: Record<string, unknown>) {
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

describe('startGame — writes an empty round-start snapshot', () => {
  it('writes roundStartScores/roundStartGuessResults as {} alongside scores: {}', async () => {
    const firestore = require('firebase/firestore');
    setupEnterGame(firestore, makeGameDoc());

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.startGame(); });

    const startCalls = firestore.updateDoc.mock.calls.filter(
      (call: unknown[]) => (call[1] as Record<string, unknown>).status === 'active',
    );
    expect(startCalls.length).toBe(1);
    const payload = startCalls[0][1] as Record<string, unknown>;
    expect(payload.roundStartScores).toEqual({});
    expect(payload.roundStartGuessResults).toEqual({});
  });
});

describe('startNextRound — snapshots the just-finished round\'s final scores', () => {
  it('writes roundStartScores/roundStartGuessResults as a copy of the pre-transition scores/guessResults', async () => {
    const firestore = require('firebase/firestore');
    const completedRound = {
      roundNumber: 1,
      targetUserId: 'player-uid',
      targetUserName: 'Player',
      comments: [],
      commentsVisible: true,
      pointsGiven: true,
      startedAt: new Date(),
    };
    const gameDoc = makeGameDoc({
      status: 'active',
      rounds: [completedRound],
      currentRound: completedRound,
      scores: { 'admin-uid': 3, 'player-uid': 7 },
      guessResults: { 'third-uid': { correctGuesses: 2 } },
      roundStartScores: {},
      roundStartGuessResults: {},
    });
    setupEnterGame(firestore, gameDoc);
    firestore.getDoc.mockResolvedValueOnce(makeSnap(gameDoc));

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.startNextRound(); });

    const roundWrite = firestore.updateDoc.mock.calls.find(
      (call: unknown[]) => (call[1] as Record<string, unknown>).currentRound != null,
    );
    expect(roundWrite).toBeDefined();
    const payload = roundWrite![1] as Record<string, unknown>;
    expect(payload.roundStartScores).toEqual({ 'admin-uid': 3, 'player-uid': 7 });
    expect(payload.roundStartGuessResults).toEqual({ 'third-uid': { correctGuesses: 2 } });
  });
});
