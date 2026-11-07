import { act, renderHook } from '@testing-library/react-native';
import React from 'react';
import { GameProvider, useGame } from '../contexts/GameContext';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-1', displayName: 'Alice', email: 'alice@example.com' },
    isSignedIn: true,
  }),
}));

beforeEach(() => {
  // Allow enterGame to proceed past the auth.currentUser guard
  const config = require('@/config/firebase');
  config.auth.currentUser = { uid: 'user-1', displayName: 'Alice', email: 'alice@example.com', photoURL: null };

  const firestore = require('firebase/firestore');
  firestore.doc.mockReturnValue({ path: 'games/test-id' });
  firestore.getDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
  firestore.setDoc.mockResolvedValue(undefined);
  firestore.updateDoc.mockResolvedValue(undefined);
  firestore.onSnapshot.mockReturnValue(jest.fn());
  firestore.arrayUnion.mockImplementation((val: any) => val);
  firestore.serverTimestamp.mockReturnValue(new Date());
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  React.createElement(GameProvider, null, children)
);

describe('setGameType', () => {
  it('is exposed by useGame', () => {
    const { result } = renderHook(() => useGame(), { wrapper });
    expect(typeof result.current.setGameType).toBe('function');
  });

  it('calls updateDoc with { gameType: type } when a game is active', async () => {
    const firestore = require('firebase/firestore');
    const gameDoc = { id: 'game-abc', path: 'games/game-abc' };
    firestore.doc.mockReturnValue(gameDoc);

    const gameData = {
      adminId: 'user-1', adminName: 'Alice', adminEmail: 'alice@example.com',
      status: 'waiting', participants: [{ userId: 'user-1', userName: 'Alice', userEmail: 'alice@example.com', joinedAt: new Date() }],
      rounds: [], scores: {}, guessingData: { commentsByTarget: {}, possibleAuthors: [] },
      guessResults: {}, createdAt: new Date(), currentRound: null,
    };

    // Password check returns a match, then game doc fetch returns the game
    firestore.getDoc
      .mockResolvedValueOnce({ exists: () => true, data: () => ({ password: 'SECRET' }) })
      .mockResolvedValueOnce({ exists: () => false }); // uniqueness check for new game ID

    // onSnapshot fires synchronously with the game data when the listener is registered
    firestore.onSnapshot.mockImplementationOnce((_ref: any, cb: (s: any) => void) => {
      cb({ exists: () => true, id: 'game-abc', data: () => gameData });
      return jest.fn();
    });

    const { result } = renderHook(() => useGame(), { wrapper });

    await act(async () => {
      try { await result.current.enterGame('SECRET'); } catch (_) {}
    });

    firestore.updateDoc.mockClear();

    await act(async () => {
      await result.current.setGameType('basket');
    });

    expect(firestore.updateDoc).toHaveBeenCalledWith(
      gameDoc,
      { gameType: 'basket' },
    );
  });

  it('throws when there is no active game', async () => {
    const firestore = require('firebase/firestore');
    firestore.updateDoc.mockClear();

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => {
      await expect(result.current.setGameType('mirror')).rejects.toThrow('Only the admin can update this setting');
    });

    expect(firestore.updateDoc).not.toHaveBeenCalled();
  });
});
