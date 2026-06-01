import { useLanguage } from '../../contexts/LanguageContext';
import React, { useEffect, useRef } from 'react';
import { useGame } from '../../contexts/GameContext';
import { useAlert } from '../../hooks/useAlert';
import { JoinScreen } from './JoinScreen';
import { GameHeader } from './GameHeader';
import { WaitingPhase } from './mirror/WaitingPhase';
import { ActivePhase } from './mirror/ActivePhase';
import { GuessingPhase } from './mirror/GuessingPhase';
import { ResultsPhase } from './mirror/ResultsPhase';


export const GameScreen: React.FC = () => {
  const { currentGame, leaveGame } = useGame();
  const { showAlert, AlertModal } = useAlert();
  const { t } = useLanguage();
  const adminLeftAlertShownForGame = useRef<string | null>(null);

  // Show alert when admin leaves the game
  useEffect(() => {
    if (
      currentGame?.adminLeft &&
      adminLeftAlertShownForGame.current !== currentGame.id
    ) {
      adminLeftAlertShownForGame.current = currentGame.id;
      showAlert(t('game.ui.adminLeftTitle'), t('game.ui.adminLeftMessage'));
    }
  }, [currentGame?.adminLeft, currentGame?.id]);

  const handleLeaveGame = () => {
    showAlert(
      t('game.alerts.leaveGameTitle'),
      t('game.alerts.leaveGameMessage'),
      [
        { text: t('common.cancel'), onPress: () => {}, style: 'secondary' },
        {
          text: t('game.alerts.confirmLeave'),
          onPress: async () => {
            try {
              await leaveGame();
              showAlert(t('game.alerts.leftGameTitle'), '');
            } catch (error) {
              showAlert(
                t('common.error'),
                (error instanceof Error && error.message) || t('game.alerts.leaveGameFailed'),
              );
            }
          },
          style: 'danger',
        },
      ],
    );
  };

  if (!currentGame) {
    return <JoinScreen />;
  }

  const gameType = currentGame.gameType || 'mirror';

  return (
    <>
      {AlertModal}
      <div>
        <GameHeader game={currentGame} onLeave={handleLeaveGame} />

        {gameType === 'mirror' && (
          <>
            {currentGame.status === 'waiting' && <WaitingPhase game={currentGame} />}
            {currentGame.status === 'active' && <ActivePhase game={currentGame} />}
            {currentGame.status === 'guessing_phase' && <GuessingPhase game={currentGame} />}
            {currentGame.status === 'finished' && <ResultsPhase game={currentGame} />}
          </>
        )}

        {gameType === 'basket' && (
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400">Basket mode coming soon...</p>
          </div>
        )}

        {gameType === 'clash' && (
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400">Clash mode coming soon...</p>
          </div>
        )}
      </div>
    </>
  );
};
