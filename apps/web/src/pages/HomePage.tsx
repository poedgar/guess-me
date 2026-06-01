import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AuthScreen } from '../components/auth/AuthScreen';
import { GameScreen } from '../components/game/GameScreen';

export function HomePage() {
  const { isSignedIn } = useAuth();

  return isSignedIn ? <GameScreen /> : <AuthScreen />;
}
