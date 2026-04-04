import { render } from '@testing-library/react-native';
import React from 'react';
import { ThemedText } from '../components/themed-text';

describe('ThemedText', () => {
  it('renders children', () => {
    const { getByText } = render(<ThemedText>Hello</ThemedText>);
    expect(getByText('Hello')).toBeTruthy();
  });

  it('renders with type default', () => {
    const { getByText } = render(<ThemedText type="default">Default</ThemedText>);
    expect(getByText('Default')).toBeTruthy();
  });

  it('renders with type title', () => {
    const { getByText } = render(<ThemedText type="title">Title</ThemedText>);
    expect(getByText('Title')).toBeTruthy();
  });

  it('renders with type defaultSemiBold', () => {
    const { getByText } = render(<ThemedText type="defaultSemiBold">Bold</ThemedText>);
    expect(getByText('Bold')).toBeTruthy();
  });

  it('renders with type subtitle', () => {
    const { getByText } = render(<ThemedText type="subtitle">Subtitle</ThemedText>);
    expect(getByText('Subtitle')).toBeTruthy();
  });

  it('renders with type link', () => {
    const { getByText } = render(<ThemedText type="link">Link</ThemedText>);
    expect(getByText('Link')).toBeTruthy();
  });

  it('applies custom lightColor', () => {
    const { getByText } = render(
      <ThemedText lightColor="#ff0000">Colored</ThemedText>
    );
    expect(getByText('Colored')).toBeTruthy();
  });

  it('applies custom darkColor', () => {
    const { getByText } = render(
      <ThemedText darkColor="#00ff00">Dark colored</ThemedText>
    );
    expect(getByText('Dark colored')).toBeTruthy();
  });

  it('passes through extra Text props', () => {
    const { getByTestId } = render(
      <ThemedText testID="my-text">Props</ThemedText>
    );
    expect(getByTestId('my-text')).toBeTruthy();
  });
});
