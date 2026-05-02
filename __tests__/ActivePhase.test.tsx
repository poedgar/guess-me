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
let mockGivePointsToTarget: jest.Mock;
jest.mock('@/contexts/GameContext', () => ({
  useGame: () => ({
    loading: mockLoading,
    submitComment: jest.fn(),
    showComments: jest.fn(),
    givePoints: jest.fn(),
    finishGivingPoints: jest.fn(),
    givePointsToTarget: (...args: unknown[]) => mockGivePointsToTarget(...args),
    startGuessingPhase: jest.fn(),
    skipPostCommentPhase: jest.fn(),
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
jest.mock('@/components/game/PostGuessingPointsPanel', () => ({
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

const { ActivePhase } = require('../components/game/ActivePhase');

const PLAYER_UID = 'player-1';
const TARGET_UID = 'target-1';
const TARGET_NAME = 'Bob Smith';

const participants = [
  { userId: 'admin-1', displayName: 'Admin User', joinedAt: 0 },
  { userId: PLAYER_UID, displayName: 'Alice Player', joinedAt: 1 },
  { userId: TARGET_UID, displayName: TARGET_NAME, joinedAt: 2 },
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

describe('ActivePhase — 3.3 give points to target includes name', () => {
  let mockShowFancyAlert: jest.Mock;
  let mockShowFaceMessage: jest.Mock;

  beforeEach(() => {
    mockGivePointsToTarget = jest.fn().mockResolvedValue(undefined);
    mockShowFancyAlert = jest.fn();
    mockShowFaceMessage = jest.fn();
  });

  it('face message after giving points includes the target player display name', async () => {
    const { getByText } = render(
      <ActivePhase
        game={makeGame()}
        isAdmin={false}
        user={{ uid: PLAYER_UID }}
        participantsByJoin={participants}
        joinIndexById={joinIndexById}
        getDisplayName={(name: string) => name.split(' ')[0]}
        showFancyAlert={mockShowFancyAlert}
        showFaceMessage={mockShowFaceMessage}
        locale="en"
        isDark={false}
      />
    );

    // Points buttons 0..2 should be visible; press "1"
    fireEvent.press(getByText('1'));

    // Confirmation dialog should appear
    expect(mockShowFancyAlert).toHaveBeenCalled();
    const buttons: Array<{ text: string; onPress?: () => Promise<void> }> =
      mockShowFancyAlert.mock.calls[0][2];
    const yesBtn = buttons.find((b) => b.text === 'common.yes');
    expect(yesBtn).toBeDefined();

    await act(async () => {
      await yesBtn!.onPress!();
    });

    // showFaceMessage must include the target's name ('Bob' = getDisplayName('Bob Smith'))
    expect(mockShowFaceMessage).toHaveBeenCalled();
    const message: string = mockShowFaceMessage.mock.calls[0][0];
    expect(message).toContain('Bob');
  });
});

// ─── 7.1 points-selection buttons must have accessibilityLabel ───────────────

describe('ActivePhase — 7.1 points-selection buttons have accessibilityLabel', () => {
  beforeEach(() => {
    mockGivePointsToTarget = jest.fn().mockResolvedValue(undefined);
  });

  it('each points button carries an accessibilityLabel with its value', () => {
    const { getByLabelText } = render(
      <ActivePhase
        game={makeGame()}
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
    // t('game.ui.givePointsLabel', { locale, count: 1 }) → 'game.ui.givePointsLabel[1]' via mock
    expect(getByLabelText('game.ui.givePointsLabel[1]')).toBeTruthy();
  });
});

// ─── 6.1 loading text must use t('common.loading') ───────────────────────────

describe('ActivePhase — 6.1 loading text uses i18n key', () => {
  beforeEach(() => {
    mockLoading = true;
    mockGivePointsToTarget = jest.fn();
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
