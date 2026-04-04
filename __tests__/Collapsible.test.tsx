import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { Collapsible } from '../components/ui/collapsible';

jest.mock('@/components/ui/icon-symbol', () => {
  const { Text } = require('react-native');
  return { IconSymbol: () => <Text>chevron</Text> };
});

jest.mock('@/components/themed-text', () => {
  const { Text } = require('react-native');
  return { ThemedText: ({ children, ...props }: any) => <Text {...props}>{children}</Text> };
});

jest.mock('@/components/themed-view', () => {
  const { View } = require('react-native');
  return { ThemedView: ({ children, ...props }: any) => <View {...props}>{children}</View> };
});

describe('Collapsible', () => {
  it('renders the title', () => {
    const { getByText } = render(
      <Collapsible title="My Section"><Text>content</Text></Collapsible>
    );
    expect(getByText('My Section')).toBeTruthy();
  });

  it('hides children by default', () => {
    const { queryByText } = render(
      <Collapsible title="Section"><Text>hidden content</Text></Collapsible>
    );
    expect(queryByText('hidden content')).toBeNull();
  });

  it('shows children after pressing the header', () => {
    const { getByText, queryByText } = render(
      <Collapsible title="Section"><Text>visible content</Text></Collapsible>
    );
    expect(queryByText('visible content')).toBeNull();
    // Press the title text to toggle open
    fireEvent.press(getByText('Section'));
    expect(getByText('visible content')).toBeTruthy();
  });

  it('toggles back to hidden on second press', () => {
    const { getByText, queryByText } = render(
      <Collapsible title="Toggle"><Text>toggle content</Text></Collapsible>
    );
    fireEvent.press(getByText('Toggle'));
    expect(getByText('toggle content')).toBeTruthy();
    fireEvent.press(getByText('Toggle'));
    expect(queryByText('toggle content')).toBeNull();
  });

  it('renders multiple children when open', () => {
    const { getByText, queryByText } = render(
      <Collapsible title="Multi">
        <Text>child one</Text>
        <Text>child two</Text>
      </Collapsible>
    );
    expect(queryByText('child one')).toBeNull();
    fireEvent.press(getByText('Multi'));
    expect(getByText('child one')).toBeTruthy();
    expect(getByText('child two')).toBeTruthy();
  });
});
