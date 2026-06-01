import { fireEvent, render, waitFor } from '@testing-library/react-native';
import React from 'react';
import { ExternalLink } from '../components/external-link';

// Use inline jest.fn() in the factory so it's always a function reference.
// Module-level variables can be undefined when the factory first evaluates
// due to babel-jest hoisting order.
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
  WebBrowserPresentationStyle: { AUTOMATIC: 'AUTOMATIC' },
}));

// Expose the onPress handler via props so we can call it directly in tests
jest.mock('expo-router', () => ({
  Link: ({ children, onPress, href, ...props }: any) => {
    const { TouchableOpacity, Text } = require('react-native');
    return (
      <TouchableOpacity
        testID="external-link"
        onPress={(e: any) => onPress?.(e)}
        {...props}
      >
        {children ?? <Text>{href}</Text>}
      </TouchableOpacity>
    );
  },
}));

// resetMocks:true clears the jest.fn() implementation before each test — restore it.
beforeEach(() => {
  require('expo-web-browser').openBrowserAsync.mockResolvedValue(undefined);
});

// NOTE: babel-preset-expo statically inlines process.env.EXPO_OS at compile
// time using caller.platform = 'ios' (the jest-expo preset default).
// This means `if (process.env.EXPO_OS !== 'web')` compiles to `if (true)`,
// so openBrowserAsync is always called in Jest — the web-platform branch
// cannot be tested by setting process.env at runtime.

describe('ExternalLink', () => {
  it('renders without crashing', () => {
    const { root } = render(<ExternalLink href="https://example.com" />);
    expect(root).toBeTruthy();
  });

  it('is accessible via testID', () => {
    const { getByTestId } = render(<ExternalLink href="https://example.com" />);
    expect(getByTestId('external-link')).toBeTruthy();
  });

  it('opens in-app browser when pressed', async () => {
    // Platform check compiles to `true` in jest-expo (ios target), so the
    // in-app browser is always opened on press.
    // Pass a mock event so event.preventDefault() doesn't throw.
    const { getByTestId } = render(<ExternalLink href="https://expo.dev" />);
    fireEvent(getByTestId('external-link'), 'press', { preventDefault: jest.fn() });

    await waitFor(() =>
      expect(require('expo-web-browser').openBrowserAsync).toHaveBeenCalledWith(
        'https://expo.dev',
        { presentationStyle: 'AUTOMATIC' },
      ),
    );
  });

  it('passes href to the Link component', () => {
    const { getByText } = render(<ExternalLink href="https://example.com" />);
    expect(getByText('https://example.com')).toBeTruthy();
  });
});
