import { act, renderHook } from '@testing-library/react-native';
import React from 'react';
import { GameProvider, useGame } from '../contexts/GameContext';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-1', displayName: 'Alice', email: 'alice@example.com' },
    isSignedIn: true,
  }),
}));

// resetMocks:true clears implementations before each test — restore them here
beforeEach(() => {
  const firestore = require('firebase/firestore');
  firestore.doc.mockReturnValue({ path: 'games/test-id' });
  firestore.getDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
  firestore.setDoc.mockResolvedValue(undefined);
  firestore.updateDoc.mockResolvedValue(undefined);
  firestore.onSnapshot.mockReturnValue(jest.fn()); // unsubscribe
  firestore.arrayUnion.mockImplementation((val: any) => val);
  firestore.serverTimestamp.mockReturnValue(new Date());
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <GameProvider>{children}</GameProvider>
);

describe('GameContext', () => {
  describe('useGame hook', () => {
    it('throws when used outside GameProvider', () => {
      const { result } = renderHook(() => {
        try { return useGame(); } catch (e) { return e as Error; }
      });
      expect((result.current as Error).message).toContain('useGame must be used within a GameProvider');
    });
  });

  describe('initial state', () => {
    it('starts with currentGame null and loading false', () => {
      const { result } = renderHook(() => useGame(), { wrapper });
      expect(result.current.currentGame).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it('exposes all required action functions', () => {
      const { result } = renderHook(() => useGame(), { wrapper });
      const fns = [
        'createGame', 'joinGame', 'enterGame', 'leaveGame', 'startGame',
        'submitComment', 'showComments', 'awardCommentPoints', 'finishAwardingPoints',
        'startNextRound', 'givePointsToTarget', 'startGuessingPhase',
        'finalizeGuessingPhase', 'submitGuess', 'markPlayerGuessesSubmitted',
        'updateAdminWritesComments', 'updateShowSurnames', 'updateTargetSelectionMode',
        'updateShowGuessResults', 'startPostGuessingPointPhase',
        'awardPointsToPlayers', 'skipPostCommentPhase', 'setGameType',
      ];
      for (const fn of fns) {
        expect(typeof (result.current as any)[fn]).toBe('function');
      }
    });
  });

  describe('leaveGame', () => {
    it('can be called without an active game without throwing', async () => {
      const { result } = renderHook(() => useGame(), { wrapper });
      await act(async () => { await result.current.leaveGame(); });
      expect(result.current.currentGame).toBeNull();
    });
  });

  describe('enterGame — admin password creates a game', () => {
    it('calls setDoc when input matches admin password', async () => {
      const firestore = require('firebase/firestore');
      // First getDoc: password check (matches)
      // Second getDoc: game ID uniqueness check (not exists → ID is free)
      firestore.getDoc
        .mockResolvedValueOnce({ exists: () => true, data: () => ({ password: 'SECRET' }) })
        .mockResolvedValueOnce({ exists: () => false });

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        try { await result.current.enterGame('SECRET'); } catch (_) {}
      });

      expect(firestore.setDoc).toHaveBeenCalled();
    });
  });

  describe('enterGame — game ID joins a game', () => {
    it('calls updateDoc when input does not match admin password', async () => {
      const firestore = require('firebase/firestore');
      const gameData = {
        adminId: 'admin-1', adminName: 'Bob', adminEmail: 'bob@example.com',
        status: 'waiting', participants: [], rounds: [], scores: {},
        guessingData: { commentsByTarget: {}, possibleAuthors: [] },
        guessResults: {}, createdAt: new Date(), currentRound: null,
      };
      // getDoc calls: password check (no match), then game doc fetch
      firestore.getDoc
        .mockResolvedValueOnce({ exists: () => true, data: () => ({ password: 'SECRET' }) })
        .mockResolvedValueOnce({ exists: () => true, id: 'some-game', data: () => gameData });

      firestore.onSnapshot.mockImplementationOnce((_ref: any, cb: (s: any) => void) => {
        cb({
          exists: () => true, id: 'some-game',
          data: () => ({ ...gameData, participants: [{ userId: 'user-1', userName: 'Alice', userEmail: 'alice@example.com', joinedAt: new Date() }] }),
        });
        return jest.fn();
      });

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        try { await result.current.enterGame('some-game'); } catch (_) {}
      });

      expect(firestore.updateDoc).toHaveBeenCalled();
    });
  });

  describe('onSnapshot listener', () => {
    it('clears currentGame when the game document is deleted', async () => {
      const firestore = require('firebase/firestore');
      let snapshotCb: ((s: any) => void) | null = null;

      firestore.getDoc
        .mockResolvedValueOnce({ exists: () => true, data: () => ({ password: 'SECRET' }) })
        .mockResolvedValueOnce({ exists: () => false });

      firestore.onSnapshot.mockImplementationOnce((_ref: any, cb: (s: any) => void) => {
        snapshotCb = cb;
        cb({
          exists: () => true, id: 'g1',
          data: () => ({
            adminId: 'user-1', adminName: 'Alice', adminEmail: 'alice@example.com',
            status: 'waiting',
            participants: [{ userId: 'user-1', userName: 'Alice', userEmail: 'alice@example.com', joinedAt: new Date() }],
            rounds: [], scores: {}, guessingData: { commentsByTarget: {}, possibleAuthors: [] },
            guessResults: {}, createdAt: new Date(), currentRound: null,
          }),
        });
        return jest.fn();
      });

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        try { await result.current.enterGame('SECRET'); } catch (_) {}
      });

      // Simulate game document being deleted
      await act(async () => { snapshotCb?.({ exists: () => false }); });

      expect(result.current.currentGame).toBeNull();
    });
  });
});
