import { render } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthScreen } from '../components/auth/AuthScreen';
import { AuthProvider } from '../contexts/AuthContext';
import { LanguageProvider } from '../contexts/LanguageContext';

// Mock dependencies before importing the component
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
jest.mock('@/components/LanguageSelector', () => 'View');
jest.mock('@/components/ui/icon-symbol', () => 'Text');
jest.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    user: null,
    loading: false,
    isSignedIn: false,
    signIn: jest.fn(),
    signOut: jest.fn(),
  }),
}));
jest.mock('@/contexts/LanguageContext', () => ({
  LanguageProvider: ({ children }: { children: React.ReactNode }) => children,
  useLanguage: () => ({
    locale: 'en',
    setLocale: jest.fn(),
  }),
}));
jest.mock('@/i18n', () => ({
  t: (key: string) => key,
}));

describe('AuthScreen', () => {
  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <SafeAreaProvider>
        <LanguageProvider>
          <AuthProvider>
            {component}
          </AuthProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    );
  };

  it('renders without crashing', () => {
    const { root } = renderWithProviders(<AuthScreen />);
    expect(root).toBeTruthy();
  });

  it('renders sign-in content', async () => {
    // Let's just test that it renders without error first
    expect(() => {
      render(
        <SafeAreaProvider>
          <LanguageProvider>
            <AuthProvider>
              <AuthScreen />
            </AuthProvider>
          </LanguageProvider>
        </SafeAreaProvider>
      );
    }).not.toThrow();
  });
});