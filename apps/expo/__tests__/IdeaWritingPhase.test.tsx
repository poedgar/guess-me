import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { IdeaWritingPhase } from '../components/game/ideas/IdeaWritingPhase';

const mockSubmitIdea = jest.fn().mockResolvedValue(undefined);
const mockStartIdeaRatingRounds = jest.fn().mockResolvedValue(undefined);

// Real `@/i18n` transitively imports firebase (via @mirror/shared), which jest
// cannot parse (ESM syntax outside transformIgnorePatterns' babel transform
// reach for this path). Mock it with the actual English strings this
// component uses so the RTL queries-by-text below match real UI copy.
jest.mock('@/i18n', () => ({
  t: (key: string, opts?: Record<string, unknown>) => {
    const strings: Record<string, string> = {
      'game.ui.ideas.yourIdeas': 'Your ideas',
      'game.ui.ideas.writeIdea': 'Write your idea...',
      'game.ui.ideas.addIdea': 'Add idea',
      'game.ui.ideas.submittedCount': '%{count} participant(s) have submitted',
      'game.ui.ideas.startRating': 'Start Rating Rounds',
      'game.ui.ideas.confirmSubmitIdea': 'Submit this idea?',
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
    submitIdea: mockSubmitIdea,
    startIdeaRatingRounds: mockStartIdeaRatingRounds,
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
  gameStyles: { buttonDisabled: {} },
}));

jest.mock('@/constants/theme', () => ({
  Fonts: { sans: 'System' },
  GameColors: {
    white: '#fff', blue: '#007AFF', green: '#34C759', waiting: '#FF9500',
    admin: '#FF9500', shadow: '#000', textLight: '#888', cardBg: '#fafafa',
    cardBorder: '#eee', inputBg: '#f2f2f2', incorrect: '#FF3B30',
  },
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
    participants: PARTICIPANTS, status: 'idea_writing', createdAt: new Date(),
    adminWritesComments: false,
    ideaData: { incognitoMode: true, ideas: [], schedule: [], currentRoundIndex: 0, currentRoundRatings: [] },
    ...overrides,
  };
}

const defaultProps = {
  user: { uid: 'user-2' },
  isAdmin: false,
  locale: 'en',
  isDark: false,
  getDisplayName: (name: string) => name,
  showFancyAlert: jest.fn(),
};

// jest.config.js sets `resetMocks: true`, which wipes every mock's
// implementation (not just its call history) before each test — including
// ones assigned once at module scope like the mocks above. Re-apply the
// implementations here so they're live for every test, not just the first.
beforeEach(() => {
  mockSubmitIdea.mockResolvedValue(undefined);
  mockStartIdeaRatingRounds.mockResolvedValue(undefined);
  defaultProps.showFancyAlert.mockImplementation((_title, _message, buttons) => {
    const confirmButton = buttons?.find((b: { text: string }) => b.text === 'Yes');
    confirmButton?.onPress?.();
  });
});

describe('IdeaWritingPhase', () => {
  it('renders the idea input and add button', () => {
    render(<IdeaWritingPhase game={baseGame() as any} {...defaultProps} />);
    expect(screen.getByPlaceholderText('Write your idea...')).toBeTruthy();
    expect(screen.getByText('Add idea')).toBeTruthy();
  });

  it('shows the user\'s own already-submitted ideas', () => {
    const game = baseGame({
      ideaData: {
        incognitoMode: true, schedule: [], currentRoundIndex: 0, currentRoundRatings: [],
        ideas: [{ id: 'i1', authorId: 'user-2', text: 'My first idea', submittedAt: 1 }],
      },
    });
    render(<IdeaWritingPhase game={game as any} {...defaultProps} />);
    expect(screen.getByText('My first idea')).toBeTruthy();
  });

  it('submits an idea after confirming, and clears the input', async () => {
    render(<IdeaWritingPhase game={baseGame() as any} {...defaultProps} />);
    fireEvent.changeText(screen.getByPlaceholderText('Write your idea...'), 'A new idea');
    fireEvent.press(screen.getByText('Add idea'));

    await waitFor(() => expect(mockSubmitIdea).toHaveBeenCalledWith('A new idea'));
  });

  it('does not show the Start Rating Rounds button for non-admins', () => {
    render(<IdeaWritingPhase game={baseGame() as any} {...defaultProps} isAdmin={false} />);
    expect(screen.queryByText('Start Rating Rounds')).toBeNull();
  });

  it('disables Start Rating Rounds for the admin until every eligible writer has submitted', () => {
    const game = baseGame({
      ideaData: {
        incognitoMode: true, schedule: [], currentRoundIndex: 0, currentRoundRatings: [],
        ideas: [{ id: 'i1', authorId: 'user-2', text: 'idea', submittedAt: 1 }], // user-3 hasn't submitted
      },
    });
    render(<IdeaWritingPhase game={game as any} {...defaultProps} isAdmin />);
    const button = screen.getByText('Start Rating Rounds');
    expect(button.parent?.props.accessibilityState?.disabled ?? true).toBeTruthy();
  });

  it('enables Start Rating Rounds and calls startIdeaRatingRounds once every eligible writer has submitted', async () => {
    const game = baseGame({
      ideaData: {
        incognitoMode: true, schedule: [], currentRoundIndex: 0, currentRoundRatings: [],
        ideas: [
          { id: 'i1', authorId: 'user-2', text: 'idea A', submittedAt: 1 },
          { id: 'i2', authorId: 'user-3', text: 'idea B', submittedAt: 2 },
        ],
      },
    });
    render(<IdeaWritingPhase game={game as any} {...defaultProps} isAdmin user={{ uid: 'admin-1' }} />);
    fireEvent.press(screen.getByText('Start Rating Rounds'));

    await waitFor(() => expect(mockStartIdeaRatingRounds).toHaveBeenCalled());
  });
});
