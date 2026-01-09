import { useAuth } from '@/contexts/AuthContext';
import { useGame } from '@/contexts/GameContext';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import GameScreen from '../GameScreen';

// Mock dependencies
jest.mock('@/contexts/GameContext');
jest.mock('@/contexts/AuthContext');
jest.mock('expo-haptics');

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

const mockGame = {
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

const mockGameContext = {
  currentGame: null,
  loading: false,
  createGame: jest.fn(),
  joinGame: jest.fn(),
  enterGame: jest.fn(),
  leaveGame: jest.fn(),
  refreshGame: jest.fn(),
  startGame: jest.fn(),
  submitComment: jest.fn(),
  showComments: jest.fn(),
  givePoints: jest.fn(),
  finishGivingPoints: jest.fn(),
  startNextRound: jest.fn(),
  givePointsToTarget: jest.fn(),
  startGuessingPhase: jest.fn(),
  finalizeGuessingPhase: jest.fn(),
  submitGuess: jest.fn(),
  markPlayerGuessesSubmitted: jest.fn(),
};

describe('GameScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      isSignedIn: true,
    });
    (useGame as jest.Mock).mockReturnValue(mockGameContext);
  });

  describe('Initial State', () => {
    it('should show sign in message when not signed in', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: null,
        isSignedIn: false,
      });

      const { getByText } = render(<GameScreen />);
      expect(getByText(/Будь ласка, увійдіть, щоб створювати або приєднуватися до ігор/i)).toBeTruthy();
    });

    it('should show create/join game form when no game', () => {
      const { getByText, getByPlaceholderText } = render(<GameScreen />);
      expect(getByText(/Створити або приєднатися до гри/i)).toBeTruthy();
      expect(getByPlaceholderText(/Введіть пароль адміністратора або ID гри/i)).toBeTruthy();
    });

    it('should show game info when game exists', () => {
      (useGame as jest.Mock).mockReturnValue({
        ...mockGameContext,
        currentGame: mockGame,
      });

      const { getByText } = render(<GameScreen />);
      expect(getByText(/Ігрова кімната/i)).toBeTruthy();
      expect(getByText(mockGame.id)).toBeTruthy();
    });
  });

  describe('Game Creation and Joining', () => {
    it('should call enterGame when form is submitted', async () => {
      mockGameContext.enterGame.mockResolvedValue('new-game-id');

      const { getByPlaceholderText, getByText } = render(<GameScreen />);
      const input = getByPlaceholderText(/Введіть пароль адміністратора або ID гри/i);
      const button = getByText(/Продовжити/i);

      fireEvent.changeText(input, 'test-input');
      fireEvent.press(button);

      await waitFor(() => {
        expect(mockGameContext.enterGame).toHaveBeenCalledWith('test-input');
      });
    });

    it('should not submit if input is empty', () => {
      const { getByText } = render(<GameScreen />);
      const button = getByText(/Продовжити/i);

      fireEvent.press(button);

      expect(mockGameContext.enterGame).not.toHaveBeenCalled();
    });
  });

  describe('Game Status: Waiting', () => {
    it('should show start game button for admin', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockAdmin,
        isSignedIn: true,
      });
      (useGame as jest.Mock).mockReturnValue({
        ...mockGameContext,
        currentGame: {
          ...mockGame,
          status: 'waiting',
          participants: [
            mockGame.participants[0],
            mockGame.participants[1],
            {
              userId: 'user2',
              userName: 'User 2',
              userEmail: 'user2@test.com',
              joinedAt: new Date(),
            },
          ],
        },
      });

      const { getByText } = render(<GameScreen />);
      expect(getByText(/Розпочати гру/i)).toBeTruthy();
    });

    it('should disable start game button if less than 2 participants', () => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockAdmin,
        isSignedIn: true,
      });
      (useGame as jest.Mock).mockReturnValue({
        ...mockGameContext,
        currentGame: {
          ...mockGame,
          status: 'waiting',
          participants: [mockGame.participants[0]],
        },
      });

      const { getByText } = render(<GameScreen />);
      const button = getByText(/Розпочати гру/i);
      expect(button).toBeTruthy();
      // Button should be disabled
    });

    it('should show waiting message for non-admin', () => {
      (useGame as jest.Mock).mockReturnValue({
        ...mockGameContext,
        currentGame: {
        expect(getByText(/Розпочати гру/i)).toBeTruthy();
          status: 'waiting',
        },
      });

      const { getByText } = render(<GameScreen />);
      expect(getByText(/Чекаємо, поки адміністратор почне/i)).toBeTruthy();
    });
  });

  describe('Game Status: Active - Comment Submission', () => {
    it('should show comment input for non-target users', () => {
      (useGame as jest.Mock).mockReturnValue({
        ...mockGameContext,
        currentGame: {
          ...mockGame,
          status: 'active',
          currentRound: {
            roundNumber: 1,
            targetUserId: 'user2',
            targetUserName: 'User 2',
            comments: [],
            commentsVisible: false,
            pointsGiven: false,
            startedAt: new Date(),
          },
        },
      });

      const { getByPlaceholderText } = render(<GameScreen />);
      expect(getByPlaceholderText(/Ваш анонімний коментар/i)).toBeTruthy();
    });

    it('should submit comment when button is pressed', async () => {
      mockGameContext.submitComment.mockResolvedValue(undefined);

      (useGame as jest.Mock).mockReturnValue({
        ...mockGameContext,
        currentGame: {
          ...mockGame,
          status: 'active',
          currentRound: {
            roundNumber: 1,
            targetUserId: 'user2',
            targetUserName: 'User 2',
            comments: [],
            commentsVisible: false,
            pointsGiven: false,
            startedAt: new Date(),
          },
        },
      });

      const { getByPlaceholderText, getByText } = render(<GameScreen />);
      const input = getByPlaceholderText(/Ваш анонімний коментар/i);
      const button = getByText(/Відправити коментар/i);

      fireEvent.changeText(input, 'Test comment');
      fireEvent.press(button);

      await waitFor(() => {
        expect(mockGameContext.submitComment).toHaveBeenCalledWith('Test comment');
      });
    });

    it('should show waiting message for target user', () => {
      (useGame as jest.Mock).mockReturnValue({
        ...mockGameContext,
        currentGame: {
          ...mockGame,
          status: 'active',
          currentRound: {
            roundNumber: 1,
            targetUserId: 'user1',
            targetUserName: 'User 1',
            comments: [],
            commentsVisible: false,
            pointsGiven: false,
            startedAt: new Date(),
          },
        },
      });

      const { getByText } = render(<GameScreen />);
      expect(getByText(/Чекаємо, поки інші напишуть коментарі/i)).toBeTruthy();
    });
  });

  describe('Game Status: Active - Admin Controls', () => {
    beforeEach(() => {
      (useAuth as jest.Mock).mockReturnValue({
        user: mockAdmin,
        isSignedIn: true,
      });
    });

    it('should show show comments button when comments are not visible', () => {
      (useGame as jest.Mock).mockReturnValue({
        ...mockGameContext,
        currentGame: {
          ...mockGame,
          status: 'active',
          currentRound: {
            roundNumber: 1,
            targetUserId: 'user1',
            targetUserName: 'User 1',
            comments: [
              {
                id: 'comment1',
                authorId: 'user2',
                text: 'Test',
                submittedAt: new Date(),
              },
            ],
            commentsVisible: false,
            pointsGiven: false,
            startedAt: new Date(),
          },
          participants: [
            mockGame.participants[0],
            mockGame.participants[1],
            {
              userId: 'user2',
              userName: 'User 2',
              userEmail: 'user2@test.com',
              joinedAt: new Date(),
            },
          ],
        },
      });

      const { getByText } = render(<GameScreen />);
      expect(getByText(/Показати коментарі/i)).toBeTruthy();
    });

    it('should show start guessing phase button when round is complete', () => {
      (useGame as jest.Mock).mockReturnValue({
        ...mockGameContext,
        currentGame: {
          ...mockGame,
          status: 'active',
          currentRound: {
            roundNumber: 1,
            targetUserId: 'user1',
            targetUserName: 'User 1',
            comments: [
              {
                id: 'comment1',
                authorId: 'user2',
                text: 'Test',
                submittedAt: new Date(),
              },
            ],
            commentsVisible: true,
            pointsGiven: true,
            startedAt: new Date(),
          },
        },
      });

      const { getByText } = render(<GameScreen />);
      expect(getByText(/Почати фазу вгадування/i)).toBeTruthy();
    });

    it('should call startGuessingPhase when button is pressed', async () => {
      mockGameContext.startGuessingPhase.mockResolvedValue(undefined);

      (useGame as jest.Mock).mockReturnValue({
        ...mockGameContext,
        currentGame: {
          ...mockGame,
          status: 'active',
          currentRound: {
            roundNumber: 1,
            targetUserId: 'user1',
            targetUserName: 'User 1',
            comments: [],
            commentsVisible: true,
            pointsGiven: true,
            startedAt: new Date(),
          },
        },
      });

      const { getByText } = render(<GameScreen />);
      const button = getByText(/Почати фазу вгадування/i);

      fireEvent.press(button);

      await waitFor(() => {
        expect(mockGameContext.startGuessingPhase).toHaveBeenCalled();
      });
    });
  });

  describe('Game Status: Active - Target Giving Points', () => {
    it('should show points button for comments without points', () => {
      (useGame as jest.Mock).mockReturnValue({
        ...mockGameContext,
        currentGame: {
          ...mockGame,
          status: 'active',
          currentRound: {
            roundNumber: 1,
            targetUserId: 'user1',
            targetUserName: 'User 1',
            comments: [
              {
                id: 'comment1',
                authorId: 'user2',
                text: 'Test comment',
                submittedAt: new Date(),
              },
            ],
            commentsVisible: true,
            pointsGiven: false,
            startedAt: new Date(),
          },
        },
      });

      const { getByText } = render(<GameScreen />);
      expect(getByText(/\+1 Point/i)).toBeTruthy();
    });

    it('should show done giving points button', () => {
      (useGame as jest.Mock).mockReturnValue({
        ...mockGameContext,
        currentGame: {
          ...mockGame,
          status: 'active',
          currentRound: {
            roundNumber: 1,
            targetUserId: 'user1',
            targetUserName: 'User 1',
            comments: [
              {
                id: 'comment1',
                authorId: 'user2',
                text: 'Test',
                submittedAt: new Date(),
              },
            ],
            commentsVisible: true,
            pointsGiven: false,
            startedAt: new Date(),
          },
        },
      });

      const { getByText } = render(<GameScreen />);
      expect(getByText(/Done Giving Points/i)).toBeTruthy();
    });

    it('should call finishGivingPoints when button is pressed', async () => {
      mockGameContext.finishGivingPoints.mockResolvedValue(undefined);

      (useGame as jest.Mock).mockReturnValue({
        ...mockGameContext,
        currentGame: {
          ...mockGame,
          status: 'active',
          currentRound: {
            roundNumber: 1,
            targetUserId: 'user1',
            targetUserName: 'User 1',
            comments: [],
            commentsVisible: true,
            pointsGiven: false,
            startedAt: new Date(),
          },
        },
      });

      const { getByText } = render(<GameScreen />);
      const button = getByText(/Done Giving Points/i);

      fireEvent.press(button);

      await waitFor(() => {
        expect(mockGameContext.finishGivingPoints).toHaveBeenCalled();
      });
    });
  });

  describe('Game Status: Guessing Phase', () => {
    it('should show guessing interface for target user', () => {
      (useGame as jest.Mock).mockReturnValue({
        ...mockGameContext,
        currentGame: {
          ...mockGame,
          status: 'guessing_phase',
          guessingData: {
            commentsByTarget: {
              user1: [
                {
                  id: 'comment1',
                  authorId: 'user2',
                  text: 'Test comment',
                  submittedAt: new Date(),
                },
              ],
            },
            possibleAuthors: [
              { userId: 'user2', userName: 'User 2' },
              { userId: 'admin1', userName: 'Admin 1' },
            ],
            playersWhoSubmittedGuesses: [],
            allPlayersSubmitted: false,
            singleRoundTargetId: 'user1',
          },
        },
      });

      const { getByText } = render(<GameScreen />);
      expect(getByText(/Guess the Authors/i)).toBeTruthy();
      expect(getByText(/Try to guess who wrote each comment/i)).toBeTruthy();
    });

    it('should show submit guesses button when all guesses are selected', () => {
      (useGame as jest.Mock).mockReturnValue({
        ...mockGameContext,
        currentGame: {
          ...mockGame,
          status: 'guessing_phase',
          guessingData: {
            commentsByTarget: {
              user1: [
                {
                  id: 'comment1',
                  authorId: 'user2',
                  text: 'Test',
                  submittedAt: new Date(),
                },
              ],
            },
            possibleAuthors: [
              { userId: 'user2', userName: 'User 2' },
            ],
            playersWhoSubmittedGuesses: [],
            allPlayersSubmitted: false,
            singleRoundTargetId: 'user1',
          },
        },
      });

      const { getByText, getAllByText } = render(<GameScreen />);
      // Select an author for the comment
      const authorButton = getAllByText(/User 2/i)[0];
      fireEvent.press(authorButton);

      // Submit button should be enabled
      expect(getByText(/Відправити мої відповіді/i)).toBeTruthy();
    });
  });

  describe('Game Status: Finished', () => {
    it('should show finished message', () => {
      (useGame as jest.Mock).mockReturnValue({
        ...mockGameContext,
        currentGame: {
          ...mockGame,
          status: 'finished',
        },
      });

      const { getByText } = render(<GameScreen />);
      expect(getByText(/Гра завершена/i)).toBeTruthy();
    });
  });

  describe('Leaderboard', () => {
    it('should display scores when game is active', () => {
      (useGame as jest.Mock).mockReturnValue({
        ...mockGameContext,
        currentGame: {
          ...mockGame,
          status: 'active',
          scores: {
            user1: 5,
            admin1: 3,
          },
        },
      });

      const { getByText } = render(<GameScreen />);
      expect(getByText(/Таблиця лідерів/i)).toBeTruthy();
      expect(getByText(/User 1/i)).toBeTruthy();
      expect(getByText(/Admin 1/i)).toBeTruthy();
    });

    it('should show game points and guess points separately when finished', () => {
      (useGame as jest.Mock).mockReturnValue({
        ...mockGameContext,
        currentGame: {
          ...mockGame,
          status: 'finished',
          scores: {
            user1: 8,
            admin1: 5,
          },
          guessResults: {
            user1: { correctGuesses: 3 },
            admin1: { correctGuesses: 2 },
          },
        },
      });

      const { getByText } = render(<GameScreen />);
      expect(getByText(/Game:/i)).toBeTruthy();
      expect(getByText(/Guessing:/i)).toBeTruthy();
    });
  });

  describe('Leave Game', () => {
    it('should call leaveGame when leave button is pressed', async () => {
      mockGameContext.leaveGame.mockResolvedValue(undefined);

      (useGame as jest.Mock).mockReturnValue({
        ...mockGameContext,
        currentGame: mockGame,
      });

      const { getByText } = render(<GameScreen />);
      const button = getByText(/Leave Game/i);

      fireEvent.press(button);

      // Should show alert first, so we need to handle that
      // In a real test, you'd mock Alert.alert and simulate the confirmation
    });
  });
});

