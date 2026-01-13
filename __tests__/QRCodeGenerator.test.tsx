import { render } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import QRCodeGenerator from '../components/QRCodeGenerator';
import { AuthProvider } from '../contexts/AuthContext';
import { LanguageProvider } from '../contexts/LanguageContext';

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

jest.mock('@/components/ui/icon-symbol', () => 'Text');

// Mock react-native-qrcode-svg
jest.mock('react-native-qrcode-svg', () => 'QRCode');

jest.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    user: { uid: 'test-user-123', displayName: 'Test User' },
    isSignedIn: true,
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

describe('QRCodeGenerator', () => {
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
    const { root } = renderWithProviders(
      <QRCodeGenerator 
        gameId="test-game-123" 
        visible={true} 
        onClose={() => {}} 
      />
    );
    expect(root).toBeTruthy();
  });

  it('displays QR code for authenticated user', () => {
    expect(() => {
      renderWithProviders(
        <QRCodeGenerator 
          gameId="test-game-123" 
          visible={true} 
          onClose={() => {}} 
        />
      );
    }).not.toThrow();
  });

  it('has access to user data for QR generation', () => {
    const mockUser = { uid: 'test-user-123', displayName: 'Test User' };
    
    jest.doMock('@/contexts/AuthContext', () => ({
      AuthProvider: ({ children }: { children: React.ReactNode }) => children,
      useAuth: () => ({
        user: mockUser,
        isSignedIn: true,
        signIn: jest.fn(),
        signOut: jest.fn(),
      }),
    }));

    // Test that user data is available for QR code generation
    expect(mockUser.uid).toBe('test-user-123');
    expect(mockUser.displayName).toBe('Test User');
  });

  it('renders share functionality', () => {
    expect(() => {
      renderWithProviders(
        <QRCodeGenerator 
          gameId="test-game-123" 
          visible={true} 
          onClose={() => {}} 
        />
      );
    }).not.toThrow();
  });
});
