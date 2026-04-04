import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { SoundToggle } from '../components/SoundToggle';

jest.mock('@/components/ui/icon-symbol', () => {
  const { Text } = require('react-native');
  return { IconSymbol: ({ name }: { name: string }) => <Text testID={`icon-${name}`}>{name}</Text> };
});

jest.mock('@/components/themed-view', () => {
  const { View } = require('react-native');
  return { ThemedView: ({ children, ...props }: any) => <View {...props}>{children}</View> };
});

// We control sound state via the SoundContext mock — defined once at file level
// (jest.setup.js already provides a global SoundContext mock; we override here)
const mockToggleSound = jest.fn();
let mockIsSoundEnabled = true;

jest.mock('@/contexts/SoundContext', () => ({
  useSound: () => ({
    get isSoundEnabled() { return mockIsSoundEnabled; },
    toggleSound: mockToggleSound,
    playSound: jest.fn(),
  }),
}));

beforeEach(() => {
  mockToggleSound.mockClear();
  mockIsSoundEnabled = true;
});

describe('SoundToggle', () => {
  it('renders without crashing', () => {
    const { root } = render(<SoundToggle />);
    expect(root).toBeTruthy();
  });

  it('calls toggleSound when pressed', () => {
    const { getByRole } = render(<SoundToggle />);
    fireEvent.press(getByRole('button'));
    expect(mockToggleSound).toHaveBeenCalledTimes(1);
  });

  it('shows speaker.2.fill icon when sound is enabled', () => {
    const { getByTestId } = render(<SoundToggle />);
    expect(getByTestId('icon-speaker.2.fill')).toBeTruthy();
  });

  it('shows speaker.slash.fill icon when sound is disabled', () => {
    mockIsSoundEnabled = false;
    const { getByTestId } = render(<SoundToggle />);
    expect(getByTestId('icon-speaker.slash.fill')).toBeTruthy();
  });

  it('has correct accessibility label when enabled', () => {
    const { getByLabelText } = render(<SoundToggle />);
    expect(getByLabelText('Disable sound')).toBeTruthy();
  });

  it('has correct accessibility label when disabled', () => {
    mockIsSoundEnabled = false;
    const { getByLabelText } = render(<SoundToggle />);
    expect(getByLabelText('Enable sound')).toBeTruthy();
  });
});
