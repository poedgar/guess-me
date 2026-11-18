// TDD – Fix 3.3: face message after giving points to target must include the target's name.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

// t() mock: returns "key[val1:val2]" so we can assert on interpolated values
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

let mockLoading = false;
let mockRateTargetReaction: jest.Mock;
jest.mock('@/contexts/GameContext', () => ({
  useGame: () => ({
    loading: mockLoading,
    submitComment: jest.fn(),
    showComments: jest.fn(),
    awardCommentPoints: jest.fn(),
    activateNextComment: jest.fn(),
    rateTargetReaction: (...args: unknown[]) => mockRateTargetReaction(...args),
    startGuessingPhase: jest.fn(),
  }),
}));

jest.mock('@/components/themed-text', () => {
  const { Text } = require('react-native');
  return { ThemedText: ({ children, ...p }: any) => <Text {...p}>{children}</Text> };
});
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/ui/FaceMessage', () => ({ FaceMessage: () => null }));
jest.mock('@/components/ui/SuccessAnimation', () => ({ SuccessAnimation: () => null }));
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
    activeTint: '#fff', activeTintBorder: '#eee',
    cardBg: '#fafafa', white: '#fff', blue: '#007AFF',
    purple: '#AF52DE', admin: '#FF9500', green: '#34C759',
    shadow: '#000', textLight: '#888', textDark: '#000',
    lightPageBg: '#f2f2f7', cardBorder: '#e0e0e0',
    correct: '#34C759', incorrect: '#FF3B30',
    correctBg: '#e6f9ed', incorrectBg: '#fff0f0',
    danger: '#FF3B30', overlayBg: 'rgba(0,0,0,0.5)',
  },
  StatusColors: { active: '#34C759' },
  themedInput: () => ({ style: {}, placeholderTextColor: '#999' }),
}));

const { ActivePhase } = require('../components/game/mirror/ActivePhase');

const PLAYER_UID = 'player-1';
const TARGET_UID = 'target-1';
const TARGET_NAME = 'Bob Smith';

const participants = [
  { userId: 'admin-1', userName: 'Admin User', displayName: 'Admin User', joinedAt: 0 },
  { userId: PLAYER_UID, userName: 'Alice Player', displayName: 'Alice Player', joinedAt: 1 },
  { userId: TARGET_UID, userName: TARGET_NAME, displayName: TARGET_NAME, joinedAt: 2 },
];

const joinIndexById: Record<string, number> = {
  'admin-1': 1,
  [PLAYER_UID]: 2,
  [TARGET_UID]: 3,
};

function makeGame(overrides: Record<string, unknown> = {}) {
  return {
    id: 'game-1',
    adminId: 'admin-1',
    adminName: 'Admin User',
    status: 'active',
    adminWritesComments: true,
    showSurnames: true,
    participants,
    playersWhoCompletedPostCommentPhase: [],
    scores: {},
    postGuessingPointPhase: false,
    currentRound: {
      roundNumber: 1,
      targetUserId: TARGET_UID,
      targetUserName: TARGET_NAME,
      comments: [
        { id: 'c1', text: 'Great player', authorId: 'admin-1', points: 5 },
        // player-1 has already submitted a comment → no comment form shown
        { id: 'c2', text: 'Nice work', authorId: PLAYER_UID, points: undefined },
      ],
      commentsVisible: true,
      pointsGiven: true,
      targetPointsGivenBy: [],
    },
    ...overrides,
  };
}

function makeReviewInProgressGame(overrides: Record<string, unknown> = {}) {
  return {
    id: 'game-1',
    adminId: 'admin-1',
    adminName: 'Admin User',
    status: 'active',
    adminWritesComments: true,
    showSurnames: true,
    participants,
    scores: {},
    postGuessingPointPhase: false,
    currentRound: {
      roundNumber: 1,
      targetUserId: TARGET_UID,
      targetUserName: TARGET_NAME,
      comments: [
        // Authored by the viewing player themselves — the design allows a
        // comment's own author to rate the target's reaction to it too.
        { id: 'c1', text: 'Great player', authorId: PLAYER_UID, points: 1, targetReactionPoints: {} },
      ],
      commentsVisible: true,
      pointsGiven: false,
      activeCommentIndex: 0,
    },
    ...overrides,
  };
}

describe('ActivePhase — rating the target\'s reaction to the active comment', () => {
  beforeEach(() => {
    mockRateTargetReaction = jest.fn().mockResolvedValue(undefined);
  });

  it('shows accessible rating buttons for the active, already-decided comment', () => {
    const { getByLabelText } = render(
      <ActivePhase
        game={makeReviewInProgressGame()}
        isAdmin={false}
        user={{ uid: PLAYER_UID }}
        participantsByJoin={participants}
        joinIndexById={joinIndexById}
        getDisplayName={(name: string) => name.split(' ')[0]}
        showFancyAlert={jest.fn()}
        showFaceMessage={jest.fn()}
        locale="en"
        isDark={false}
      />
    );
    expect(getByLabelText('game.ui.rateReactionPositive')).toBeTruthy();
    expect(getByLabelText('game.ui.rateReactionNone')).toBeTruthy();
  });

  it('calls rateTargetReaction with the active comment id and chosen points', async () => {
    const { getByLabelText } = render(
      <ActivePhase
        game={makeReviewInProgressGame()}
        isAdmin={false}
        user={{ uid: PLAYER_UID }}
        participantsByJoin={participants}
        joinIndexById={joinIndexById}
        getDisplayName={(name: string) => name.split(' ')[0]}
        showFancyAlert={jest.fn()}
        showFaceMessage={jest.fn()}
        locale="en"
        isDark={false}
      />
    );

    await act(async () => {
      fireEvent.press(getByLabelText('game.ui.rateReactionPositive'));
    });

    expect(mockRateTargetReaction).toHaveBeenCalledWith('c1', 1);
  });
});

// ─── 6.1 loading text must use t('common.loading') ───────────────────────────

describe('ActivePhase — 6.1 loading text uses i18n key', () => {
  beforeEach(() => {
    mockLoading = true;
    mockRateTargetReaction = jest.fn();
  });

  afterEach(() => {
    mockLoading = false;
  });

  it('shows t("common.loading") not hardcoded Ukrainian when loading', () => {
    // makeGame() has commentsVisible: true, so the "start guessing phase" button renders.
    // isAdmin: true makes the admin controls visible.
    const { queryByText, getByText } = render(
      <ActivePhase
        game={makeGame()}
        isAdmin
        user={{ uid: 'admin-1' }}
        participantsByJoin={participants}
        joinIndexById={joinIndexById}
        getDisplayName={(name: string) => name.split(' ')[0]}
        showFancyAlert={jest.fn()}
        showFaceMessage={jest.fn()}
        locale="en"
        isDark={false}
      />
    );
    // Hardcoded Ukrainian string must NOT be present
    expect(queryByText('Завантаження...')).toBeNull();
    // The i18n key (returned as-is by the t() mock) must be present
    expect(getByText('common.loading')).toBeTruthy();
  });
});

// ─── admin comment-completion checklist ──────────────────────────────────────

describe('ActivePhase — admin comment-completion checklist', () => {
  function makeWritingPhaseGame(overrides: Record<string, unknown> = {}) {
    return {
      id: 'game-1',
      adminId: 'admin-1',
      adminName: 'Admin User',
      status: 'active',
      adminWritesComments: true,
      showSurnames: true,
      participants,
      playersWhoCompletedPostCommentPhase: [],
      scores: {},
      postGuessingPointPhase: false,
      currentRound: {
        roundNumber: 1,
        targetUserId: TARGET_UID,
        targetUserName: TARGET_NAME,
        // Only player-1 has submitted so far; admin-1 (expected, since
        // adminWritesComments is true) has not.
        comments: [
          { id: 'c1', text: 'Nice work', authorId: PLAYER_UID },
        ],
        commentsVisible: false,
        pointsGiven: false,
        targetPointsGivenBy: [],
      },
      ...overrides,
    };
  }

  beforeEach(() => {
    mockRateTargetReaction = jest.fn().mockResolvedValue(undefined);
  });

  it('shows the checklist with progress count and per-player status while writing', () => {
    const { getByText } = render(
      <ActivePhase
        game={makeWritingPhaseGame()}
        isAdmin
        user={{ uid: 'admin-1' }}
        participantsByJoin={participants}
        joinIndexById={joinIndexById}
        playerNumbers={joinIndexById}
        getDisplayName={(name: string) => name.split(' ')[0]}
        showFancyAlert={jest.fn()}
        showFaceMessage={jest.fn()}
        locale="en"
        isDark={false}
      />
    );

    expect(getByText('game.ui.commentersStatusTitle')).toBeTruthy();
    // received=1, required=2 (admin-1 and player-1 are expected; target-1 excluded)
    expect(getByText('game.ui.commentsProgress[1:2]')).toBeTruthy();
    // player-1 already submitted
    expect(getByText(`✅ game.ui.submitted`)).toBeTruthy();
    // admin-1 has not
    expect(getByText(`⏳ game.ui.pending`)).toBeTruthy();
  });

  it('does not show the checklist once comments are visible', () => {
    const { queryByText } = render(
      <ActivePhase
        game={makeWritingPhaseGame({
          currentRound: {
            roundNumber: 1,
            targetUserId: TARGET_UID,
            targetUserName: TARGET_NAME,
            comments: [
              { id: 'c1', text: 'Nice work', authorId: PLAYER_UID },
              { id: 'c2', text: 'Great too', authorId: 'admin-1' },
            ],
            commentsVisible: true,
            pointsGiven: false,
            targetPointsGivenBy: [],
          },
        })}
        isAdmin
        user={{ uid: 'admin-1' }}
        participantsByJoin={participants}
        joinIndexById={joinIndexById}
        playerNumbers={joinIndexById}
        getDisplayName={(name: string) => name.split(' ')[0]}
        showFancyAlert={jest.fn()}
        showFaceMessage={jest.fn()}
        locale="en"
        isDark={false}
      />
    );

    expect(queryByText('game.ui.commentersStatusTitle')).toBeNull();
  });

  it('is not shown to non-admin players', () => {
    const { queryByText } = render(
      <ActivePhase
        game={makeWritingPhaseGame()}
        isAdmin={false}
        user={{ uid: PLAYER_UID }}
        participantsByJoin={participants}
        joinIndexById={joinIndexById}
        playerNumbers={joinIndexById}
        getDisplayName={(name: string) => name.split(' ')[0]}
        showFancyAlert={jest.fn()}
        showFaceMessage={jest.fn()}
        locale="en"
        isDark={false}
      />
    );

    expect(queryByText('game.ui.commentersStatusTitle')).toBeNull();
  });
});
