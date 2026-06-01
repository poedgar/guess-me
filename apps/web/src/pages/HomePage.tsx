import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { AuthScreen } from '../components/auth/AuthScreen';
import { GameScreen } from '../components/game/GameScreen';

export function HomePage() {
  const { isSignedIn } = useAuth();
  const { currentGame } = useGame();
  const navigate = useNavigate();

  // When a game becomes active, update the URL to the game's unique link
  useEffect(() => {
    if (currentGame?.id) {
      navigate(`/game/${currentGame.id}`, { replace: true });
    }
  }, [currentGame?.id]);

  return isSignedIn ? <GameScreen /> : <AuthScreen />;
}
