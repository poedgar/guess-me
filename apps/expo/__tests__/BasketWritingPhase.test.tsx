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

jest.mock('@/contexts/SoundContext', () => ({
  useSound: () => ({ playSound: jest.fn().mockResolvedValue(undefined) }),
}));

let mockSubmitBasketComment = jest.fn().mockResolvedValue(undefined);
let mockRevealBasketComments = jest.fn().mockResolvedValue(undefined);

jest.mock('@/contexts/GameContext', () => ({
  useGame: () => ({
    submitBasketComment: mockSubmitBasketComment,
    revealBasketComments: mockRevealBasketComments,
  }),
}));

jest.mock('@/components/themed-text', () => {
  const { Text } = require('react-native');
  return { ThemedText: ({ children, ...p }: any) => <Text {...p}>{children}</Text> };
});

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));

jest.mock('@/constants/theme', () => ({
  Fonts: { sans: 'System' },
  GameColors: {
    white: '#fff', blue: '#007AFF', green: '#34C759', waiting: '#FF9500',
    admin: '#FF9500', shadow: '#000', textLight: '#888', cardBg: '#fafafa',
    cardBorder: '#eee', inputBg: '#f2f2f2', incorrect: '#FF3B30',
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

const { BasketWritingPhase } = require('../components/game/basket/BasketWritingPhase');

const SCHEDULE = [
  { assignments: [
    { writerId: 'user-1', subjectId: 'user-2' },
    { writerId: 'user-2', subjectId: 'user-3' },
    { writerId: 'user-3', subjectId: 'user-1' },
  ]},
  { assignments: [
    { writerId: 'user-1', subjectId: 'user-3' },
    { writerId: 'user-2', subjectId: 'user-1' },
    { writerId: 'user-3', subjectId: 'user-2' },
  ]},
];

const baseGame = {
  id: 'GAME-XYZ', adminId: 'user-1', status: 'basket_writing',
  participants: [
    { userId: 'user-1', userName: 'Alice', joinedAt: 0 },
    { userId: 'user-2', userName: 'Bob',   joinedAt: 1 },
    { userId: 'user-3', userName: 'Carol', joinedAt: 2 },
  ],
  scores: {},
  basketData: {
    schedule: SCHEDULE, currentRoundIndex: 0,
    currentRoundComments: [], currentRoundGuesses: [],
  },
};

function renderPhase(overrides = {}, isAdmin = true) {
  return render(
    <BasketWritingPhase
      game={{ ...baseGame, ...overrides }}
      user={{ uid: 'user-1' }}
      isAdmin={isAdmin}
      locale="en"
      isDark={false}
      getDisplayName={(n: string) => n}
    />
  );
}

beforeEach(() => {
  mockSubmitBasketComment = jest.fn().mockResolvedValue(undefined);
  mockRevealBasketComments = jest.fn().mockResolvedValue(undefined);
});

describe('BasketWritingPhase', () => {
  it('shows round number label', () => {
    const { queryByText } = renderPhase();
    // t('game.ui.basket.round', { current: 1, total: 2 }) → 'game.ui.basket.round[1:2]'
    expect(queryByText('game.ui.basket.round[1:2]')).toBeTruthy();
  });

  it('shows the assigned subject display name', () => {
    const { queryByText } = renderPhase();
    expect(queryByText('Bob')).toBeTruthy();
  });

  it('submit button calls submitBasketComment with the entered text', async () => {
    const { getByPlaceholderText, getByText } = renderPhase();
    fireEvent.changeText(getByPlaceholderText('game.ui.basket.writeComment'), 'great person');
    await act(async () => { fireEvent.press(getByText('game.ui.basket.submit')); });
    expect(mockSubmitBasketComment).toHaveBeenCalledWith('great person');
  });

  it('shows waiting state after submit', async () => {
    const { getByPlaceholderText, getByText, queryByText } = renderPhase();
    fireEvent.changeText(getByPlaceholderText('game.ui.basket.writeComment'), 'hi');
    await act(async () => { fireEvent.press(getByText('game.ui.basket.submit')); });
    expect(queryByText('game.ui.basket.writeComment')).toBeNull();
    expect(queryByText(/game\.ui\.basket\.waitingForOthers/)).toBeTruthy();
  });

  it('admin sees the reveal button', () => {
    const { queryByText } = renderPhase({}, true);
    expect(queryByText('game.ui.basket.revealComments')).toBeTruthy();
  });

  it('non-admin does not see the reveal button', () => {
    const { queryByText } = renderPhase({}, false);
    expect(queryByText('game.ui.basket.revealComments')).toBeNull();
  });

  it('reveal button calls revealBasketComments when all submitted', async () => {
    const allSubmitted = {
      basketData: {
        ...baseGame.basketData,
        currentRoundComments: [
          { writerId: 'user-1', subjectId: 'user-2', text: 'a', submittedAt: 1 },
          { writerId: 'user-2', subjectId: 'user-3', text: 'b', submittedAt: 2 },
          { writerId: 'user-3', subjectId: 'user-1', text: 'c', submittedAt: 3 },
        ],
      },
    };
    const { getByText } = renderPhase(allSubmitted, true);
    await act(async () => { fireEvent.press(getByText('game.ui.basket.revealComments')); });
    expect(mockRevealBasketComments).toHaveBeenCalled();
  });

  it('reveal button does nothing when not all players submitted', async () => {
    const { getByText } = renderPhase({}, true);
    await act(async () => { fireEvent.press(getByText('game.ui.basket.revealComments')); });
    expect(mockRevealBasketComments).not.toHaveBeenCalled();
  });
});
