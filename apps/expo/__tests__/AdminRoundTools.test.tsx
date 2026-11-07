import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@/i18n', () => ({
  t: (key: string) => key,
}));

jest.mock('@/components/themed-text', () => {
  const { Text } = require('react-native');
  return { ThemedText: ({ children, ...p }: any) => <Text {...p}>{children}</Text> };
});

jest.mock('@/constants/theme', () => ({
  GameColors: { purple: '#AF52DE', neutral: '#8E8E93' },
}));

jest.mock('@/components/game/GameHeader', () => ({}));

const { AdminRoundTools } = require('../components/game/AdminRoundTools');

function confirmingShowFancyAlert(_title: string, _message: string, buttons?: any[]) {
  const confirmButton = buttons?.find((b) => b.style !== 'cancel');
  confirmButton?.onPress?.();
}

describe('AdminRoundTools', () => {
  it('renders nothing for a non-admin', () => {
    const { queryByText } = render(
      <AdminRoundTools isAdmin={false} locale="en" showFancyAlert={jest.fn()} onRestart={jest.fn()} onSkip={jest.fn()} />
    );
    expect(queryByText(/game.ui.adminTools/)).toBeNull();
  });

  it('shows the collapsed toggle for an admin, buttons hidden until expanded', () => {
    const { getByText, queryByText } = render(
      <AdminRoundTools isAdmin={true} locale="en" showFancyAlert={jest.fn()} onRestart={jest.fn()} onSkip={jest.fn()} />
    );
    expect(getByText(/game.ui.adminTools/)).toBeTruthy();
    expect(queryByText(/game.ui.restartRound/)).toBeNull();
    expect(queryByText(/game.ui.skipRound/)).toBeNull();
  });

  it('expanding the toggle reveals both buttons', () => {
    const { getByText, queryByText } = render(
      <AdminRoundTools isAdmin={true} locale="en" showFancyAlert={jest.fn()} onRestart={jest.fn()} onSkip={jest.fn()} />
    );
    fireEvent.press(getByText(/game.ui.adminTools/));
    expect(queryByText(/game.ui.restartRound/)).toBeTruthy();
    expect(queryByText(/game.ui.skipRound/)).toBeTruthy();
  });

  it('tapping Restart triggers the confirm dialog and, once confirmed, calls onRestart', async () => {
    const onRestart = jest.fn().mockResolvedValue(undefined);
    const { getByText } = render(
      <AdminRoundTools isAdmin={true} locale="en" showFancyAlert={confirmingShowFancyAlert} onRestart={onRestart} onSkip={jest.fn()} />
    );
    fireEvent.press(getByText(/game.ui.adminTools/));
    await act(async () => { fireEvent.press(getByText(/game.ui.restartRound/)); });
    expect(onRestart).toHaveBeenCalled();
  });

  it('tapping Skip triggers the confirm dialog and, once confirmed, calls onSkip', async () => {
    const onSkip = jest.fn().mockResolvedValue(undefined);
    const { getByText } = render(
      <AdminRoundTools isAdmin={true} locale="en" showFancyAlert={confirmingShowFancyAlert} onRestart={jest.fn()} onSkip={onSkip} />
    );
    fireEvent.press(getByText(/game.ui.adminTools/));
    await act(async () => { fireEvent.press(getByText(/game.ui.skipRound/)); });
    expect(onSkip).toHaveBeenCalled();
  });

  it('does not call onRestart if the confirm dialog never confirms', async () => {
    const onRestart = jest.fn();
    const neverConfirms = jest.fn(); // simulates the user dismissing/cancelling
    const { getByText } = render(
      <AdminRoundTools isAdmin={true} locale="en" showFancyAlert={neverConfirms} onRestart={onRestart} onSkip={jest.fn()} />
    );
    fireEvent.press(getByText(/game.ui.adminTools/));
    await act(async () => { fireEvent.press(getByText(/game.ui.restartRound/)); });
    expect(onRestart).not.toHaveBeenCalled();
  });
});
