import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { HapticTab } from '../components/haptic-tab';

// PlatformPressable: wire onPressIn through the TouchableOpacity's onPress
// so fireEvent.press triggers it correctly
jest.mock('@react-navigation/elements', () => ({
  PlatformPressable: ({ onPressIn, onPress, children, testID, ...rest }: any) => {
    const { TouchableOpacity } = require('react-native');
    return (
      <TouchableOpacity
        testID={testID ?? 'pressable'}
        onPress={(e: any) => {
          onPressIn?.(e);
          onPress?.(e);
        }}
        {...rest}
      >
        {children}
      </TouchableOpacity>
    );
  },
}));

describe('HapticTab', () => {
  beforeEach(() => {
    require('expo-haptics').impactAsync.mockResolvedValue(undefined);
  });

  it('renders without crashing', () => {
    const { root } = render(<HapticTab onPress={jest.fn()} />);
    expect(root).toBeTruthy();
  });

  it('calls onPressIn prop when pressed', () => {
    const onPressIn = jest.fn();
    const { getByTestId } = render(<HapticTab onPressIn={onPressIn} onPress={jest.fn()} />);
    fireEvent.press(getByTestId('pressable'));
    expect(onPressIn).toHaveBeenCalled();
  });

  it('triggers haptic feedback on press (platform compiled as ios by jest-expo)', () => {
    // babel-preset-expo statically inlines process.env.EXPO_OS = 'ios' at compile
    // time (jest-expo uses caller.platform = 'ios'), so the haptic condition is
    // always true in Jest. This test verifies the haptic path runs.
    const mockImpactAsync = require('expo-haptics').impactAsync;
    const { getByTestId } = render(<HapticTab onPress={jest.fn()} />);
    fireEvent.press(getByTestId('pressable'));
    expect(mockImpactAsync).toHaveBeenCalled();
  });

  it('calls onPress prop when pressed', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(<HapticTab onPress={onPress} />);
    fireEvent.press(getByTestId('pressable'));
    expect(onPress).toHaveBeenCalled();
  });
});
