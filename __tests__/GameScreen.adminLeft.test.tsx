// TDD – Fix 5.2: adminLeft alert must show for non-admins only, and pressing
//                OK must call leaveGame. The ref guard must prevent re-triggering
//                the alert after the user dismisses it.
import React from 'react';
import { act, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

// Stub every sub-component so this file only tests GameScreen's orchestration.
jest.mock('@/components/LanguageSelector', () => ({ LanguageSelector: () => null }));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/ui/PlayerAvatar', () => ({ PlayerAvatar: () => null }));
jest.mock('@/components/ui/TargetControlPanel', () => ({ TargetControlPanel: () => null }));
jest.mock('@/components/ui/HeaderLogo', () => ({ HeaderLogo: () => null }));
jest.mock('@/components/SoundToggle', () => ({ SoundToggle: () => null }));
jest.mock('@/components/ui/SuccessAnimation', () => ({ SuccessAnimation: () => null }));
jest.mock('@/components/ui/FaceMessage', () => ({ FaceMessage: () => null }));
jest.mock('@/components/game/Leaderboard', () => ({ Leaderboard: () => null }));
jest.mock('@/components/game/PostGuessingPointsPanel', () => ({ __esModule: true, default: () => null }));
jest.mock('@/components/game/ResultsPhase', () => ({ ResultsPhase: () => null }));
jest.mock('@/components/game/WaitingPhase', () => ({ WaitingPhase: () => null }));
jest.mock('@/components/game/ActivePhase', () => ({ ActivePhase: () => null }));
jest.mock('@/components/game/GuessingPhase', () => ({ GuessingPhase: () => null }));
jest.mock('@/components/game/GameHeader', () => ({ GameHeader: () => null }));
jest.mock('react-native-qrcode-svg', () => 'QRCode');

jest.mock('@/i18n', () => ({ t: (key: string) => key }));
let mockLocale = 'en';
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ locale: mockLocale, setLocale: jest.fn() }),
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

// FancyAlert spy: capture the latest props so tests can assert on them.
let fancyAlertProps: Record<string, any> = {};
jest.mock('@/components/ui/FancyAlert', () => ({
  FancyAlert: (props: any) => {
    fancyAlertProps = props;
    return null;
  },
}));

let mockLeaveGame: jest.Mock;
let mockCurrentGame: any = null;
let mockUser: any = { uid: 'player-uid', displayName: 'Player', email: 'player@test.com' };

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, isSignedIn: true }),
}));

jest.mock('@/contexts/GameContext', () => ({
  useGame: () => ({
    currentGame: mockCurrentGame,
    loading: false,
    leaveGame: (...args: any[]) => mockLeaveGame(...args),
    enterGame: jest.fn(),
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

const ADMIN_LEFT_GAME = {
  id: 'game-al',
  adminId: 'admin-uid',
  adminName: 'Admin',
  adminEmail: 'admin@test.com',
  status: 'finished',
  adminLeft: true,
  participants: [
    { userId: 'admin-uid', userName: 'Admin', userEmail: 'admin@test.com', joinedAt: new Date() },
    { userId: 'player-uid', userName: 'Player', userEmail: 'player@test.com', joinedAt: new Date() },
  ],
  rounds: [],
  scores: {},
  guessingData: { commentsByTarget: {}, possibleAuthors: [] },
  guessResults: {},
  currentRound: null,
  adminWritesComments: false,
  showSurnames: false,
  showGuessResults: false,
  targetSelectionMode: 'random',
};

const { GameScreen } = require('../components/game/GameScreen');

function renderScreen() {
  return render(<SafeAreaProvider><GameScreen /></SafeAreaProvider>);
}

describe('GameScreen — 5.2 adminLeft alert', () => {
  beforeEach(() => {
    fancyAlertProps = {};
    mockLocale = 'en';
    mockLeaveGame = jest.fn().mockResolvedValue(undefined);
    mockCurrentGame = ADMIN_LEFT_GAME;
    mockUser = { uid: 'player-uid', displayName: 'Player', email: 'player@test.com' };
  });

  it('shows the adminLeft alert for a non-admin when adminLeft is true', () => {
    renderScreen();
    expect(fancyAlertProps.visible).toBe(true);
    expect(fancyAlertProps.title).toBe('game.ui.adminLeftTitle');
  });

  it('includes the adminLeft message body', () => {
    renderScreen();
    expect(fancyAlertProps.message).toBe('game.ui.adminLeftMessage');
  });

  it('does NOT show the adminLeft alert when the current user is the admin', () => {
    mockUser = { uid: 'admin-uid', displayName: 'Admin', email: 'admin@test.com' };
    renderScreen();
    const isAdminLeftAlert =
      fancyAlertProps.visible === true &&
      fancyAlertProps.title === 'game.ui.adminLeftTitle';
    expect(isAdminLeftAlert).toBe(false);
  });

  it('calls leaveGame when the OK button is pressed', async () => {
    renderScreen();
    expect(fancyAlertProps.visible).toBe(true);
    const okButton = fancyAlertProps.buttons?.[0];
    expect(okButton).toBeDefined();
    await act(async () => { await okButton.onPress(); });
    expect(mockLeaveGame).toHaveBeenCalled();
  });

  it('does not re-show the alert after user dismisses it, even when locale changes (ref guard)', () => {
    // locale is a dep of the effect, so switching it re-runs the effect.
    // The ref guard must prevent the alert from reappearing.
    const { rerender } = renderScreen();
    expect(fancyAlertProps.visible).toBe(true);

    // User dismisses the alert
    act(() => { fancyAlertProps.onClose(); });
    expect(fancyAlertProps.visible).toBe(false);

    // Changing locale re-runs the effect — without the ref guard the alert
    // would be re-triggered here.
    mockLocale = 'uk';
    rerender(<SafeAreaProvider><GameScreen /></SafeAreaProvider>);
    expect(fancyAlertProps.visible).toBe(false);
  });
});
