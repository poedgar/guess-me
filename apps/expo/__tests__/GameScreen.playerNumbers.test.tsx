// TDD: GameScreen must pass a frozen playerNumbers prop (from game.playerNumbers,
// falling back to the existing dynamic joinIndexById) to ActivePhase.
import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

let capturedActivePhaseProps: any = null;
jest.mock('@/components/game/mirror/ActivePhase', () => ({
  ActivePhase: (props: any) => { capturedActivePhaseProps = props; return null; },
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/components/LanguageSelector', () => ({ LanguageSelector: () => null }));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/ui/PlayerAvatar', () => ({ PlayerAvatar: () => null }));
jest.mock('@/components/ui/TargetControlPanel', () => ({ TargetControlPanel: () => null }));
jest.mock('@/components/ui/HeaderLogo', () => ({ HeaderLogo: () => null }));
jest.mock('@/components/SoundToggle', () => ({ SoundToggle: () => null }));
jest.mock('@/components/ui/FancyAlert', () => ({ FancyAlert: () => null }));
jest.mock('@/components/ui/FaceMessage', () => ({ FaceMessage: () => null }));
jest.mock('@/components/ui/SuccessAnimation', () => ({ SuccessAnimation: () => null }));
jest.mock('@/components/game/Leaderboard', () => ({ Leaderboard: () => null }));
jest.mock('@/components/game/mirror/PostGuessingPointsPanel', () => ({ __esModule: true, default: () => null }));
jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('@/i18n', () => ({ t: (key: string) => key }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ locale: 'en', setLocale: jest.fn() }),
}));
jest.mock('@/contexts/SoundContext', () => ({
  useSound: () => ({ playSound: jest.fn() }),
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));
jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));

const mockUser = { uid: 'u1', displayName: 'Alice', email: 'alice@test.com' };
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, isSignedIn: true }),
}));

let mockCurrentGame: any = null;
jest.mock('@/contexts/GameContext', () => ({
  useGame: () => ({
    currentGame: mockCurrentGame,
    loading: false,
    enterGame: jest.fn(),
    leaveGame: jest.fn(),
    startGame: jest.fn(),
    submitComment: jest.fn(),
    showComments: jest.fn(),
    awardCommentPoints: jest.fn(),
    finishAwardingPoints: jest.fn(),
    givePointsToTarget: jest.fn(),
    startNextRound: jest.fn(),
    startGuessingPhase: jest.fn(),
    submitGuess: jest.fn(),
    finalizeGuessingPhase: jest.fn(),
    markPlayerGuessesSubmitted: jest.fn(),
    updateAdminWritesComments: jest.fn(),
    updateShowSurnames: jest.fn(),
    updateTargetSelectionMode: jest.fn(),
    updateShowGuessResults: jest.fn(),
    startPostGuessingPointPhase: jest.fn(),
    awardPointsToPlayers: jest.fn(),
    skipPostCommentPhase: jest.fn(),
    refreshGame: jest.fn(),
  }),
}));

const PARTICIPANTS = [
  { userId: 'u1', userName: 'Alice', userEmail: 'a@test.com', joinedAt: new Date(0) },
  { userId: 'u2', userName: 'Bob', userEmail: 'b@test.com', joinedAt: new Date(1) },
];

const ACTIVE_ROUND = {
  roundNumber: 1,
  targetUserId: 'u2',
  targetUserName: 'Bob',
  comments: [],
  commentsVisible: false,
  pointsGiven: false,
  startedAt: new Date(),
};

function baseGame(overrides: Record<string, unknown> = {}) {
  return {
    id: 'game-pn',
    adminId: 'u1',
    adminName: 'Alice',
    status: 'active',
    participants: PARTICIPANTS,
    rounds: [ACTIVE_ROUND],
    scores: {},
    guessingData: { commentsByTarget: {}, possibleAuthors: [] },
    guessResults: {},
    currentRound: ACTIVE_ROUND,
    adminWritesComments: false,
    showSurnames: false,
    showGuessResults: false,
    targetSelectionMode: 'random',
    ...overrides,
  };
}

const { GameScreen } = require('../components/game/GameScreen');

function renderScreen() {
  return render(<SafeAreaProvider><GameScreen /></SafeAreaProvider>);
}

describe('GameScreen — playerNumbers passed to ActivePhase', () => {
  beforeEach(() => {
    capturedActivePhaseProps = null;
  });

  it('uses the frozen game.playerNumbers when present', () => {
    mockCurrentGame = baseGame({ playerNumbers: { u1: 1, u2: 2 } });
    renderScreen();
    expect(capturedActivePhaseProps.playerNumbers).toEqual({ u1: 1, u2: 2 });
  });

  it('falls back to the dynamic join-order numbering when playerNumbers is absent', () => {
    mockCurrentGame = baseGame();
    renderScreen();
    expect(capturedActivePhaseProps.playerNumbers).toEqual({ u1: 1, u2: 2 });
  });
});
