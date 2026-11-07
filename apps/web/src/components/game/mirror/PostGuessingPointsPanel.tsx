import React, { useState } from 'react';
import { Game } from '@mirror/shared';
import { useGame } from '../../../contexts/GameContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useSound } from '../../../contexts/SoundContext';
import { useAlert } from '../../../hooks/useAlert';
import { PlayerAvatar } from '../../ui/PlayerAvatar';
import { getAvatarId } from '@mirror/shared';
import { getDisplayName } from '../../../utils/displayName';
import { getPlayerNumber } from '../../../utils/playerNumbers';

const POINT_VALUES = [-3, -2, -1, 1, 2, 3];

interface PostGuessingPointsPanelProps {
  game: Game;
}

export const PostGuessingPointsPanel: React.FC<PostGuessingPointsPanelProps> = ({ game }) => {
  const { user } = useAuth();
  const { awardPointsToPlayers } = useGame();
  const { playSound } = useSound();
  const { showAlert, AlertModal } = useAlert();
  const { t } = useLanguage();

  const [selectedPlayersForPoints, setSelectedPlayersForPoints] = useState<Record<string, number>>({});
  const [isAwarding, setIsAwarding] = useState(false);

  const isAdmin = user?.uid === game.adminId;

  if (!game.postGuessingPointPhase || !isAdmin) return null;

  const alreadyAwarded = game.playersWhoAwardedPostGuessPoints?.includes(user?.uid ?? '') ?? false;

  const handleSelect = (playerId: string, points: number) => {
    setSelectedPlayersForPoints((prev) => {
      if (prev[playerId] === points) {
        const next = { ...prev };
        delete next[playerId];
        return next;
      }
      return { ...prev, [playerId]: points };
    });
  };

  const handleSubmit = async () => {
    const awards = Object.entries(selectedPlayersForPoints).map(([recipientId, points]) => ({
      recipientId,
      points,
    }));
    if (awards.length === 0) {
      showAlert(t('common.error'), t('game.alerts.selectAtLeastOnePlayer'));
      return;
    }
    try {
      setIsAwarding(true);
      await playSound('click');
      await awardPointsToPlayers(awards);
      await playSound('points');
      setSelectedPlayersForPoints({});
    } catch (error: unknown) {
      await playSound('error');
      showAlert(t('common.error'), (error instanceof Error && error.message) || t('game.alerts.awardPointsFailed'));
    } finally {
      setIsAwarding(false);
    }
  };

  const total = Object.values(selectedPlayersForPoints).reduce((sum, points) => sum + points, 0);

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border-2 border-game-gold mt-6">
      {AlertModal}
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 text-center">
        {t('game.ui.postGuessing.awardTitle')}
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">
        {t('game.ui.postGuessing.awardDesc')}
      </p>

      {alreadyAwarded ? (
        <div className="bg-game-green/10 border border-game-green text-game-green rounded-lg p-4 text-center">
          <p className="font-semibold mb-1">{t('game.ui.postGuessing.alreadyAwardedTitle')}</p>
          <p>{t('game.ui.postGuessing.alreadyAwardedText')}</p>
          <p className="text-sm opacity-80 mt-1">{t('game.ui.postGuessing.waitNextRound')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('game.ui.postGuessing.instructions')}
          </p>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {game.participants
              .filter((p) => p.userId !== user?.uid)
              .map((participant) => {
                const selectedPoints = selectedPlayersForPoints[participant.userId];
                return (
                  <div
                    key={participant.userId}
                    data-cy="post-guessing-points-row"
                    data-cy-user-id={participant.userId}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700"
                  >
                    <PlayerAvatar name={getDisplayName(participant.userName, game.showSurnames ?? false)} avatarId={getAvatarId(participant)} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate text-sm">
                        {getPlayerNumber(game, participant.userId)}. {getDisplayName(participant.userName, game.showSurnames ?? false)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {POINT_VALUES.map((points) => {
                        const isSelected = selectedPoints === points;
                        const isNegative = points < 0;
                        return (
                          <button
                            key={points}
                            type="button"
                            onClick={() => handleSelect(participant.userId, points)}
                            className={`w-8 h-8 rounded-full border text-xs font-semibold transition-colors ${
                              isSelected
                                ? isNegative
                                  ? 'bg-red-500 border-red-500 text-white'
                                  : 'bg-game-green border-game-green text-white'
                                : isNegative
                                  ? 'bg-red-500/10 border-red-500/30 text-red-500'
                                  : 'bg-white dark:bg-gray-600 border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-200'
                            }`}
                          >
                            {points}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>

          {Object.keys(selectedPlayersForPoints).length > 0 && (
            <button
              type="button"
              data-testid="award-points-submit"
              onClick={handleSubmit}
              disabled={isAwarding}
              className="w-full bg-game-green text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isAwarding ? t('common.loading') : t('game.ui.postGuessing.awardButton', { total })}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
