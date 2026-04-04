import { render } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';
import { ThemedView } from '../components/themed-view';

describe('ThemedView', () => {
  it('renders children', () => {
    const { getByText } = render(
      <ThemedView><Text>inside</Text></ThemedView>
    );
    expect(getByText('inside')).toBeTruthy();
  });

  it('renders with testID', () => {
    const { getByTestId } = render(
      <ThemedView testID="themed-view"><Text>child</Text></ThemedView>
    );
    expect(getByTestId('themed-view')).toBeTruthy();
  });

  it('renders with custom lightColor', () => {
    const { getByTestId } = render(
      <ThemedView testID="light-view" lightColor="#aabbcc"><Text>light</Text></ThemedView>
    );
    expect(getByTestId('light-view')).toBeTruthy();
  });

  it('renders with custom darkColor', () => {
    const { getByTestId } = render(
      <ThemedView testID="dark-view" darkColor="#112233"><Text>dark</Text></ThemedView>
    );
    expect(getByTestId('dark-view')).toBeTruthy();
  });

  it('renders without children', () => {
    const { getByTestId } = render(<ThemedView testID="empty-view" />);
    expect(getByTestId('empty-view')).toBeTruthy();
  });
});
