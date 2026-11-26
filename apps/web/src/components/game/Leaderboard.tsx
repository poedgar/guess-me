import React from 'react';
import { Game, Participant } from '@mirror/shared';
import { PlayerAvatar } from '../ui/PlayerAvatar';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { getDisplayName } from '../../utils/displayName';
import { getPlayerNumber } from '../../utils/playerNumbers';

interface LeaderboardProps {
  game: Game;
  participants: Participant[];
  scores?: { [userId: string]: number };
  guessResults?: { [userId: string]: { correctGuesses: number } };
  maxHeight?: string;
  title?: string;
  showSurnames?: boolean;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
  game,
  participants,
  scores,
  guessResults,
  maxHeight = 'max-h-96',
  title,
  showSurnames = false,
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();

  const ranked = participants
    .filter(p => (game.adminWritesComments ?? false) || p.userId !== game.adminId)
    .map(p => {
      const gamePoints = scores?.[p.userId] ?? 0;
      const guessPoints = guessResults?.[p.userId]?.correctGuesses ?? 0;
      return { ...p, gamePoints, guessPoints, totalPoints: gamePoints + guessPoints };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="mb-6">
      {title && (
        <p className="text-center font-semibold text-lg mb-3 text-gray-900 dark:text-white">
          {title}
        </p>
      )}
      <div className={`space-y-2 ${maxHeight} overflow-y-auto`}>
        {ranked.map((p, idx) => {
          const isCurrentUser = p.userId === user?.uid;
          return (
            <div
              key={p.userId}
              data-cy="leaderboard-row"
              data-cy-user-id={p.userId}
              className={`flex items-center gap-3 p-3 rounded-lg ${
                idx === 0
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-600'
                  : isCurrentUser
                    ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-600'
                    : 'bg-gray-50 dark:bg-gray-700'
              }`}
            >
              <div className="w-9 text-center flex-shrink-0">
                {idx < 3 ? (
                  <span className="text-2xl">{medals[idx]}</span>
                ) : (
                  <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                    #{idx + 1}
                  </span>
                )}
              </div>

              <PlayerAvatar name={getDisplayName(p.userName, showSurnames)} photoURL={p.photoURL} size="sm" />

              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white truncate text-sm">
                  {getPlayerNumber(game, p.userId)}. {getDisplayName(p.userName, showSurnames)}
                  {p.userId === game.adminId && ' 👑'}
                  {isCurrentUser && (
                    <span className="ml-1 text-xs text-blue-500">
                      {t('game.ui.youLabel')}
                    </span>
                  )}
                </p>
                <div className="flex gap-3 mt-0.5">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {t('game.ui.pointsGame')}: {p.gamePoints}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {t('game.ui.pointsGuessing')}: {p.guessPoints}
                  </span>
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-xl font-bold text-game-green" data-cy="leaderboard-total-points">{p.totalPoints}</p>
                <p className="text-xs text-gray-400">{t('game.ui.pointsTotal')}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
