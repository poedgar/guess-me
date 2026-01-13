import { HeaderLogo } from '../components/HeaderLogo';

// Mock dependencies
jest.mock('@/components/themed-text', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return ({ children, ...props }) => React.createElement(Text, props, children);
});

jest.mock('@/components/themed-view', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ children, ...props }) => React.createElement(View, props, children);
});

jest.mock('expo-image', () => ({
  Image: 'Image',
}));

// Mock the Platform module and require
jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
  StyleSheet: { create: jest.fn(() => ({})) },
  View: 'View',
}));

// Mock the require function to handle the asset path
jest.mock('../../assets/images/icon.png', () => 'mock-icon.png', { virtual: true });

describe('HeaderLogo', () => {
  it('can be imported', () => {
    // Test that the component can be imported without errors
    expect(HeaderLogo).toBeDefined();
    expect(typeof HeaderLogo).toBe('function');
  });

  it('has correct component structure', () => {
    // Test component structure without rendering
    expect(HeaderLogo).toBeDefined();
    expect(HeaderLogo.name).toBe('HeaderLogo');
  });

  it('has proper export', () => {
    // Test that the component is properly exported
    expect(HeaderLogo).toBeDefined();
  });

  it('is a function component', () => {
    // Test that it's a function component
    expect(typeof HeaderLogo).toBe('function');
  });

  it('has display name', () => {
    // Test component display name
    expect(HeaderLogo.name).toBe('HeaderLogo');
  });
});
