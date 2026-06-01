// TDD – Fix 4.1: participantsByJoin and joinIndexById must be memoized in GameScreen.
import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// ── spy on the sort utility ────────────────────────────────────────────────
// 'let' so beforeEach can re-assign after resetMocks wipes the implementation.
let mockSortParticipantsByJoin: jest.Mock;
jest.mock('@/utils/participants', () => ({
  sortParticipantsByJoin: (...args: unknown[]) => mockSortParticipantsByJoin(...args),
  buildJoinIndexById: (arr: any[]) => Object.fromEntries(arr.map((p: any, i: number) => [p.userId, i + 1])),
}));

// ── standard GameScreen mocks (mirrors GameScreen.test.tsx) ──────────────
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

let mockCurrentGame: any = null;
const mockUser = { uid: 'u1', displayName: 'Alice', email: 'alice@test.com' };

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mockUser, isSignedIn: true }),
}));

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
  { userId: 'u2', userName: 'Bob',   userEmail: 'b@test.com', joinedAt: new Date(1) },
];

const WAITING_GAME = {
  id: 'game-memo',
  adminId: 'u1',
  adminName: 'Alice',
  status: 'waiting',
  participants: PARTICIPANTS,
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

describe('GameScreen — 4.1 useMemo for participantsByJoin and joinIndexById', () => {
  beforeEach(() => {
    mockCurrentGame = WAITING_GAME;
    mockSortParticipantsByJoin = jest.fn((arr: any[]) => [...arr]);
  });

  it('only calls sortParticipantsByJoin once when participants have not changed between renders', () => {
    const { rerender } = renderScreen();
    const callsAfterMount = mockSortParticipantsByJoin.mock.calls.length;
    expect(callsAfterMount).toBeGreaterThan(0); // sanity: called at least once

    // Re-render with the SAME participants reference — unrelated change
    rerender(<SafeAreaProvider><GameScreen /></SafeAreaProvider>);

    // Without useMemo: called once per render → callsAfterMount * 2
    // With useMemo:    called once on mount only → still callsAfterMount
    expect(mockSortParticipantsByJoin.mock.calls.length).toBe(callsAfterMount);
  });

  it('re-sorts when participants reference changes', () => {
    const { rerender } = renderScreen();
    const callsAfterMount = mockSortParticipantsByJoin.mock.calls.length;

    // Change the participants reference
    mockCurrentGame = {
      ...WAITING_GAME,
      participants: [
        ...PARTICIPANTS,
        { userId: 'u3', userName: 'Carol', userEmail: 'c@test.com', joinedAt: new Date(2) },
      ],
    };
    rerender(<SafeAreaProvider><GameScreen /></SafeAreaProvider>);

    expect(mockSortParticipantsByJoin.mock.calls.length).toBeGreaterThan(callsAfterMount);
  });
});
