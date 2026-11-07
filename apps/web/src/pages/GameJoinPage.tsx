import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useAlert } from '../hooks/useAlert';
import { AuthScreen } from '../components/auth/AuthScreen';
import { GameScreen } from '../components/game/GameScreen';
import { LiquidLoader } from '../components/ui/LiquidLoader';

export function GameJoinPage() {
  const { gameId } = useParams<{ gameId: string }>();
  const { isSignedIn } = useAuth();
  const { currentGame, enterGame } = useGame();
  const { t } = useLanguage();
  const { showAlert, AlertModal } = useAlert();
  const navigate = useNavigate();
  const [isJoining, setIsJoining] = useState(false);
  const hasAttempted = useRef(false);

  useEffect(() => {
    if (!isSignedIn || !gameId || hasAttempted.current) return;
    // Already in this game — nothing to do
    if (currentGame?.id === gameId) return;
    hasAttempted.current = true;

    const join = async () => {
      try {
        setIsJoining(true);
        await enterGame(gameId);
      } catch (err) {
        showAlert(
          t('common.error'),
          (err instanceof Error && err.message) || t('game.alerts.enterGameFailed'),
          [{ text: t('common.ok'), onPress: () => navigate('/'), style: 'primary' }],
        );
      } finally {
        setIsJoining(false);
      }
    };

    join();
  }, [isSignedIn, gameId, currentGame?.id]);

  if (!isSignedIn) {
    // After sign-in, this page will re-render and trigger the join effect
    return <AuthScreen />;
  }

  if (isJoining) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-4">
        <LiquidLoader size={60} />
        <p className="text-gray-500 dark:text-gray-400 text-sm">{t('game.joiningGame')}</p>
      </div>
    );
  }

  // Either already in this game or join succeeded → show the game
  return (
    <>
      {AlertModal}
      <GameScreen />
    </>
  );
}
