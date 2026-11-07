// Regression coverage: showGuessResults was stored/toggleable but never
// applied — the "X out of Y correct" breakdown banner rendered unconditionally
// once guessResults[uid] existed, regardless of the setting. Gates it so the
// banner only shows when game.showGuessResults is true; otherwise the
// generic "guesses submitted" fallback renders instead.
import React from 'react';
import { render } from '@testing-library/react-native';

jest.mock('@/i18n', () => ({
  t: (key: string, opts?: Record<string, unknown>) => {
    const extras = opts
      ? Object.entries(opts)
          .filter(([k]) => k !== 'locale')
          .map(([, v]) => String(v))
          .join(':')
      : '';
    return extras ? `${key}[${extras}]` : key;
  },
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));

jest.mock('@/contexts/SoundContext', () => ({
  useSound: () => ({ playSound: jest.fn().mockResolvedValue(undefined) }),
}));

jest.mock('@/contexts/GameContext', () => ({
  useGame: () => ({
    loading: false,
    submitGuess: jest.fn(),
    markPlayerGuessesSubmitted: jest.fn(),
    finalizeGuessingPhase: jest.fn(),
    startNextRound: jest.fn(),
  }),
}));

jest.mock('@/components/themed-text', () => {
  const { Text } = require('react-native');
  return { ThemedText: ({ children, ...p }: any) => <Text {...p}>{children}</Text> };
});
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/ui/TargetControlPanel', () => ({ TargetControlPanel: () => null }));
jest.mock('@/components/game/GameHeader', () => ({ GameHeader: () => null }));
jest.mock('@/components/game/mirror/PostGuessingPointsPanel', () => ({
  __esModule: true,
  default: () => null,
}));
jest.mock('@/components/game/gameStyles', () => ({
  gameStyles: {
    statusLabel: {},
    statusBadge: {},
    statusText: {},
    buttonDisabled: {},
    gameFlowContainer: {},
  },
}));
jest.mock('@/constants/theme', () => ({
  Fonts: { sans: 'System' },
  GameColors: {
    guessingTint: '#fff', guessingTintBorder: '#eee',
    cardBg: '#fafafa', white: '#fff', purple: '#AF52DE',
    green: '#34C759', shadow: '#000', placeholderLight: '#ccc',
    correct: '#0f0', incorrect: '#f00',
    correctBg: '#efe', incorrectBg: '#fee',
  },
  StatusColors: { guessing_phase: '#5856D6' },
}));

const { GuessingPhase } = require('../components/game/mirror/GuessingPhase');

const TARGET_UID = 'target-1';
const PLAYER_UID = 'player-1';

const participants = [
  { userId: 'admin-1', userName: 'Admin User', displayName: 'Admin User', joinedAt: 0 },
  { userId: PLAYER_UID, userName: 'Alice Player', displayName: 'Alice Player', joinedAt: 1 },
  { userId: TARGET_UID, userName: 'Bob Smith', displayName: 'Bob Smith', joinedAt: 2 },
];

function makeGame(overrides: Record<string, unknown> = {}) {
  return {
    id: 'game-1',
    adminId: 'admin-1',
    status: 'guessing_phase',
    participants,
    scores: {},
    guessResults: { [PLAYER_UID]: { correctGuesses: 2 } },
    guessingData: {
      playersWhoSubmittedGuesses: [PLAYER_UID],
      allPlayersSubmitted: true,
      commentsByTarget: { [PLAYER_UID]: [] },
      possibleAuthors: participants,
      singleRoundTargetId: null,
    },
    ...overrides,
  };
}

function renderPanel(game: Record<string, unknown>) {
  return render(
    <GuessingPhase
      game={game}
      isAdmin={false}
      user={{ uid: PLAYER_UID }}
      participantsByJoin={participants}
      joinIndexById={{ 'admin-1': 1, [PLAYER_UID]: 2, [TARGET_UID]: 3 }}
      getDisplayName={(name: string) => name.split(' ')[0]}
      commentsForPlayer={[]}
      showFancyAlert={jest.fn()}
      locale="en"
    />,
  );
}

describe('GuessingPhase — showGuessResults gates the correct-count banner', () => {
  it('shows the correct-count breakdown when showGuessResults is true', () => {
    const { queryByText } = renderPanel(makeGame({ showGuessResults: true }));
    expect(queryByText(/game\.ui\.guessCorrectCount/)).toBeTruthy();
  });

  it('hides the correct-count breakdown when showGuessResults is false', () => {
    const { queryByText } = renderPanel(makeGame({ showGuessResults: false }));
    expect(queryByText(/game\.ui\.guessCorrectCount/)).toBeNull();
    expect(queryByText('game.ui.guessResultsTitle')).toBeTruthy();
  });

  it('hides the correct-count breakdown when showGuessResults is undefined (legacy games)', () => {
    const { queryByText } = renderPanel(makeGame());
    expect(queryByText(/game\.ui\.guessCorrectCount/)).toBeNull();
    expect(queryByText('game.ui.guessResultsTitle')).toBeTruthy();
  });
});
