import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { IdeaRatingPhase } from '../components/game/ideas/IdeaRatingPhase';

const mockSubmitIdeaRating = jest.fn().mockResolvedValue(undefined);
const mockStartNextIdeaRound = jest.fn().mockResolvedValue(undefined);

// Real `@/i18n` transitively imports firebase (via @mirror/shared), which jest
// cannot parse (ESM syntax outside transformIgnorePatterns' babel transform
// reach for this path). Mock it with the actual English strings this
// component uses so the RTL queries-by-text below match real UI copy.
jest.mock('@/i18n', () => ({
  t: (key: string, opts?: Record<string, unknown>) => {
    const strings: Record<string, string> = {
      'game.ui.statusLabel': 'Status',
      'game.ui.ideas.round': 'Round %{current} of %{total}',
      'game.ui.ideas.pointsLabel': 'Points',
      'game.ui.ideas.commentPlaceholder': 'Optional anonymous comment...',
      'game.ui.ideas.submitRating': 'Submit Rating',
      'game.ui.ideas.waitingForRatings': '%{count}/%{total} rated',
      'game.ui.ideas.nextRound': 'Next Round',
      'game.ui.ideas.finishGame': 'Finish Game',
      'game.ui.ideas.notEligibleToRate': 'You are not participating in ratings this game.',
      'game.ui.ideas.commentsHeading': 'Comments',
      'game.ui.ideas.confirmSubmitRating': 'Submit this rating?',
      'game.alerts.confirmTitle': 'Confirmation',
      'common.cancel': 'Cancel',
      'common.yes': 'Yes',
      'common.error': 'Error',
    };
    let str = strings[key] ?? key;
    if (opts) {
      Object.entries(opts).forEach(([k, v]) => {
        if (k === 'locale') return;
        str = str.replace(new RegExp(`%\\{${k}\\}`, 'g'), String(v));
      });
    }
    return str;
  },
}));

jest.mock('@/contexts/GameContext', () => ({
  useGame: () => ({
    submitIdeaRating: mockSubmitIdeaRating,
    startNextIdeaRound: mockStartNextIdeaRound,
  }),
}));

jest.mock('@/contexts/SoundContext', () => ({
  useSound: () => ({ playSound: jest.fn().mockResolvedValue(undefined) }),
}));

// Loading the real versions of these (as BasketWritingPhase.test.tsx's mocks
// also avoid) pulls in native/font modules that break RNTL's host-component
// detection in this jest environment, so mock them the same way.
jest.mock('@/components/themed-text', () => {
  const { Text } = require('react-native');
  return { ThemedText: ({ children, ...p }: any) => <Text {...p}>{children}</Text> };
});

jest.mock('@/components/ui/icon-symbol', () => {
  const { Text } = require('react-native');
  return { IconSymbol: ({ name }: any) => <Text>{name}</Text> };
});

jest.mock('@/components/game/GameHeader', () => ({}));

jest.mock('@/components/game/gameStyles', () => ({
  gameStyles: {
    buttonDisabled: {},
    statusLabel: {},
    statusBadge: {},
    statusText: {},
  },
}));

jest.mock('@/constants/theme', () => ({
  Fonts: { sans: 'System' },
  GameColors: {
    white: '#fff', blue: '#007AFF', green: '#34C759', waiting: '#FF9500',
    admin: '#FF9500', purple: '#AF52DE', shadow: '#000', textLight: '#888',
    cardBg: '#fafafa', cardBorder: '#eee', inputBg: '#f2f2f2', incorrect: '#FF3B30',
  },
  StatusColors: { guessing_phase: '#AF52DE' },
  themedInput: () => ({ style: {}, placeholderTextColor: '#ccc' }),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));

const PARTICIPANTS = [
  { userId: 'admin-1', userName: 'Admin', userEmail: 'a@test.com', joinedAt: new Date() },
  { userId: 'user-2', userName: 'Bob', userEmail: 'b@test.com', joinedAt: new Date() },
  { userId: 'user-3', userName: 'Carol', userEmail: 'c@test.com', joinedAt: new Date() },
];

function baseGame(overrides: Record<string, unknown> = {}) {
  return {
    id: 'game-1', adminId: 'admin-1', adminName: 'Admin', adminEmail: 'a@test.com',
    participants: PARTICIPANTS, status: 'idea_rating', createdAt: new Date(),
    adminWritesComments: false,
    ideaData: {
      incognitoMode: true,
      ideas: [{ id: 'i1', authorId: 'user-3', text: 'The current round idea', submittedAt: 1 }],
      schedule: ['user-3', 'user-2'], currentRoundIndex: 0, currentRoundRatings: [],
    },
    ...overrides,
  };
}

const defaultProps = {
  isAdmin: false,
  locale: 'en',
  isDark: false,
  getDisplayName: (name: string) => name,
  showFancyAlert: jest.fn((title, message, buttons) => {
    const confirmButton = buttons?.find((b: { text: string }) => b.text === 'Yes');
    confirmButton?.onPress?.();
  }),
};

// jest.config.js sets `resetMocks: true`, which wipes every mock's
// implementation (not just its call history) before each test — including
// ones assigned once at module scope like the mocks above. Re-apply the
// implementations here so they're live for every test, not just the first.
beforeEach(() => {
  mockSubmitIdeaRating.mockClear();
  mockSubmitIdeaRating.mockResolvedValue(undefined);
  mockStartNextIdeaRound.mockClear();
  mockStartNextIdeaRound.mockResolvedValue(undefined);
  defaultProps.showFancyAlert.mockImplementation((_title, _message, buttons) => {
    const confirmButton = buttons?.find((b: { text: string }) => b.text === 'Yes');
    confirmButton?.onPress?.();
  });
});

describe('IdeaRatingPhase', () => {
  it('renders the current round\'s idea and point buttons for an eligible rater', () => {
    render(<IdeaRatingPhase game={baseGame() as any} {...defaultProps} user={{ uid: 'user-2' }} />);
    expect(screen.getByText('The current round idea')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('shows the idea to its own author too, without singling them out', () => {
    // user-3 is the current round's author — should see the same rating UI as anyone else.
    render(<IdeaRatingPhase game={baseGame() as any} {...defaultProps} user={{ uid: 'user-3' }} />);
    expect(screen.getByText('The current round idea')).toBeTruthy();
    expect(screen.getByText('Submit Rating')).toBeTruthy();
  });

  it('hides rating controls for a non-eligible viewer (e.g. admin with adminWritesComments off)', () => {
    render(<IdeaRatingPhase game={baseGame() as any} {...defaultProps} user={{ uid: 'admin-1' }} isAdmin />);
    expect(screen.queryByText('Submit Rating')).toBeNull();
    expect(screen.getByText('You are not participating in ratings this game.')).toBeTruthy();
  });

  it('submits a rating with the selected points after confirming', async () => {
    render(<IdeaRatingPhase game={baseGame() as any} {...defaultProps} user={{ uid: 'user-2' }} />);
    fireEvent.press(screen.getByText('4'));
    fireEvent.press(screen.getByText('Submit Rating'));

    await waitFor(() => expect(mockSubmitIdeaRating).toHaveBeenCalledWith('i1', 4, undefined));
  });

  it('shows the comment textarea only in incognito mode', () => {
    const openGame = baseGame({ ideaData: { ...baseGame().ideaData, incognitoMode: false } });
    render(<IdeaRatingPhase game={openGame as any} {...defaultProps} user={{ uid: 'user-2' }} />);
    expect(screen.queryByPlaceholderText('Optional anonymous comment...')).toBeNull();
  });

  it('shows unattributed comments from ratings already submitted this round', () => {
    const game = baseGame({
      ideaData: {
        ...baseGame().ideaData,
        currentRoundRatings: [{ raterId: 'user-2', ideaId: 'i1', points: 5, comment: 'Great idea!' }],
      },
    });
    render(<IdeaRatingPhase game={game as any} {...defaultProps} user={{ uid: 'admin-1' }} isAdmin />);
    // The component wraps comments in curly quotes via &ldquo;/&rdquo; (matching
    // apps/web's authoritative IdeaRatingPhase), not straight ASCII quotes.
    expect(screen.getByText('“Great idea!”')).toBeTruthy();
  });

  it('disables Next Round for the admin until every eligible rater has rated every idea', () => {
    render(<IdeaRatingPhase game={baseGame() as any} {...defaultProps} user={{ uid: 'admin-1' }} isAdmin />);
    const button = screen.getByText('Next Round');
    expect(button.parent?.props.accessibilityState?.disabled ?? true).toBeTruthy();
  });

  it('calls startNextIdeaRound once every eligible rater has rated', async () => {
    const game = baseGame({
      ideaData: {
        ...baseGame().ideaData,
        currentRoundRatings: [
          { raterId: 'user-2', ideaId: 'i1', points: 5 },
          { raterId: 'user-3', ideaId: 'i1', points: 4 },
        ],
      },
    });
    render(<IdeaRatingPhase game={game as any} {...defaultProps} user={{ uid: 'admin-1' }} isAdmin />);
    fireEvent.press(screen.getByText('Next Round'));

    await waitFor(() => expect(mockStartNextIdeaRound).toHaveBeenCalled());
  });
});
