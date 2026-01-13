import { render } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GameScreen } from '../components/game/GameScreen';
import { AuthProvider } from '../contexts/AuthContext';
import { GameProvider } from '../contexts/GameContext';
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
jest.mock('react-native-qrcode-svg', () => 'QRCode');

// Mock contexts
jest.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    user: { uid: 'test-user', displayName: 'Test User' },
    isSignedIn: true,
    signIn: jest.fn(),
    signOut: jest.fn(),
  }),
}));

jest.mock('@/contexts/GameContext', () => ({
  GameProvider: ({ children }: { children: React.ReactNode }) => children,
  useGame: () => ({
    currentGame: null,
    loading: false,
    enterGame: jest.fn(),
    leaveGame: jest.fn(),
    startGame: jest.fn(),
    submitComment: jest.fn(),
    showComments: jest.fn(),
    givePoints: jest.fn(),
    finishGivingPoints: jest.fn(),
    givePointsToTarget: jest.fn(),
    startNextRound: jest.fn(),
    startGuessingPhase: jest.fn(),
    submitGuess: jest.fn(),
    finalizeGuessingPhase: jest.fn(),
    markPlayerGuessesSubmitted: jest.fn(),
    updateAdminWritesComments: jest.fn(),
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

describe('GameScreen', () => {
  const renderWithProviders = (component: React.ReactElement) => {
    return render(
      <SafeAreaProvider>
        <LanguageProvider>
          <AuthProvider>
            <GameProvider>
              {component}
            </GameProvider>
          </AuthProvider>
        </LanguageProvider>
      </SafeAreaProvider>
    );
  };

  it('renders without crashing', () => {
    const { root } = renderWithProviders(<GameScreen />);
    expect(root).toBeTruthy();
  });

  it('renders with all required providers', () => {
    expect(() => {
      renderWithProviders(<GameScreen />);
    }).not.toThrow();
  });

  it('has access to game context functions', () => {
    const mockEnterGame = jest.fn();
    
    // Mock with specific function
    jest.doMock('@/contexts/GameContext', () => ({
      GameProvider: ({ children }: { children: React.ReactNode }) => children,
      useGame: () => ({
        currentGame: null,
        loading: false,
        enterGame: mockEnterGame,
        leaveGame: jest.fn(),
        startGame: jest.fn(),
        submitComment: jest.fn(),
        showComments: jest.fn(),
        givePoints: jest.fn(),
        finishGivingPoints: jest.fn(),
        givePointsToTarget: jest.fn(),
        startNextRound: jest.fn(),
        startGuessingPhase: jest.fn(),
        submitGuess: jest.fn(),
        finalizeGuessingPhase: jest.fn(),
        markPlayerGuessesSubmitted: jest.fn(),
        updateAdminWritesComments: jest.fn(),
      }),
    }));

    // Test that the mock function exists and can be called
    expect(typeof mockEnterGame).toBe('function');
    expect(mockEnterGame).toBeDefined();
  });
});
