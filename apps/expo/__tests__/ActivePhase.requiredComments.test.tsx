// Regression coverage: requiredComments under-counted by one when
// adminWritesComments is true and the round's target is not the admin
// (returned participants.length - 2 instead of participants.length - 1,
// diverging from expectedCommenters' filter logic used elsewhere in this
// same file). This let the admin's "Show Comments" button skip the
// "not everyone has submitted" warning one comment early.
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Alert } from 'react-native';

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

const mockShowComments = jest.fn().mockResolvedValue(undefined);
jest.mock('@/contexts/GameContext', () => ({
  useGame: () => ({
    loading: false,
    submitComment: jest.fn(),
    showComments: mockShowComments,
    awardCommentPoints: jest.fn(),
    activateNextComment: jest.fn(),
    rateTargetReaction: jest.fn(),
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

const ADMIN_UID = 'admin-1';
const PLAYER_UID = 'player-1';
const TARGET_UID = 'target-1';

const participants = [
  { userId: ADMIN_UID, userName: 'Admin User', displayName: 'Admin User', joinedAt: 0 },
  { userId: PLAYER_UID, userName: 'Alice Player', displayName: 'Alice Player', joinedAt: 1 },
  { userId: TARGET_UID, userName: 'Bob Smith', displayName: 'Bob Smith', joinedAt: 2 },
];

const joinIndexById: Record<string, number> = { [ADMIN_UID]: 1, [PLAYER_UID]: 2, [TARGET_UID]: 3 };

function makeGame(overrides: Record<string, unknown> = {}) {
  return {
    id: 'game-1',
    adminId: ADMIN_UID,
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
      targetUserName: 'Bob Smith',
      // Only the admin has submitted — player-1 has not. With
      // adminWritesComments:true and a non-admin target, 2 commenters are
      // expected (admin + player-1), so 1 received should still be short.
      comments: [{ id: 'c1', text: 'Great player', authorId: ADMIN_UID, points: undefined }],
      commentsVisible: false,
      pointsGiven: false,
      targetPointsGivenBy: [],
    },
    ...overrides,
  };
}

function renderPanel() {
  return render(
    <ActivePhase
      game={makeGame()}
      isAdmin={true}
      user={{ uid: ADMIN_UID }}
      participantsByJoin={participants}
      joinIndexById={joinIndexById}
      getDisplayName={(name: string) => name.split(' ')[0]}
      showFancyAlert={jest.fn()}
      showFaceMessage={jest.fn()}
      locale="en"
      isDark={false}
    />,
  );
}

describe('ActivePhase — requiredComments off-by-one (adminWritesComments true, non-admin target)', () => {
  it('warns before showing comments when only the admin (not all expected commenters) has submitted', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByLabelText } = renderPanel();

    await act(async () => {
      fireEvent.press(getByLabelText('game.ui.startReview'));
    });

    expect(alertSpy).toHaveBeenCalled();
    expect(mockShowComments).not.toHaveBeenCalled();
  });

  it('does not warn once every expected commenter (admin + non-target players) has submitted', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByLabelText } = render(
      <ActivePhase
        game={makeGame({
          currentRound: {
            roundNumber: 1,
            targetUserId: TARGET_UID,
            targetUserName: 'Bob Smith',
            comments: [
              { id: 'c1', text: 'Great player', authorId: ADMIN_UID, points: undefined },
              { id: 'c2', text: 'Nice work', authorId: PLAYER_UID, points: undefined },
            ],
            commentsVisible: false,
            pointsGiven: false,
            targetPointsGivenBy: [],
          },
        })}
        isAdmin={true}
        user={{ uid: ADMIN_UID }}
        participantsByJoin={participants}
        joinIndexById={joinIndexById}
        getDisplayName={(name: string) => name.split(' ')[0]}
        showFancyAlert={jest.fn()}
        showFaceMessage={jest.fn()}
        locale="en"
        isDark={false}
      />,
    );

    await act(async () => {
      fireEvent.press(getByLabelText('game.ui.startReview'));
    });

    expect(alertSpy).not.toHaveBeenCalled();
    expect(mockShowComments).toHaveBeenCalled();
  });
});

describe('ActivePhase — requiredComments unaffected when adminWritesComments is off', () => {
  it('still warns with only 1 of 2 expected non-admin commenters submitted (unchanged behavior)', async () => {
    // 4 participants so there are 2 non-admin, non-target commenters expected.
    const fourParticipants = [
      ...participants,
      { userId: 'player-2', userName: 'Carol Player', displayName: 'Carol Player', joinedAt: 3 },
    ];
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByLabelText } = render(
      <ActivePhase
        game={makeGame({
          adminWritesComments: false,
          participants: fourParticipants,
          currentRound: {
            roundNumber: 1,
            targetUserId: TARGET_UID,
            targetUserName: 'Bob Smith',
            comments: [{ id: 'c1', text: 'Nice work', authorId: PLAYER_UID, points: undefined }],
            commentsVisible: false,
            pointsGiven: false,
            targetPointsGivenBy: [],
          },
        })}
        isAdmin={true}
        user={{ uid: ADMIN_UID }}
        participantsByJoin={fourParticipants}
        joinIndexById={{ ...joinIndexById, 'player-2': 4 }}
        getDisplayName={(name: string) => name.split(' ')[0]}
        showFancyAlert={jest.fn()}
        showFaceMessage={jest.fn()}
        locale="en"
        isDark={false}
      />,
    );

    await act(async () => {
      fireEvent.press(getByLabelText('game.ui.startReview'));
    });

    expect(alertSpy).toHaveBeenCalled();
    expect(mockShowComments).not.toHaveBeenCalled();
  });
});
