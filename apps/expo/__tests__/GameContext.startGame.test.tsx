// TDD: startGame() must assign a frozen playerNumbers map from join order.
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

function makeWaitingGameDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'game-x',
    adminId: 'admin-uid',
    adminName: 'Admin',
    adminEmail: 'admin@test.com',
    status: 'waiting',
    participants: [
      { userId: 'admin-uid', userName: 'Admin', userEmail: 'admin@test.com', joinedAt: new Date(0) },
      { userId: 'player-uid', userName: 'Player', userEmail: 'p@test.com', joinedAt: new Date(1) },
      { userId: 'third-uid', userName: 'Third', userEmail: 't@test.com', joinedAt: new Date(2) },
    ],
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

describe('startGame — assigns frozen playerNumbers from join order', () => {
  it('writes playerNumbers mapping each participant to their 1-based join position', async () => {
    const firestore = require('firebase/firestore');
    setupEnterGame(firestore, makeWaitingGameDoc());

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.startGame(); });

    const startCalls = firestore.updateDoc.mock.calls.filter(
      (call: unknown[]) => (call[1] as Record<string, unknown>).status === 'active',
    );
    expect(startCalls.length).toBe(1);
    const payload = startCalls[0][1] as Record<string, unknown>;
    expect(payload.playerNumbers).toEqual({
      'admin-uid': 1,
      'player-uid': 2,
      'third-uid': 3,
    });
  });
});
