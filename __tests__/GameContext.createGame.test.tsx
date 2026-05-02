// TDD – Fix 5.3: createGame duplicate-ID retry loop.
//
// Behaviours:
//   a) First ID unique  → game created immediately, generateGameId called once
//   b) First N IDs taken → retries until unique ID found, setDoc uses the unique one
//   c) 10 consecutive collisions → throws "Unable to generate unique game ID …"
//   d) Exactly (collisions + 1) calls to generateGameId before success
import { act, renderHook } from '@testing-library/react-native';
import React from 'react';
import { GameProvider, useGame } from '../contexts/GameContext';

// ── control generateGameId from each test ─────────────────────────────────────
let mockGenerateGameId: jest.Mock;
jest.mock('@/utils/gameIdGenerator', () => ({
  generateGameId: (...args: unknown[]) => mockGenerateGameId(...args),
}));

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

function makeSnap(id: string) {
  return {
    exists: () => true,
    id,
    data: () => ({
      id,
      adminId: 'admin-uid',
      adminName: 'Admin',
      adminEmail: 'admin@test.com',
      status: 'waiting',
      participants: [{ userId: 'admin-uid', userName: 'Admin', userEmail: 'admin@test.com', joinedAt: new Date() }],
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
    }),
  };
}

describe('createGame — 5.3 duplicate-ID retry logic', () => {
  beforeEach(() => {
    const firestore = require('firebase/firestore');
    // doc() returns a ref whose path records the last call's arguments so tests
    // can check which game ID was used with setDoc.
    firestore.doc.mockImplementation((_db: unknown, _col: string, id?: string) => ({
      path: id ? `games/${id}` : 'password/doc',
    }));
    firestore.setDoc.mockResolvedValue(undefined);
    firestore.updateDoc.mockResolvedValue(undefined);
    firestore.serverTimestamp.mockReturnValue(new Date());
    firestore.arrayUnion.mockImplementation((v: unknown) => v);
    firestore.onSnapshot.mockReturnValue(jest.fn());
  });

  // ─── a) first ID is unique ──────────────────────────────────────────────────

  it('creates the game with the first generated ID when it is unique', async () => {
    const firestore = require('firebase/firestore');
    mockGenerateGameId = jest.fn().mockReturnValue('весела-кішка');

    firestore.getDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ password: 'SECRET' }) })
      .mockResolvedValueOnce({ exists: () => false }); // first ID is free

    firestore.onSnapshot.mockImplementationOnce((_ref: unknown, cb: (s: unknown) => void) => {
      cb(makeSnap('весела-кішка'));
      return jest.fn();
    });

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });

    expect(mockGenerateGameId).toHaveBeenCalledTimes(1);
    expect(firestore.setDoc).toHaveBeenCalledTimes(1);
    expect(firestore.setDoc.mock.calls[0][0].path).toBe('games/весела-кішка');
  });

  // ─── b) first ID taken, second is unique ───────────────────────────────────

  it('retries and uses the second ID when the first is already taken', async () => {
    const firestore = require('firebase/firestore');
    mockGenerateGameId = jest.fn()
      .mockReturnValueOnce('taken-id')
      .mockReturnValueOnce('unique-id');

    firestore.getDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ password: 'SECRET' }) })
      .mockResolvedValueOnce({ exists: () => true })   // 'taken-id' → collision
      .mockResolvedValueOnce({ exists: () => false });  // 'unique-id' → free

    firestore.onSnapshot.mockImplementationOnce((_ref: unknown, cb: (s: unknown) => void) => {
      cb(makeSnap('unique-id'));
      return jest.fn();
    });

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });

    expect(mockGenerateGameId).toHaveBeenCalledTimes(2);
    expect(firestore.setDoc).toHaveBeenCalledTimes(1);
    expect(firestore.setDoc.mock.calls[0][0].path).toBe('games/unique-id');
  });

  // ─── c) all 10 attempts collide ────────────────────────────────────────────

  it('throws after 10 consecutive duplicate IDs', async () => {
    const firestore = require('firebase/firestore');
    mockGenerateGameId = jest.fn().mockReturnValue('always-taken');

    firestore.getDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ password: 'SECRET' }) })
      .mockResolvedValue({ exists: () => true }); // every uniqueness check → taken

    const { result } = renderHook(() => useGame(), { wrapper });

    let caught: Error | null = null;
    await act(async () => {
      try { await result.current.enterGame('SECRET'); }
      catch (e) { caught = e as Error; }
    });

    expect(caught?.message).toBe(
      'Unable to generate unique game ID after multiple attempts',
    );
    expect(mockGenerateGameId).toHaveBeenCalledTimes(10);
    expect(firestore.setDoc).not.toHaveBeenCalled();
  });

  // ─── d) exactly (N collisions + 1) calls before success ───────────────────

  it('generates exactly 4 IDs after 3 consecutive collisions before finding unique', async () => {
    const firestore = require('firebase/firestore');
    mockGenerateGameId = jest.fn()
      .mockReturnValueOnce('taken-1')
      .mockReturnValueOnce('taken-2')
      .mockReturnValueOnce('taken-3')
      .mockReturnValue('unique-final');

    firestore.getDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ password: 'SECRET' }) })
      .mockResolvedValueOnce({ exists: () => true })   // taken-1
      .mockResolvedValueOnce({ exists: () => true })   // taken-2
      .mockResolvedValueOnce({ exists: () => true })   // taken-3
      .mockResolvedValueOnce({ exists: () => false });  // unique-final

    firestore.onSnapshot.mockImplementationOnce((_ref: unknown, cb: (s: unknown) => void) => {
      cb(makeSnap('unique-final'));
      return jest.fn();
    });

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });

    expect(mockGenerateGameId).toHaveBeenCalledTimes(4);
    expect(firestore.setDoc).toHaveBeenCalledTimes(1);
    expect(firestore.setDoc.mock.calls[0][0].path).toBe('games/unique-final');
  });
});
