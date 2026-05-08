import {
  Philosopher_400Regular,
  useFonts,
} from '@expo-google-fonts/philosopher';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import React from 'react';
import { Alert, ScrollView, Text } from 'react-native';

import { AuthProvider } from '@/contexts/AuthContext';
import { GameProvider } from '@/contexts/GameContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { SoundProvider } from '@/contexts/SoundContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Intercept unhandled promise rejections (Hermes crashes these silently as a white screen).
// Do NOT call prevHandler — that would terminate the app before the user can read the alert.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ErrorUtils = (globalThis as any).ErrorUtils;
if (ErrorUtils) {
  ErrorUtils.setGlobalHandler((error: Error, isFatal: boolean) => {
    const msg = (error?.message || String(error)) + '\n\n' + (error?.stack?.slice(0, 1200) || '(no stack)');
    Alert.alert('CRASH' + (isFatal ? ' [FATAL]' : ' [non-fatal]'), msg, [{ text: 'OK' }]);
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
class ErrorBoundary extends (React.Component as any) {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    const { error } = this.state as { error: Error | null };
    if (error) {
      return (
        <ScrollView style={{ flex: 1, padding: 24, paddingTop: 60, backgroundColor: '#fff' }}>
          <Text style={{ color: 'red', fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
            App crashed — render error
          </Text>
          <Text style={{ color: '#333', fontSize: 14, marginBottom: 8 }}>
            {error.message}
          </Text>
          <Text style={{ color: '#666', fontSize: 12 }}>
            {error.stack}
          </Text>
        </ScrollView>
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (this as any).props.children;
  }
}

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    'Philosopher-Regular': Philosopher_400Regular,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <SoundProvider>
        <LanguageProvider>
          <AuthProvider>
            <GameProvider>
              <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
                <Stack>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
                </Stack>
                <StatusBar hidden />
              </ThemeProvider>
            </GameProvider>
          </AuthProvider>
        </LanguageProvider>
      </SoundProvider>
    </ErrorBoundary>
  );
}
