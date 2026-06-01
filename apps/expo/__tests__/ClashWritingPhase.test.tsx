import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@/i18n', () => ({
  t: (key: string, opts?: Record<string, unknown>) => {
    const extras = opts ? Object.entries(opts).filter(([k]) => k !== 'locale').map(([,v]) => String(v)).join(':') : '';
    return extras ? `${key}[${extras}]` : key;
  },
}));

let mockSubmitClashComment = jest.fn().mockResolvedValue(undefined);
let mockRevealClashComments = jest.fn().mockResolvedValue(undefined);

jest.mock('@/contexts/GameContext', () => ({
  useGame: () => ({ submitClashComment: mockSubmitClashComment, revealClashComments: mockRevealClashComments }),
}));
jest.mock('@/contexts/SoundContext', () => ({ useSound: () => ({ playSound: jest.fn().mockResolvedValue(undefined) }) }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));
jest.mock('@/components/themed-text', () => { const { Text } = require('react-native'); return { ThemedText: ({ children, ...p }: any) => <Text {...p}>{children}</Text> }; });
jest.mock('@/components/ui/icon-symbol', () => { const { Text } = require('react-native'); return { IconSymbol: ({ name }: any) => <Text>{name}</Text> }; });
jest.mock('@/components/game/GameHeader', () => ({}));
jest.mock('@/components/game/gameStyles', () => ({ gameStyles: { statusLabel: {}, statusBadge: {}, statusText: {}, buttonDisabled: {}, gameFlowContainer: {} } }));
jest.mock('@/components/game/clash/ClashScoreboard', () => { const { Text } = require('react-native'); return { ClashScoreboard: () => <Text>scoreboard</Text> }; });
jest.mock('@/constants/theme', () => ({
  Fonts: { sans: 'System' },
  GameColors: { white: '#fff', blue: '#007AFF', admin: '#FF9500', shadow: '#000', cardBg: '#fafafa', cardBorder: '#eee', clashWritingTint: 'rgba(255,120,0,0.06)', clashWritingTintBorder: 'rgba(255,120,0,0.15)' },
  StatusColors: { clash_writing: '#FF7800' },
  themedInput: () => ({ style: {}, placeholderTextColor: '#ccc' }),
}));

const { ClashWritingPhase } = require('../components/game/clash/ClashWritingPhase');

const SCHEDULE = [{
  assignmentsA: [{ writerId: 'u1', subjectId: 'u3' }, { writerId: 'u2', subjectId: 'u4' }],
  assignmentsB: [{ writerId: 'u3', subjectId: 'u1' }, { writerId: 'u4', subjectId: 'u2' }],
}];

const baseGame = {
  id: 'G1', adminId: 'u1', status: 'clash_writing',
  participants: [
    { userId: 'u1', userName: 'Alice', joinedAt: 0 },
    { userId: 'u2', userName: 'Bob', joinedAt: 1 },
    { userId: 'u3', userName: 'Carol', joinedAt: 2 },
    { userId: 'u4', userName: 'Dave', joinedAt: 3 },
  ],
  clashData: {
    groupA: { leaderId: 'u1', memberIds: ['u1', 'u2'] },
    groupB: { leaderId: 'u3', memberIds: ['u3', 'u4'] },
    schedule: SCHEDULE,
    currentRoundIndex: 0,
    currentRoundCommentsA: [],
    currentRoundCommentsB: [],
    lastGroupToFinish: null,
    currentGuessingGroup: null,
    currentRoundGuessesA: [],
    currentRoundGuessesB: [],
    teamScores: { a: 0, b: 0 },
  },
};

function renderPhase(overrides = {}, isAdmin = true, userId = 'u1') {
  return render(
    <ClashWritingPhase
      game={{ ...baseGame, ...overrides }}
      user={{ uid: userId }}
      isAdmin={isAdmin}
      locale="en"
      isDark={false}
      getDisplayName={(n: string) => n}
    />
  );
}

beforeEach(() => {
  mockSubmitClashComment = jest.fn().mockResolvedValue(undefined);
  mockRevealClashComments = jest.fn().mockResolvedValue(undefined);
});

describe('ClashWritingPhase', () => {
  it('shows the assigned subject name for user u1 (writes about u3 = Carol)', () => {
    const { queryByText } = renderPhase({}, true, 'u1');
    expect(queryByText('Carol')).toBeTruthy();
  });

  it('submit button calls submitClashComment with entered text', async () => {
    const { getByPlaceholderText, getByText } = renderPhase({}, true, 'u1');
    fireEvent.changeText(getByPlaceholderText('game.ui.clash.writeComment'), 'nice person');
    await act(async () => { fireEvent.press(getByText('game.ui.clash.submit')); });
    expect(mockSubmitClashComment).toHaveBeenCalledWith('nice person');
  });

  it('shows waiting card after submitting', async () => {
    const { getByPlaceholderText, getByText, queryByText } = renderPhase({}, true, 'u1');
    fireEvent.changeText(getByPlaceholderText('game.ui.clash.writeComment'), 'hi');
    await act(async () => { fireEvent.press(getByText('game.ui.clash.submit')); });
    expect(queryByText('game.ui.clash.writeComment')).toBeNull();
  });

  it('admin sees reveal button', () => {
    const { queryByText } = renderPhase({}, true);
    expect(queryByText('game.ui.clash.revealComments')).toBeTruthy();
  });

  it('non-admin does not see reveal button', () => {
    const { queryByText } = renderPhase({}, false);
    expect(queryByText('game.ui.clash.revealComments')).toBeNull();
  });

  it('reveal button calls revealClashComments when all submitted', async () => {
    const allSubmitted = {
      clashData: {
        ...baseGame.clashData,
        currentRoundCommentsA: [
          { writerId: 'u1', subjectId: 'u3', text: 'a', submittedAt: 1 },
          { writerId: 'u2', subjectId: 'u4', text: 'b', submittedAt: 2 },
        ],
        currentRoundCommentsB: [
          { writerId: 'u3', subjectId: 'u1', text: 'c', submittedAt: 3 },
          { writerId: 'u4', subjectId: 'u2', text: 'd', submittedAt: 4 },
        ],
      },
    };
    const { getByText } = renderPhase(allSubmitted, true);
    await act(async () => { fireEvent.press(getByText('game.ui.clash.revealComments')); });
    expect(mockRevealClashComments).toHaveBeenCalled();
  });

  it('reveal button does nothing when not all submitted', async () => {
    const { getByText } = renderPhase({}, true);
    await act(async () => { fireEvent.press(getByText('game.ui.clash.revealComments')); });
    expect(mockRevealClashComments).not.toHaveBeenCalled();
  });
});
