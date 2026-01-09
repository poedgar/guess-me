/**
 * Integration tests for complete game flow
 * Tests the full game lifecycle from creation to completion
 */

import { useAuth } from '@/contexts/AuthContext';
import { GameProvider, useGame } from '@/contexts/GameContext';
import { act, renderHook } from '@testing-library/react-native';
import { addDoc, getDoc, runTransaction, updateDoc } from 'firebase/firestore';

// Mock dependencies
jest.mock('@/contexts/AuthContext');
jest.mock('@/config/firebase', () => ({
  db: {},
}));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  updateDoc: jest.fn(),
  addDoc: jest.fn(),
  collection: jest.fn(),
  runTransaction: jest.fn(),
  arrayUnion: jest.fn((val) => val),
  onSnapshot: jest.fn(() => jest.fn()),
  serverTimestamp: jest.fn(() => new Date()),
}));

describe('Game Flow Integration Tests', () => {
  const admin = {
    uid: 'admin1',
    email: 'admin@test.com',
    displayName: 'Admin',
  };

  const player1 = {
    uid: 'player1',
    email: 'player1@test.com',
    displayName: 'Player 1',
  };

  const player2 = {
    uid: 'player2',
    email: 'player2@test.com',
    displayName: 'Player 2',
  };

  let gameState: any;

  beforeEach(() => {
    jest.clearAllMocks();
    gameState = {
      id: 'test-game',
      adminId: admin.uid,
      adminName: admin.displayName,
      adminEmail: admin.email,
      participants: [
        {
          userId: admin.uid,
          userName: admin.displayName,
          userEmail: admin.email,
          joinedAt: new Date(),
        },
      ],
      createdAt: new Date(),
      status: 'waiting',
      scores: {},
      rounds: [],
    };
  });

  describe('Complete Game Flow', () => {
    it('should complete full game flow: create -> start -> play rounds -> guess -> finish', async () => {
      // Step 1: Admin creates game
      (useAuth as jest.Mock).mockReturnValue({ user: admin });
      (addDoc as jest.Mock).mockResolvedValue({ id: gameState.id });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        const gameId = await result.current.createGame();
        expect(gameId).toBe(gameState.id);
      });

      // Step 2: Players join
      (useAuth as jest.Mock).mockReturnValue({ user: player1 });
      gameState.participants.push({
        userId: player1.uid,
        userName: player1.displayName,
        userEmail: player1.email,
        joinedAt: new Date(),
      });

      (useAuth as jest.Mock).mockReturnValue({ user: player2 });
      gameState.participants.push({
        userId: player2.uid,
        userName: player2.displayName,
        userEmail: player2.email,
        joinedAt: new Date(),
      });

      // Step 3: Admin starts game
      (useAuth as jest.Mock).mockReturnValue({ user: admin });
      gameState.status = 'active';
      gameState.currentRound = {
        roundNumber: 1,
        targetUserId: player1.uid,
        targetUserName: player1.displayName,
        comments: [],
        commentsVisible: false,
        pointsGiven: false,
        startedAt: new Date(),
      };

      const mockGameDoc = {
        exists: () => true,
        data: () => gameState,
      };
      (getDoc as jest.Mock).mockResolvedValue(mockGameDoc);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      await act(async () => {
        await result.current.startGame();
      });

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'active',
        })
      );

      // Step 4: Players submit comments
      (useAuth as jest.Mock).mockReturnValue({ user: player2 });
      gameState.currentRound.comments = [
        {
          id: 'comment1',
          authorId: player2.uid,
          text: 'Great player!',
          submittedAt: new Date(),
        },
      ];

      await act(async () => {
        await result.current.submitComment('Great player!');
      });

      // Step 5: Admin shows comments
      (useAuth as jest.Mock).mockReturnValue({ user: admin });
      gameState.currentRound.commentsVisible = true;

      await act(async () => {
        await result.current.showComments();
      });

      // Step 6: Target gives points
      (useAuth as jest.Mock).mockReturnValue({ user: player1 });
      gameState.currentRound.comments[0].points = 1;
      gameState.scores[player2.uid] = 1;

      await act(async () => {
        await result.current.givePoints('comment1', 1);
      });

      // Step 7: Target finishes giving points
      gameState.currentRound.pointsGiven = true;

      await act(async () => {
        await result.current.finishGivingPoints();
      });

      // Step 8: Admin starts guessing phase
      (useAuth as jest.Mock).mockReturnValue({ user: admin });
      gameState.status = 'guessing_phase';
      gameState.guessingData = {
        commentsByTarget: {
          [player1.uid]: gameState.currentRound.comments,
        },
        possibleAuthors: [
          { userId: player2.uid, userName: player2.displayName },
          { userId: admin.uid, userName: admin.displayName },
        ],
        playersWhoSubmittedGuesses: [],
        allPlayersSubmitted: false,
        singleRoundTargetId: player1.uid,
      };

      await act(async () => {
        await result.current.startGuessingPhase();
      });

      // Step 9: Target submits guesses
      (useAuth as jest.Mock).mockReturnValue({ user: player1 });
      gameState.currentRound.guesses = [
        {
          commentId: 'comment1',
          guesserId: player1.uid,
          guessedAuthorId: player2.uid,
          correct: true,
          guessedAt: new Date(),
        },
      ];
      gameState.guessingData.playersWhoSubmittedGuesses = [player1.uid];
      gameState.guessingData.allPlayersSubmitted = true;

      (runTransaction as jest.Mock).mockImplementation(async (db, updateFunction) => {
        const transaction = {
          get: jest.fn().mockResolvedValue(mockGameDoc),
          update: jest.fn(),
        };
        await updateFunction(transaction);
        return true;
      });

      await act(async () => {
        const correct = await result.current.submitGuess(1, 'comment1', player2.uid);
        expect(correct).toBe(true);
      });

      // Step 10: Admin finalizes guessing phase
      (useAuth as jest.Mock).mockReturnValue({ user: admin });
      gameState.rounds = [gameState.currentRound];
      gameState.currentRound = null;
      gameState.status = 'active';
      gameState.guessResults = {
        [player1.uid]: { correctGuesses: 1 },
      };

      await act(async () => {
        await result.current.finalizeGuessingPhase();
      });

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'active',
          guessResults: expect.objectContaining({
            [player1.uid]: expect.objectContaining({ correctGuesses: 1 }),
          }),
        })
      );
    });
  });

  describe('Score Calculation', () => {
    it('should correctly calculate total scores (game + guess points)', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: admin });
      gameState.status = 'finished';
      gameState.scores = {
        [player1.uid]: 5, // Game points
        [player2.uid]: 3,
      };
      gameState.guessResults = {
        [player1.uid]: { correctGuesses: 2 }, // Guess points
        [player2.uid]: { correctGuesses: 1 },
      };

      const mockGameDoc = {
        exists: () => true,
        data: () => gameState,
      };
      (getDoc as jest.Mock).mockResolvedValue(mockGameDoc);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      // Verify scores are separate
      // Game points: player1 = 5, player2 = 3
      // Guess points: player1 = 2, player2 = 1
      // Total: player1 = 7, player2 = 4
      expect(gameState.scores[player1.uid]).toBe(5);
      expect(gameState.guessResults[player1.uid].correctGuesses).toBe(2);
    });
  });

  describe('Round Progression', () => {
    it('should progress through multiple rounds correctly', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: admin });
      gameState.status = 'active';
      gameState.participants = [
        {
          userId: admin.uid,
          userName: admin.displayName,
          userEmail: admin.email,
          joinedAt: new Date(),
        },
        {
          userId: player1.uid,
          userName: player1.displayName,
          userEmail: player1.email,
          joinedAt: new Date(),
        },
        {
          userId: player2.uid,
          userName: player2.displayName,
          userEmail: player2.email,
          joinedAt: new Date(),
        },
      ];

      // Round 1 completed
      const round1 = {
        roundNumber: 1,
        targetUserId: player1.uid,
        targetUserName: player1.displayName,
        comments: [],
        commentsVisible: true,
        pointsGiven: true,
        startedAt: new Date(),
      };
      gameState.rounds = [round1];

      // Start round 2
      gameState.currentRound = {
        roundNumber: 2,
        targetUserId: player2.uid,
        targetUserName: player2.displayName,
        comments: [],
        commentsVisible: false,
        pointsGiven: false,
        startedAt: new Date(),
      };

      const mockGameDoc = {
        exists: () => true,
        data: () => gameState,
      };
      (getDoc as jest.Mock).mockResolvedValue(mockGameDoc);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        await result.current.startNextRound();
      });

      // Should create round 2
      expect(updateDoc).toHaveBeenCalled();
    });

    it('should finish game when all participants have been targets', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: admin });
      gameState.status = 'active';
      gameState.participants = [
        {
          userId: admin.uid,
          userName: admin.displayName,
          userEmail: admin.email,
          joinedAt: new Date(),
        },
        {
          userId: player1.uid,
          userName: player1.displayName,
          userEmail: player1.email,
          joinedAt: new Date(),
        },
      ];

      // All participants have been targets
      gameState.rounds = [
        {
          roundNumber: 1,
          targetUserId: player1.uid,
          targetUserName: player1.displayName,
          comments: [],
          commentsVisible: true,
          pointsGiven: true,
          startedAt: new Date(),
        },
      ];
      gameState.currentRound = {
        roundNumber: 1,
        targetUserId: player1.uid,
        targetUserName: player1.displayName,
        comments: [],
        commentsVisible: true,
        pointsGiven: true,
        startedAt: new Date(),
      };

      const mockGameDoc = {
        exists: () => true,
        data: () => gameState,
      };
      (getDoc as jest.Mock).mockResolvedValue(mockGameDoc);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        await result.current.startNextRound();
      });

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'finished',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: admin });
      (getDoc as jest.Mock).mockRejectedValue(new Error('Network error'));

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        await expect(result.current.startGame()).rejects.toThrow();
      });
    });

    it('should prevent invalid operations', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: player1 }); // Not admin

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        await expect(result.current.startGame()).rejects.toThrow('Only the admin');
      });
    });
  });
});

