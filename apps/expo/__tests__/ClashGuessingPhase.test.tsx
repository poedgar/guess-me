import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@/i18n', () => ({
  t: (key: string, opts?: Record<string, unknown>) => {
    const extras = opts ? Object.entries(opts).filter(([k]) => k !== 'locale').map(([,v]) => String(v)).join(':') : '';
    return extras ? `${key}[${extras}]` : key;
  },
}));

let mockSubmitClashGuess = jest.fn().mockResolvedValue(undefined);
let mockSubmitClashAuthorGuess = jest.fn().mockResolvedValue(undefined);
let mockAdvanceClashGuessing = jest.fn().mockResolvedValue(undefined);

jest.mock('@/contexts/GameContext', () => ({
  useGame: () => ({
    submitClashGuess: mockSubmitClashGuess,
    submitClashAuthorGuess: mockSubmitClashAuthorGuess,
    advanceClashGuessing: mockAdvanceClashGuessing,
  }),
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
  GameColors: { white: '#fff', blue: '#007AFF', green: '#34C759', correct: '#34C759', incorrect: '#FF3B30', shadow: '#000', cardBg: '#fafafa', cardBorder: '#eee', neutral: '#8E8E93' },
  StatusColors: { clash_guessing: '#FF5000' },
}));

const { ClashGuessingPhase } = require('../components/game/clash/ClashGuessingPhase');

// Group A: u1 (leader), u2 — Group B: u3 (leader), u4
// currentGuessingGroup = 'a': leader u1 guesses about commentsB (written BY group B, ABOUT group A)
const COMMENTS_B = [
  { writerId: 'u3', subjectId: 'u1', text: 'Comment about u1 by u3', submittedAt: 1 },
  { writerId: 'u4', subjectId: 'u2', text: 'Comment about u2 by u4', submittedAt: 2 },
];

const baseGame = {
  id: 'G1', adminId: 'u1', status: 'clash_guessing',
  participants: [
    { userId: 'u1', userName: 'Alice', joinedAt: 0 },
    { userId: 'u2', userName: 'Bob', joinedAt: 1 },
    { userId: 'u3', userName: 'Carol', joinedAt: 2 },
    { userId: 'u4', userName: 'Dave', joinedAt: 3 },
  ],
  clashData: {
    groupA: { leaderId: 'u1', memberIds: ['u1', 'u2'] },
    groupB: { leaderId: 'u3', memberIds: ['u3', 'u4'] },
    schedule: [{ assignmentsA: [], assignmentsB: [] }],
    currentRoundIndex: 0,
    currentRoundCommentsA: [],
    currentRoundCommentsB: COMMENTS_B,
    lastGroupToFinish: 'b',
    currentGuessingGroup: 'a',
    currentRoundGuessesA: [],
    currentRoundGuessesB: [],
    teamScores: { a: 0, b: 0 },
  },
};

function renderPhase(overrides = {}, isAdmin = true, userId = 'u1') {
  return render(
    <ClashGuessingPhase
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
  mockSubmitClashGuess = jest.fn().mockResolvedValue(undefined);
  mockSubmitClashAuthorGuess = jest.fn().mockResolvedValue(undefined);
  mockAdvanceClashGuessing = jest.fn().mockResolvedValue(undefined);
});

describe('ClashGuessingPhase', () => {
  it('active leader (u1) sees comment cards from opposite group', () => {
    const { queryByText } = renderPhase({}, true, 'u1');
    expect(queryByText('Comment about u1 by u3')).toBeTruthy();
    expect(queryByText('Comment about u2 by u4')).toBeTruthy();
  });

  it('non-leader sees waiting message', () => {
    const { queryByText } = renderPhase({}, false, 'u2');
    expect(queryByText(/clash\.leaderGuessing/)).toBeTruthy();
    expect(queryByText('Comment about u1 by u3')).toBeNull();
  });

  it('tapping a comment card shows subject picker with own group members', async () => {
    const { getByText, queryByText } = renderPhase({}, true, 'u1');
    await act(async () => { fireEvent.press(getByText('Comment about u1 by u3')); });
    expect(queryByText('game.ui.clash.whichMember')).toBeTruthy();
    expect(queryByText('Alice')).toBeTruthy();
    expect(queryByText('Bob')).toBeTruthy();
  });

  it('correct subject guess calls submitClashGuess and shows author picker', async () => {
    const { getByText, queryByText } = renderPhase({}, true, 'u1');
    await act(async () => { fireEvent.press(getByText('Comment about u1 by u3')); });
    // Alice (u1) is the correct subject for the first comment
    await act(async () => { fireEvent.press(getByText('Alice')); });
    expect(mockSubmitClashGuess).toHaveBeenCalledWith('u3', 'u1');
    expect(queryByText('game.ui.clash.whoWroteIt')).toBeTruthy();
    // Author picker shows Group B members
    expect(queryByText('Carol')).toBeTruthy();
    expect(queryByText('Dave')).toBeTruthy();
  });

  it('wrong subject guess shows wrong feedback', async () => {
    const { getByText, queryByText } = renderPhase({}, true, 'u1');
    await act(async () => { fireEvent.press(getByText('Comment about u1 by u3')); });
    // Bob (u2) is wrong subject for first comment (correct is u1)
    await act(async () => { fireEvent.press(getByText('Bob')); });
    expect(queryByText('game.ui.clash.wrong')).toBeTruthy();
    expect(queryByText('game.ui.clash.whoWroteIt')).toBeNull();
  });

  it('author guess calls submitClashAuthorGuess', async () => {
    const { getByText } = renderPhase({}, true, 'u1');
    await act(async () => { fireEvent.press(getByText('Comment about u1 by u3')); });
    await act(async () => { fireEvent.press(getByText('Alice')); }); // correct subject
    await act(async () => { fireEvent.press(getByText('Carol')); }); // guess author
    expect(mockSubmitClashAuthorGuess).toHaveBeenCalledWith('u3', 'u3');
  });

  it('admin sees the advance button', () => {
    const { queryByText } = renderPhase({}, true, 'u1');
    expect(queryByText(/game\.ui\.clash\.(nextLeader|nextRound|finishGame)/)).toBeTruthy();
  });

  it('advance button calls advanceClashGuessing', async () => {
    const { getByText } = renderPhase({}, true, 'u1');
    const btn = getByText(/game\.ui\.clash\.(nextLeader|nextRound|finishGame)/);
    await act(async () => { fireEvent.press(btn); });
    expect(mockAdvanceClashGuessing).toHaveBeenCalled();
  });
});
