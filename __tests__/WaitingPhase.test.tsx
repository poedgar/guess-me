// TDD – Fix 3.5: copy button must disable and swap to checkmark for 1s after copy.
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

let mockSetGameType = jest.fn();

jest.mock('@/contexts/GameContext', () => ({
  useGame: () => ({
    loading: false,
    startGame: jest.fn(),
    updateAdminWritesComments: jest.fn(),
    updateShowSurnames: jest.fn(),
    updateTargetSelectionMode: jest.fn(),
    updateShowGuessResults: jest.fn(),
    setGameType: mockSetGameType,
  }),
}));

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ locale: 'en' }),
}));

jest.mock('@/components/themed-text', () => {
  const { Text } = require('react-native');
  return { ThemedText: ({ children, ...p }: any) => <Text {...p}>{children}</Text> };
});

let capturedIconProps: any = null;
jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: (props: any) => {
    capturedIconProps = props;
    const { Text } = require('react-native');
    return <Text testID={`icon-${props.name}`}>{props.name}</Text>;
  },
}));

jest.mock('@/components/ui/PlayerAvatar', () => ({ PlayerAvatar: () => null }));
jest.mock('@/components/ui/TargetControlPanel', () => ({ TargetControlPanel: () => null }));
jest.mock('@/components/game/GameHeader', () => ({ GameHeader: () => null }));
jest.mock('@/components/game/Leaderboard', () => ({ Leaderboard: () => null }));
jest.mock('react-native-qrcode-svg', () => 'QRCode');
jest.mock('@/components/game/gameStyles', () => ({
  gameStyles: { statusLabel: {}, statusBadge: {}, statusText: {}, buttonDisabled: {}, gameFlowContainer: {} },
}));
jest.mock('@/constants/theme', () => ({
  Fonts: { sans: 'System' },
  GameColors: {
    waitingTint: '#fff', waitingTintBorder: '#eee', cardBg: '#fafafa',
    white: '#fff', blue: '#007AFF', green: '#34C759', waiting: '#FF9500',
    shadow: '#000', textLight: '#888', admin: '#FF9500', correct: '#34C759',
    inputBg: '#f2f2f2', inputDark: '#1c1c1e', placeholderLight: '#ccc',
  },
  StatusColors: { waiting: '#FF9500' },
}));

const { WaitingPhase } = require('../components/game/mirror/WaitingPhase');

const USER_UID = 'admin-1';

const baseGame = {
  id: 'GAME-XYZ',
  adminId: USER_UID,
  adminName: 'Admin',
  status: 'waiting',
  adminWritesComments: false,
  showSurnames: true,
  targetSelectionMode: 'random',
  showGuessResults: false,
  participants: [
    { userId: USER_UID, displayName: 'Admin', userName: 'Admin', joinedAt: 0 },
    { userId: 'p2', displayName: 'Bob', userName: 'Bob', joinedAt: 1 },
  ],
  scores: {},
};

describe('WaitingPhase — 3.5 copy button visual feedback', () => {
  beforeEach(() => {
    mockSetGameType = jest.fn();
    jest.useFakeTimers();
    capturedIconProps = null;
  });

  afterEach(() => {
    jest.runAllTimers();
    jest.useRealTimers();
  });

  it('shows tapToCopy hint before copy', () => {
    const { queryByText } = render(
      <WaitingPhase
        game={baseGame}
        isAdmin={true}
        user={{ uid: USER_UID }}
        participantsByJoin={baseGame.participants}
        joinIndexById={{ [USER_UID]: 1, p2: 2 }}
        getDisplayName={(n: string) => n}
        showFancyAlert={jest.fn()}
        showFaceMessage={jest.fn()}
        locale="en"
        isDark={false}
        onCopyGameId={jest.fn()}
      />
    );
    expect(queryByText('game.ui.tapToCopy')).toBeTruthy();
  });

  it('hides tapToCopy hint immediately after copy and restores it after 1s', async () => {
    const mockOnCopy = jest.fn().mockResolvedValue(undefined);
    const { queryByText, queryByTestId } = render(
      <WaitingPhase
        game={baseGame}
        isAdmin={true}
        user={{ uid: USER_UID }}
        participantsByJoin={baseGame.participants}
        joinIndexById={{ [USER_UID]: 1, p2: 2 }}
        getDisplayName={(n: string) => n}
        showFancyAlert={jest.fn()}
        showFaceMessage={jest.fn()}
        locale="en"
        isDark={false}
        onCopyGameId={mockOnCopy}
      />
    );

    // Before copy — hint visible, no checkmark
    expect(queryByText('game.ui.tapToCopy')).toBeTruthy();
    expect(queryByTestId('icon-checkmark.circle.fill')).toBeNull();

    // Press the copy button (accessible by label)
    const btn = queryByText('GAME-XYZ')!.parent!;
    fireEvent.press(btn);

    await act(async () => { await Promise.resolve(); });

    // Immediately after copy — hint gone, checkmark visible
    expect(queryByText('game.ui.tapToCopy')).toBeNull();
    expect(queryByTestId('icon-checkmark.circle.fill')).toBeTruthy();

    // After 1 second — hint restored, checkmark gone
    act(() => { jest.advanceTimersByTime(1000); });
    expect(queryByText('game.ui.tapToCopy')).toBeTruthy();
    expect(queryByTestId('icon-checkmark.circle.fill')).toBeNull();
  });
});

describe('WaitingPhase — game type toggle', () => {
  beforeEach(() => {
    mockSetGameType = jest.fn();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runAllTimers();
    jest.useRealTimers();
  });

  function renderWaiting(gameOverrides = {}) {
    return render(
      <WaitingPhase
        game={{ ...baseGame, ...gameOverrides }}
        isAdmin={true}
        user={{ uid: USER_UID }}
        participantsByJoin={baseGame.participants}
        joinIndexById={{ [USER_UID]: 1, p2: 2 }}
        getDisplayName={(n: string) => n}
        showFancyAlert={jest.fn()}
        showFaceMessage={jest.fn()}
        locale="en"
        isDark={false}
        onCopyGameId={jest.fn()}
      />
    );
  }

  it('shows the game type label for admins', () => {
    const { queryByText } = renderWaiting();
    expect(queryByText('game.ui.gameTypeLabel')).toBeTruthy();
  });

  it('renders Mirror and Basket buttons', () => {
    const { queryByText } = renderWaiting();
    expect(queryByText('game.ui.gameTypeMirror')).toBeTruthy();
    expect(queryByText('game.ui.gameTypeBasket')).toBeTruthy();
  });

  it('calls setGameType("basket") when Basket button is pressed', async () => {
    const { getByText } = renderWaiting();
    fireEvent.press(getByText('game.ui.gameTypeBasket'));
    await act(async () => { await Promise.resolve(); });
    expect(mockSetGameType).toHaveBeenCalledWith('basket');
  });

  it('calls setGameType("mirror") when Mirror button is pressed', async () => {
    const { getByText } = renderWaiting({ gameType: 'basket' });
    fireEvent.press(getByText('game.ui.gameTypeMirror'));
    await act(async () => { await Promise.resolve(); });
    expect(mockSetGameType).toHaveBeenCalledWith('mirror');
  });

  it('does not show the toggle for non-admins', () => {
    const { queryByText } = render(
      <WaitingPhase
        game={baseGame}
        isAdmin={false}
        user={{ uid: 'p2' }}
        participantsByJoin={baseGame.participants}
        joinIndexById={{ [USER_UID]: 1, p2: 2 }}
        getDisplayName={(n: string) => n}
        showFancyAlert={jest.fn()}
        showFaceMessage={jest.fn()}
        locale="en"
        isDark={false}
        onCopyGameId={jest.fn()}
      />
    );
    expect(queryByText('game.ui.gameTypeLabel')).toBeNull();
  });
});
