import React, { useState } from 'react';
import { Game } from '@mirror/shared';
import { useGame } from '../../../contexts/GameContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useSound } from '../../../contexts/SoundContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useAlert } from '../../../hooks/useAlert';
import { PlayerAvatar } from '../../ui/PlayerAvatar';

interface Props {
  game: Game;
}

const POINT_OPTIONS = [-3, -2, -1, 1, 2, 3];

const PostGuessingPointsPanel: React.FC<Props> = ({ game }) => {
  const { user } = useAuth();
  const { loading, startPostGuessingPointPhase, awardPointsToPlayers } = useGame();
  const { playSound } = useSound();
  const { t } = useLanguage();
  const { showAlert, AlertModal } = useAlert();

  const [selected, setSelected] = useState<Record<string, number>>({});
  const [isAwardingPoints, setIsAwardingPoints] = useState(false);
  const [isStartingPhase, setIsStartingPhase] = useState(false);

  const isAdmin = user?.uid === game.adminId;
  const uid = user?.uid ?? '';

  const handleStartPhase = async () => {
    try {
      setIsStartingPhase(true);
      await startPostGuessingPointPhase();
      await playSound('success');
    } catch (error) {
      showAlert(
        t('common.error'),
        (error instanceof Error && error.message) || t('game.alerts.postGuessingStartFailed'),
      );
    } finally {
      setIsStartingPhase(false);
    }
  };

  const handleTogglePoints = (playerId: string, points: number) => {
    setSelected(prev => {
      if (prev[playerId] === points) {
        const next = { ...prev };
        delete next[playerId];
        return next;
      }
      return { ...prev, [playerId]: points };
    });
  };

  const handleAwardPoints = async () => {
    const awards = Object.entries(selected).map(([recipientId, points]) => ({ recipientId, points }));
    if (awards.length === 0) {
      showAlert(t('common.error'), t('game.alerts.selectAtLeastOnePlayer'));
      return;
    }
    try {
      setIsAwardingPoints(true);
      await awardPointsToPlayers(awards);
      await playSound('points');
      setSelected({});
    } catch (error) {
      showAlert(
        t('common.error'),
        (error instanceof Error && error.message) || t('game.alerts.awardPointsFailed'),
      );
    } finally {
      setIsAwardingPoints(false);
    }
  };

  const totalPoints = Object.values(selected).reduce((sum, p) => sum + p, 0);
  const alreadyAwarded = game.playersWhoAwardedPostGuessPoints?.includes(uid);

  // Admin sees "Start Point Awards" button after target submitted guesses
  if (
    isAdmin &&
    game.guessingData?.singleRoundTargetId &&
    game.guessingData?.playersWhoSubmittedGuesses?.includes(game.guessingData.singleRoundTargetId) &&
    !game.postGuessingPointPhase
  ) {
    return (
      <>
        {AlertModal}
        <div className="mt-4 bg-gray-50 dark:bg-gray-700 rounded-xl p-4 space-y-3">
          <p className="text-center font-semibold text-gray-900 dark:text-white">
            {t('game.ui.postGuessing.startPhaseTitle')}
          </p>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            {t('game.ui.postGuessing.startPhaseDesc')}
          </p>
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleStartPhase}
              disabled={isStartingPhase || loading}
              className="bg-game-orange text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isStartingPhase ? t('common.loading') : t('game.ui.postGuessing.startPhaseTitle')}
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!game.postGuessingPointPhase) return null;
  if (!isAdmin) return null;

  return (
    <>
      {AlertModal}
      <div className="mt-4 bg-gray-50 dark:bg-gray-700 rounded-xl p-4 space-y-4">
        <div className="text-center">
          <p className="font-semibold text-gray-900 dark:text-white">
            {t('game.ui.postGuessing.awardTitle')}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {t('game.ui.postGuessing.awardDesc')}
          </p>
        </div>

        {alreadyAwarded ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center space-y-1">
            <p className="font-semibold text-game-green">{t('game.ui.postGuessing.alreadyAwardedTitle')}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('game.ui.postGuessing.alreadyAwardedText')}</p>
            <p className="text-xs text-gray-400">{t('game.ui.postGuessing.waitNextRound')}</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('game.ui.postGuessing.instructions')}
            </p>

            <div className="space-y-3 max-h-72 overflow-y-auto">
              {game.participants
                .filter(p => p.userId !== uid)
                .map(participant => {
                  const selectedPoints = selected[participant.userId];
                  return (
                    <div key={participant.userId} className="bg-white dark:bg-gray-800 rounded-lg p-3">
                      <div className="flex items-center gap-3 mb-3">
                        <PlayerAvatar name={participant.userName} photoURL={participant.photoURL} size="sm" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                            {participant.userName}
                            {participant.userId === game.adminId && ' 👑'}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-center gap-2 flex-wrap">
                        {POINT_OPTIONS.map(points => {
                          const isNeg = points < 0;
                          const isChosen = selectedPoints === points;
                          return (
                            <button
                              key={points}
                              type="button"
                              onClick={() => handleTogglePoints(participant.userId, points)}
                              className={`w-10 h-10 rounded-full text-sm font-bold border-2 transition-all ${
                                isChosen
                                  ? isNeg
                                    ? 'bg-red-500 border-red-500 text-white'
                                    : 'bg-game-green border-game-green text-white'
                                  : isNeg
                                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-500'
                                    : 'bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-300'
                              } hover:opacity-80`}
                            >
                              {points > 0 ? `+${points}` : points}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
            </div>

            {Object.keys(selected).length > 0 && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={handleAwardPoints}
                  disabled={isAwardingPoints || loading}
                  className="bg-game-green text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isAwardingPoints
                    ? t('common.loading')
                    : t('game.ui.postGuessing.awardButton', { total: totalPoints })}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default PostGuessingPointsPanel;
