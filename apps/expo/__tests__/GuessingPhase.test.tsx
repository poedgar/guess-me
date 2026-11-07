// TDD – Fix 3.4: subtitle must show target name in per-round guessing mode.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

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
const TARGET_NAME = 'Bob Smith';
const PLAYER_UID = 'player-1';

const participants = [
  { userId: 'admin-1', userName: 'Admin User', displayName: 'Admin User', joinedAt: 0 },
  { userId: PLAYER_UID, userName: 'Alice Player', displayName: 'Alice Player', joinedAt: 1 },
  { userId: TARGET_UID, userName: TARGET_NAME, displayName: TARGET_NAME, joinedAt: 2 },
];

function makeGame(guessingOverrides: Record<string, unknown> = {}) {
  return {
    id: 'game-1',
    adminId: 'admin-1',
    status: 'guessing_phase',
    participants,
    scores: {},
    guessResults: {},
    guessingData: {
      playersWhoSubmittedGuesses: [],
      allPlayersSubmitted: false,
      commentsByTarget: { [PLAYER_UID]: [] },
      possibleAuthors: participants,
      singleRoundTargetId: null,
      ...guessingOverrides,
    },
  };
}

describe('GuessingPhase — 3.4 subtitle shows target name in per-round mode', () => {
  it('shows static subtitle when singleRoundTargetId is null', () => {
    const { queryByText } = render(
      <GuessingPhase
        game={makeGame()}
        isAdmin={false}
        user={{ uid: PLAYER_UID }}
        participantsByJoin={participants}
        joinIndexById={{ 'admin-1': 1, [PLAYER_UID]: 2, [TARGET_UID]: 3 }}
        getDisplayName={(name: string) => name.split(' ')[0]}
        commentsForPlayer={[]}
        showFancyAlert={jest.fn()}
        locale="en"
      />
    );
    // Generic subtitle present, no name-containing subtitle
    expect(queryByText('game.ui.guessAuthorsSubtitle')).toBeTruthy();
  });

  it('shows target name in subtitle when singleRoundTargetId is set', () => {
    const { queryByText, getByText } = render(
      <GuessingPhase
        game={makeGame({ singleRoundTargetId: TARGET_UID })}
        isAdmin={false}
        user={{ uid: PLAYER_UID }}
        participantsByJoin={participants}
        joinIndexById={{ 'admin-1': 1, [PLAYER_UID]: 2, [TARGET_UID]: 3 }}
        getDisplayName={(name: string) => name.split(' ')[0]}
        commentsForPlayer={[]}
        showFancyAlert={jest.fn()}
        locale="en"
      />
    );
    // Generic subtitle must NOT be shown
    expect(queryByText('game.ui.guessAuthorsSubtitle')).toBeNull();
    // Name-containing subtitle must be shown (getDisplayName('Bob Smith') = 'Bob')
    const subtitleEl = getByText(/Bob/);
    expect(subtitleEl).toBeTruthy();
  });
});

// ─── 7.2 author-option buttons must expose selection state to screen readers ──

describe('GuessingPhase — 7.2 author options announce selected state', () => {
  const COMMENT = { id: 'c1', text: 'Great player', authorId: 'admin-1' };

  function renderWithComment() {
    return render(
      <GuessingPhase
        game={makeGame()}
        isAdmin={false}
        user={{ uid: PLAYER_UID }}
        participantsByJoin={participants}
        joinIndexById={{ 'admin-1': 1, [PLAYER_UID]: 2, [TARGET_UID]: 3 }}
        getDisplayName={(name: string) => name.split(' ')[0]}
        commentsForPlayer={[COMMENT]}
        showFancyAlert={jest.fn()}
        locale="en"
      />
    );
  }

  it('author option buttons are queryable as radio buttons', () => {
    const { getAllByRole } = renderWithComment();
    expect(getAllByRole('radio').length).toBeGreaterThan(0);
  });

  it('pressing an author marks exactly that button as selected', () => {
    const { getAllByRole } = renderWithComment();
    const radios = getAllByRole('radio');
    // none selected initially
    expect(radios.every(b => !b.props.accessibilityState?.selected)).toBe(true);
    // press the first author
    fireEvent.press(radios[0]);
    const updated = getAllByRole('radio');
    expect(updated.filter(b => b.props.accessibilityState?.selected)).toHaveLength(1);
  });
});

// ─── 7.3 guess result modal must have an accessible close action ──────────────

describe('GuessingPhase — 7.3 guess result modal has accessible close action', () => {
  const COMMENT = { id: 'c1', text: 'Great player', authorId: 'admin-1' };

  function renderForModal() {
    return render(
      <GuessingPhase
        game={makeGame({ commentsByTarget: { [PLAYER_UID]: [COMMENT] } })}
        isAdmin={false}
        user={{ uid: PLAYER_UID }}
        participantsByJoin={participants}
        joinIndexById={{ 'admin-1': 1, [PLAYER_UID]: 2, [TARGET_UID]: 3 }}
        getDisplayName={(name: string) => name.split(' ')[0]}
        commentsForPlayer={[COMMENT]}
        showFancyAlert={jest.fn()}
        locale="en"
      />
    );
  }

  async function openModal(queries: ReturnType<typeof render>) {
    const { getAllByRole, getByLabelText } = queries;
    // select the first author option then submit
    fireEvent.press(getAllByRole('radio')[0]);
    await act(async () => {
      fireEvent.press(getByLabelText('game.ui.submitGuesses'));
    });
  }

  it('modal close button has an accessibilityLabel', async () => {
    const queries = renderForModal();
    await openModal(queries);
    const closeBtn = await queries.findByLabelText('game.ui.closeGuessResults');
    expect(closeBtn).toBeTruthy();
  });

  it('modal container has accessibilityViewIsModal', async () => {
    const queries = renderForModal();
    await openModal(queries);
    // wait for the modal to appear, then check the container has modal semantics
    await queries.findByLabelText('game.ui.closeGuessResults');
    const { UNSAFE_getAllByType } = queries;
    const { View } = require('react-native');
    const modalViews = UNSAFE_getAllByType(View).filter(
      (v: any) => v.props.accessibilityViewIsModal === true
    );
    expect(modalViews.length).toBeGreaterThan(0);
  });
});

// ─── playerNumbers takes precedence over joinIndexById for author-pill numbers ──

describe('GuessingPhase — playerNumbers prop numbers the author pills', () => {
  const COMMENT = { id: 'c1', text: 'Great player', authorId: 'admin-1' };

  it('uses playerNumbers instead of joinIndexById when both are supplied', () => {
    const { getByText, queryByText } = render(
      <GuessingPhase
        game={makeGame()}
        isAdmin={false}
        user={{ uid: PLAYER_UID }}
        participantsByJoin={participants}
        joinIndexById={{ 'admin-1': 1, [PLAYER_UID]: 2, [TARGET_UID]: 3 }}
        playerNumbers={{ 'admin-1': 9, [PLAYER_UID]: 8, [TARGET_UID]: 7 }}
        getDisplayName={(name: string) => name.split(' ')[0]}
        commentsForPlayer={[COMMENT]}
        showFancyAlert={jest.fn()}
        locale="en"
      />
    );
    expect(getByText('9. Admin')).toBeTruthy();
    expect(queryByText('1. Admin')).toBeNull();
  });

  it('falls back to joinIndexById when playerNumbers is not supplied', () => {
    const { getByText } = render(
      <GuessingPhase
        game={makeGame()}
        isAdmin={false}
        user={{ uid: PLAYER_UID }}
        participantsByJoin={participants}
        joinIndexById={{ 'admin-1': 1, [PLAYER_UID]: 2, [TARGET_UID]: 3 }}
        getDisplayName={(name: string) => name.split(' ')[0]}
        commentsForPlayer={[COMMENT]}
        showFancyAlert={jest.fn()}
        locale="en"
      />
    );
    expect(getByText('1. Admin')).toBeTruthy();
  });
});
