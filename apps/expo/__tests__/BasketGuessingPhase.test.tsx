import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@/i18n', () => ({
  t: (key: string, opts?: Record<string, unknown>) => {
    const extras = opts
      ? Object.entries(opts).filter(([k]) => k !== 'locale').map(([, v]) => String(v)).join(':')
      : '';
    return extras ? `${key}[${extras}]` : key;
  },
}));

let mockSubmitBasketCommentGuess = jest.fn().mockResolvedValue(undefined);
let mockSubmitBasketAuthorGuess = jest.fn().mockResolvedValue(undefined);
let mockStartNextBasketRound = jest.fn().mockResolvedValue(undefined);

jest.mock('@/contexts/GameContext', () => ({
  useGame: () => ({
    submitBasketCommentGuess: mockSubmitBasketCommentGuess,
    submitBasketAuthorGuess: mockSubmitBasketAuthorGuess,
    startNextBasketRound: mockStartNextBasketRound,
  }),
}));

jest.mock('@/contexts/SoundContext', () => ({
  useSound: () => ({ playSound: jest.fn().mockResolvedValue(undefined) }),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));

jest.mock('@/components/themed-text', () => {
  const { Text } = require('react-native');
  return { ThemedText: ({ children, ...p }: any) => <Text {...p}>{children}</Text> };
});

jest.mock('@/constants/theme', () => ({
  Fonts: { sans: 'System' },
  GameColors: {
    white: '#fff', blue: '#007AFF', green: '#34C759',
    correct: '#34C759', incorrect: '#FF3B30', shadow: '#000',
    cardBg: '#fafafa', cardBorder: '#eee', admin: '#FF9500',
  },
  StatusColors: { basket_writing: '#007AFF', basket_guessing: '#AF52DE' },
  themedInput: () => ({ style: {}, placeholderTextColor: '#ccc' }),
}));

jest.mock('@/components/game/gameStyles', () => ({
  gameStyles: { statusLabel: {}, statusBadge: {}, statusText: {}, buttonDisabled: {}, gameFlowContainer: {} },
}));

jest.mock('@/components/game/GameHeader', () => ({}));

jest.mock('@/components/ui/icon-symbol', () => {
  const { Text } = require('react-native');
  return { IconSymbol: ({ name }: any) => <Text>{name}</Text> };
});

const { BasketGuessingPhase } = require('../components/game/basket/BasketGuessingPhase');

// comment about user-1 is written by user-2
const COMMENTS = [
  { writerId: 'user-2', subjectId: 'user-1', text: 'Great team player', submittedAt: 1 },
  { writerId: 'user-3', subjectId: 'user-2', text: 'Very creative', submittedAt: 2 },
  { writerId: 'user-1', subjectId: 'user-3', text: 'Natural leader', submittedAt: 3 },
];

const baseGame = {
  id: 'GAME-XYZ', adminId: 'user-1', status: 'basket_guessing',
  participants: [
    { userId: 'user-1', userName: 'Alice', joinedAt: 0 },
    { userId: 'user-2', userName: 'Bob',   joinedAt: 1 },
    { userId: 'user-3', userName: 'Carol', joinedAt: 2 },
  ],
  scores: {},
  basketData: {
    schedule: [{ assignments: [
      { writerId: 'user-2', subjectId: 'user-1' },
      { writerId: 'user-3', subjectId: 'user-2' },
      { writerId: 'user-1', subjectId: 'user-3' },
    ]}],
    currentRoundIndex: 0,
    currentRoundComments: COMMENTS,
    currentRoundGuesses: [],
  },
};

function renderPhase(gameOverrides = {}, isAdmin = true) {
  return render(
    <BasketGuessingPhase
      game={{ ...baseGame, ...gameOverrides }}
      user={{ uid: 'user-1' }}
      isAdmin={isAdmin}
      locale="en"
      isDark={false}
      getDisplayName={(n: string) => n}
    />
  );
}

beforeEach(() => {
  mockSubmitBasketCommentGuess = jest.fn().mockResolvedValue(undefined);
  mockSubmitBasketAuthorGuess  = jest.fn().mockResolvedValue(undefined);
  mockStartNextBasketRound     = jest.fn().mockResolvedValue(undefined);
});

describe('BasketGuessingPhase', () => {
  it('renders all comment texts as anonymous cards', () => {
    const { queryByText } = renderPhase();
    expect(queryByText('Great team player')).toBeTruthy();
    expect(queryByText('Very creative')).toBeTruthy();
    expect(queryByText('Natural leader')).toBeTruthy();
  });

  it('does not reveal writerId or subjectId in the UI', () => {
    const { queryByText } = renderPhase();
    expect(queryByText('user-1')).toBeNull();
    expect(queryByText('user-2')).toBeNull();
    expect(queryByText('user-3')).toBeNull();
  });

  it('tapping a comment card calls submitBasketCommentGuess with its writerId', async () => {
    const { getByText } = renderPhase();
    await act(async () => { fireEvent.press(getByText('Great team player')); });
    expect(mockSubmitBasketCommentGuess).toHaveBeenCalledWith('user-2');
  });

  it('shows success message and author list after correct guess', async () => {
    const { getByText, queryByText } = renderPhase();
    // 'Great team player' is written by user-2 about user-1 → correct
    await act(async () => { fireEvent.press(getByText('Great team player')); });
    expect(queryByText('game.ui.basket.correct')).toBeTruthy();
    expect(queryByText('game.ui.basket.whoWroteIt')).toBeTruthy();
    // Other players shown as author options (excluding self)
    expect(queryByText('Bob')).toBeTruthy();
    expect(queryByText('Carol')).toBeTruthy();
  });

  it('shows error message and no author list after wrong guess', async () => {
    const { getByText, queryByText } = renderPhase();
    // 'Very creative' is about user-2, not user-1 → wrong
    await act(async () => { fireEvent.press(getByText('Very creative')); });
    expect(queryByText('game.ui.basket.wrong')).toBeTruthy();
    expect(queryByText('game.ui.basket.whoWroteIt')).toBeNull();
  });

  it('tapping an author calls submitBasketAuthorGuess', async () => {
    const { getByText } = renderPhase();
    await act(async () => { fireEvent.press(getByText('Great team player')); });
    await act(async () => { fireEvent.press(getByText('Bob')); });
    expect(mockSubmitBasketAuthorGuess).toHaveBeenCalledWith('user-2');
  });

  it('admin sees the next-round button', () => {
    const { queryByText } = renderPhase({}, true);
    expect(queryByText('game.ui.basket.nextRound')).toBeTruthy();
  });

  it('non-admin does not see the next-round button', () => {
    const { queryByText } = renderPhase({}, false);
    expect(queryByText('game.ui.basket.nextRound')).toBeNull();
  });

  it('next-round button calls startNextBasketRound', async () => {
    const { getByText } = renderPhase({}, true);
    await act(async () => { fireEvent.press(getByText('game.ui.basket.nextRound')); });
    expect(mockStartNextBasketRound).toHaveBeenCalled();
  });

  it('shows finish-game label on last round', () => {
    const lastRoundGame = {
      ...baseGame,
      basketData: { ...baseGame.basketData, currentRoundIndex: 0 },
      // schedule.length === 1, so currentRoundIndex 0 is the last round
    };
    // isLastRound = currentRoundIndex + 1 >= schedule.length → 0+1 >= 1 → true
    const { queryByText } = renderPhase(lastRoundGame, true);
    expect(queryByText('game.ui.basket.finishGame')).toBeTruthy();
  });
});
