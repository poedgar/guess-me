import { useLanguage } from '../../contexts/LanguageContext';
import React, { useEffect, useRef } from 'react';
import { useGame } from '../../contexts/GameContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../hooks/useAlert';
import { JoinScreen } from './JoinScreen';
import { GameHeader } from './GameHeader';
import { WaitingPhase } from './mirror/WaitingPhase';
import { ActivePhase } from './mirror/ActivePhase';
import { GuessingPhase } from './mirror/GuessingPhase';
import { ResultsPhase } from './mirror/ResultsPhase';
import { BasketScreen } from './basket/BasketScreen';
import { ClashScreen } from './clash/ClashScreen';
import { ClashSetupPanel } from './clash/ClashSetupPanel';
import { IdeaScreen } from './ideas/IdeaScreen';

export const GameScreen: React.FC = () => {
  const { currentGame, leaveGame } = useGame();
  const { showAlert, AlertModal } = useAlert();
  const { user } = useAuth();
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
          <>
            {currentGame.status === 'waiting' && <WaitingPhase game={currentGame} />}
            {(currentGame.status === 'basket_writing' || currentGame.status === 'basket_guessing') && (
              <BasketScreen game={currentGame} />
            )}
            {currentGame.status === 'finished' && <ResultsPhase game={currentGame} />}
          </>
        )}

        {gameType === 'clash' && (
          <>
            {currentGame.status === 'waiting' && (
              <>
                <WaitingPhase game={currentGame} />
                {user?.uid === currentGame.adminId && (
                  <div className="mt-4">
                    <ClashSetupPanel game={currentGame} />
                  </div>
                )}
              </>
            )}
            {(currentGame.status === 'clash_writing' || currentGame.status === 'clash_guessing') && (
              <ClashScreen game={currentGame} />
            )}
            {currentGame.status === 'finished' && <ResultsPhase game={currentGame} />}
          </>
        )}

        {gameType === 'ideas' && (
          <>
            {currentGame.status === 'waiting' && <WaitingPhase game={currentGame} />}
            {(currentGame.status === 'idea_writing' || currentGame.status === 'idea_rating') && (
              <IdeaScreen game={currentGame} />
            )}
            {currentGame.status === 'finished' && <ResultsPhase game={currentGame} />}
          </>
        )}
      </div>
    </>
  );
};
