import { useAuth } from '@/contexts/AuthContext';
import { act, renderHook } from '@testing-library/react-native';
import { addDoc, getDoc, runTransaction, updateDoc } from 'firebase/firestore';
import { Comment, Game, GameProvider, Round, useGame } from '../GameContext';

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

const mockUser = {
  uid: 'user1',
  email: 'user1@test.com',
  displayName: 'User 1',
};

const mockAdmin = {
  uid: 'admin1',
  email: 'admin1@test.com',
  displayName: 'Admin 1',
};

const mockGame: Game = {
  id: 'game1',
  adminId: 'admin1',
  adminName: 'Admin 1',
  adminEmail: 'admin1@test.com',
  participants: [
    {
      userId: 'admin1',
      userName: 'Admin 1',
      userEmail: 'admin1@test.com',
      joinedAt: new Date(),
    },
    {
      userId: 'user1',
      userName: 'User 1',
      userEmail: 'user1@test.com',
      joinedAt: new Date(),
    },
  ],
  createdAt: new Date(),
  status: 'waiting',
  scores: {},
};

const mockRound: Round = {
  roundNumber: 1,
  targetUserId: 'user1',
  targetUserName: 'User 1',
  comments: [],
  commentsVisible: false,
  pointsGiven: false,
  startedAt: new Date(),
};

describe('GameContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
  });

  describe('createGame', () => {
    it('should create a new game successfully', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockAdmin });
      const mockGameId = 'new-game-id';
      (addDoc as jest.Mock).mockResolvedValue({ id: mockGameId });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        const gameId = await result.current.createGame();
        expect(gameId).toBe(mockGameId);
      });

      expect(addDoc).toHaveBeenCalled();
    });

    it('should throw error if user is not signed in', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: null });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        await expect(result.current.createGame()).rejects.toThrow('Must be signed in');
      });
    });
  });

  describe('joinGame', () => {
    it('should join an existing game successfully', async () => {
      const mockGameDoc = {
        exists: () => true,
        data: () => mockGame,
      };
      (getDoc as jest.Mock).mockResolvedValue(mockGameDoc);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        await result.current.joinGame('game1');
      });

      expect(getDoc).toHaveBeenCalled();
      expect(updateDoc).toHaveBeenCalled();
    });

    it('should throw error if game does not exist', async () => {
      const mockGameDoc = {
        exists: () => false,
      };
      (getDoc as jest.Mock).mockResolvedValue(mockGameDoc);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        await expect(result.current.joinGame('invalid-game')).rejects.toThrow('Game not found');
      });
    });
  });

  describe('startGame', () => {
    it('should start game successfully when admin', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockAdmin });
      const gameWithParticipants = {
        ...mockGame,
        participants: [
          ...mockGame.participants,
          {
            userId: 'user2',
            userName: 'User 2',
            userEmail: 'user2@test.com',
            joinedAt: new Date(),
          },
        ],
      };
      const mockGameDoc = {
        exists: () => true,
        data: () => gameWithParticipants,
      };
      (getDoc as jest.Mock).mockResolvedValue(mockGameDoc);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        await result.current.startGame();
      });

      expect(updateDoc).toHaveBeenCalled();
    });

    it('should throw error if not admin', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        await expect(result.current.startGame()).rejects.toThrow('Only the admin can start the game');
      });
    });

    it('should throw error if less than 2 participants', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockAdmin });
      const gameWithOneParticipant = {
        ...mockGame,
        participants: [mockGame.participants[0]],
      };
      const mockGameDoc = {
        exists: () => true,
        data: () => gameWithOneParticipant,
      };
      (getDoc as jest.Mock).mockResolvedValue(mockGameDoc);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        await expect(result.current.startGame()).rejects.toThrow('Need at least 2 participants');
      });
    });
  });

  describe('submitComment', () => {
    it('should submit comment successfully', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      const gameWithRound = {
        ...mockGame,
        status: 'active',
        currentRound: mockRound,
      };
      const mockGameDoc = {
        exists: () => true,
        data: () => gameWithRound,
      };
      (getDoc as jest.Mock).mockResolvedValue(mockGameDoc);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        await result.current.submitComment('Great comment!');
      });

      expect(updateDoc).toHaveBeenCalled();
    });

    it('should throw error if user is the target', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      const gameWithRound = {
        ...mockGame,
        status: 'active',
        currentRound: {
          ...mockRound,
          targetUserId: 'user1',
        },
      };
      const mockGameDoc = {
        exists: () => true,
        data: () => gameWithRound,
      };
      (getDoc as jest.Mock).mockResolvedValue(mockGameDoc);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        await expect(result.current.submitComment('Comment')).rejects.toThrow('Target cannot comment');
      });
    });
  });

  describe('showComments', () => {
    it('should show comments when admin', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockAdmin });
      const gameWithRound = {
        ...mockGame,
        status: 'active',
        currentRound: mockRound,
      };
      const mockGameDoc = {
        exists: () => true,
        data: () => gameWithRound,
      };
      (getDoc as jest.Mock).mockResolvedValue(mockGameDoc);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        await result.current.showComments();
      });

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'currentRound.commentsVisible': true,
        })
      );
    });

    it('should throw error if not admin', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        await expect(result.current.showComments()).rejects.toThrow('Only the admin can show comments');
      });
    });
  });

  describe('givePoints', () => {
    it('should give points to comment successfully', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      const comment: Comment = {
        id: 'comment1',
        authorId: 'user2',
        text: 'Test comment',
        submittedAt: new Date(),
      };
      const gameWithRound = {
        ...mockGame,
        status: 'active',
        currentRound: {
          ...mockRound,
          targetUserId: 'user1',
          comments: [comment],
          commentsVisible: true,
        },
      };
      const mockGameDoc = {
        exists: () => true,
        data: () => gameWithRound,
      };
      (getDoc as jest.Mock).mockResolvedValue(mockGameDoc);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        await result.current.givePoints('comment1', 1);
      });

      expect(updateDoc).toHaveBeenCalled();
    });

    it('should throw error if not the target', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      const gameWithRound = {
        ...mockGame,
        status: 'active',
        currentRound: {
          ...mockRound,
          targetUserId: 'user2', // Different user
        },
      };
      const mockGameDoc = {
        exists: () => true,
        data: () => gameWithRound,
      };
      (getDoc as jest.Mock).mockResolvedValue(mockGameDoc);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        await expect(result.current.givePoints('comment1', 1)).rejects.toThrow('Only the target person');
      });
    });
  });

  describe('finishGivingPoints', () => {
    it('should mark points as given successfully', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      const gameWithRound = {
        ...mockGame,
        status: 'active',
        currentRound: {
          ...mockRound,
          targetUserId: 'user1',
          commentsVisible: true,
          pointsGiven: false,
        },
      };
      const mockGameDoc = {
        exists: () => true,
        data: () => gameWithRound,
      };
      (getDoc as jest.Mock).mockResolvedValue(mockGameDoc);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        await result.current.finishGivingPoints();
      });

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          'currentRound.pointsGiven': true,
        })
      );
    });

    it('should throw error if not the target', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      const gameWithRound = {
        ...mockGame,
        status: 'active',
        currentRound: {
          ...mockRound,
          targetUserId: 'user2', // Different user
        },
      };
      const mockGameDoc = {
        exists: () => true,
        data: () => gameWithRound,
      };
      (getDoc as jest.Mock).mockResolvedValue(mockGameDoc);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        await expect(result.current.finishGivingPoints()).rejects.toThrow('Only the target can finish');
      });
    });
  });

  describe('givePointsToTarget', () => {
    it('should give points to target successfully', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      const gameWithRound = {
        ...mockGame,
        status: 'active',
        currentRound: {
          ...mockRound,
          commentsVisible: true,
          pointsGiven: true,
        },
      };
      const mockGameDoc = {
        exists: () => true,
        data: () => gameWithRound,
      };
      (getDoc as jest.Mock).mockResolvedValue(mockGameDoc);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        await result.current.givePointsToTarget('user1', 1);
      });

      expect(updateDoc).toHaveBeenCalled();
    });

    it('should prevent duplicate points to target', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      const gameWithRound = {
        ...mockGame,
        status: 'active',
        currentRound: {
          ...mockRound,
          commentsVisible: true,
          pointsGiven: true,
          targetPointsGivenBy: ['user1'], // Already gave points
        },
      };
      const mockGameDoc = {
        exists: () => true,
        data: () => gameWithRound,
      };
      (getDoc as jest.Mock).mockResolvedValue(mockGameDoc);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        await expect(result.current.givePointsToTarget('user1', 1)).rejects.toThrow('already gave points');
      });
    });
  });

  describe('startNextRound', () => {
    it('should start next round successfully', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockAdmin });
      const completedRound: Round = {
        ...mockRound,
        commentsVisible: true,
        pointsGiven: true,
      };
      const gameWithCompletedRound = {
        ...mockGame,
        status: 'active',
        currentRound: completedRound,
        rounds: [],
        participants: [
          ...mockGame.participants,
          {
            userId: 'user2',
            userName: 'User 2',
            userEmail: 'user2@test.com',
            joinedAt: new Date(),
          },
        ],
      };
      const mockGameDoc = {
        exists: () => true,
        data: () => gameWithCompletedRound,
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

      expect(updateDoc).toHaveBeenCalled();
    });

    it('should finish game if no more participants', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockAdmin });
      const completedRound: Round = {
        ...mockRound,
        commentsVisible: true,
        pointsGiven: true,
      };
      const gameWithCompletedRound = {
        ...mockGame,
        status: 'active',
        currentRound: completedRound,
        rounds: [completedRound], // All participants have been targets
      };
      const mockGameDoc = {
        exists: () => true,
        data: () => gameWithCompletedRound,
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

  describe('startGuessingPhase', () => {
    it('should start guessing phase for completed round', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockAdmin });
      const completedRound: Round = {
        ...mockRound,
        commentsVisible: true,
        pointsGiven: true,
        comments: [
          {
            id: 'comment1',
            authorId: 'user2',
            text: 'Test',
            submittedAt: new Date(),
          },
        ],
      };
      const gameWithCompletedRound = {
        ...mockGame,
        status: 'active',
        currentRound: completedRound,
        rounds: [],
      };
      const mockGameDoc = {
        exists: () => true,
        data: () => gameWithCompletedRound,
      };
      (getDoc as jest.Mock).mockResolvedValue(mockGameDoc);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        await result.current.startGuessingPhase();
      });

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'guessing_phase',
        })
      );
    });

    it('should throw error if not admin', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        await expect(result.current.startGuessingPhase()).rejects.toThrow('Only the admin can start');
      });
    });
  });

  describe('submitGuess', () => {
    it('should submit guess successfully', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      const roundWithComments: Round = {
        ...mockRound,
        targetUserId: 'user1',
        commentsVisible: true,
        comments: [
          {
            id: 'comment1',
            authorId: 'user2',
            text: 'Test',
            submittedAt: new Date(),
          },
        ],
      };
      const gameWithRound = {
        ...mockGame,
        status: 'guessing_phase',
        currentRound: roundWithComments,
      };
      const mockGameDoc = {
        exists: () => true,
        data: () => gameWithRound,
      };
      (getDoc as jest.Mock).mockResolvedValue(mockGameDoc);
      (runTransaction as jest.Mock).mockImplementation(async (db, updateFunction) => {
        const transaction = {
          get: jest.fn().mockResolvedValue(mockGameDoc),
          update: jest.fn(),
        };
        await updateFunction(transaction);
        return true;
      });
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        const correct = await result.current.submitGuess(1, 'comment1', 'user2');
        expect(correct).toBe(true); // Correct guess
      });

      expect(runTransaction).toHaveBeenCalled();
    });

    it('should return false for incorrect guess', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      const roundWithComments: Round = {
        ...mockRound,
        targetUserId: 'user1',
        commentsVisible: true,
        comments: [
          {
            id: 'comment1',
            authorId: 'user2',
            text: 'Test',
            submittedAt: new Date(),
          },
        ],
      };
      const gameWithRound = {
        ...mockGame,
        status: 'guessing_phase',
        currentRound: roundWithComments,
      };
      const mockGameDoc = {
        exists: () => true,
        data: () => gameWithRound,
      };
      (getDoc as jest.Mock).mockResolvedValue(mockGameDoc);
      (runTransaction as jest.Mock).mockImplementation(async (db, updateFunction) => {
        const transaction = {
          get: jest.fn().mockResolvedValue(mockGameDoc),
          update: jest.fn(),
        };
        await updateFunction(transaction);
        return true;
      });
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        const correct = await result.current.submitGuess(1, 'comment1', 'wrong-user');
        expect(correct).toBe(false); // Incorrect guess
      });
    });

    it('should throw error if not the target', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      const roundWithComments: Round = {
        ...mockRound,
        targetUserId: 'user2', // Different user
        commentsVisible: true,
      };
      const gameWithRound = {
        ...mockGame,
        status: 'guessing_phase',
        currentRound: roundWithComments,
      };
      const mockGameDoc = {
        exists: () => true,
        data: () => gameWithRound,
      };
      (getDoc as jest.Mock).mockResolvedValue(mockGameDoc);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        await expect(result.current.submitGuess(1, 'comment1', 'user2')).rejects.toThrow('Only the target');
      });
    });
  });

  describe('finalizeGuessingPhase', () => {
    it('should finalize guessing phase and calculate scores', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockAdmin });
      const roundWithGuesses: Round = {
        ...mockRound,
        commentsVisible: true,
        pointsGiven: true,
        comments: [
          {
            id: 'comment1',
            authorId: 'user2',
            text: 'Test',
            submittedAt: new Date(),
          },
        ],
        guesses: [
          {
            commentId: 'comment1',
            guesserId: 'user1',
            guessedAuthorId: 'user2',
            correct: true,
            guessedAt: new Date(),
          },
        ],
      };
      const gameWithGuessing = {
        ...mockGame,
        status: 'guessing_phase',
        currentRound: null,
        rounds: [roundWithGuesses],
        guessingData: {
          commentsByTarget: { user1: roundWithGuesses.comments },
          possibleAuthors: [{ userId: 'user2', userName: 'User 2' }],
          singleRoundTargetId: 'user1',
          playersWhoSubmittedGuesses: ['user1'],
          allPlayersSubmitted: true,
        },
        scores: { user1: 5, user2: 3 },
      };
      const mockGameDoc = {
        exists: () => true,
        data: () => gameWithGuessing,
      };
      (getDoc as jest.Mock).mockResolvedValue(mockGameDoc);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        await result.current.finalizeGuessingPhase();
      });

      expect(updateDoc).toHaveBeenCalled();
      const updateCall = (updateDoc as jest.Mock).mock.calls[0];
      expect(updateCall[1]).toMatchObject({
        status: 'active',
        guessResults: expect.objectContaining({
          user1: expect.objectContaining({ correctGuesses: 1 }),
        }),
      });
    });

    it('should throw error if not admin', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        await expect(result.current.finalizeGuessingPhase()).rejects.toThrow('Only the admin can finalize');
      });
    });
  });

  describe('leaveGame', () => {
    it('should leave game successfully', async () => {
      (useAuth as jest.Mock).mockReturnValue({ user: mockUser });
      const mockGameDoc = {
        exists: () => true,
        data: () => ({
          ...mockGame,
          participants: mockGame.participants.filter((p) => p.userId !== 'user1'),
        }),
      };
      (getDoc as jest.Mock).mockResolvedValue(mockGameDoc);
      (updateDoc as jest.Mock).mockResolvedValue(undefined);

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <GameProvider>{children}</GameProvider>
      );

      const { result } = renderHook(() => useGame(), { wrapper });

      await act(async () => {
        await result.current.leaveGame();
      });

      expect(updateDoc).toHaveBeenCalled();
    });
  });
});

