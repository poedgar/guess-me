import { useLanguage } from '../../../contexts/LanguageContext';
import React from 'react';
import { Game, calculateSimilarPairs } from '@mirror/shared';
import { Leaderboard } from '../Leaderboard';
import { IdeaLeaderboard } from '../ideas/IdeaLeaderboard';
import { useScrollIntoViewOnChange } from '../../../hooks/useScrollIntoViewOnChange';
import { PULSE_COLORS } from '../../../constants/pulseColors';


interface ResultsPhaseProps {
  game: Game;
}

export const ResultsPhase: React.FC<ResultsPhaseProps> = ({ game }) => {
  const { t } = useLanguage();
  const similarPairs = calculateSimilarPairs(
    game.rounds ?? [],
    game.adminAwards,
    game.participants ?? [],
    3,
  );

  const scrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `finished:${!!game.adminLeft}`,
    'start',
    PULSE_COLORS.gold,
  );

  if (game.adminLeft) {
    return (
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border-2 border-game-gold text-center space-y-2" ref={scrollRef} data-cy="admin-left">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          {t('game.ui.adminLeftTitle')}
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          {t('game.ui.adminLeftMessage')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6" ref={scrollRef} data-cy="game-finished">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border-2 border-game-gold text-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {t('game.ui.gameFinishedTitle')}
        </h2>
        <p className="text-gray-500 dark:text-gray-400">
          {t('game.ui.gameFinishedMessage')}
        </p>
      </div>

      {game.gameType === 'ideas' ? (
        <IdeaLeaderboard
          ideas={game.ideaData?.ideas ?? []}
          title={t('game.ui.ideas.finalLeaderboardTitle')}
          maxHeight="max-h-96"
        />
      ) : (
        <Leaderboard
          participants={game.participants}
          scores={game.scores}
          guessResults={game.guessResults}
          title={t('game.ui.finalLeaderboardTitle')}
          maxHeight="max-h-96"
          showSurnames={game.showSurnames}
        />
      )}

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          {t('game.ui.mostAlignedTitle')}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {t('game.ui.mostAlignedSubtitle')}
        </p>

        {similarPairs.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-4">
            {t('game.ui.notEnoughDataForAlignment')}
          </p>
        ) : (
          <div className="space-y-3">
            {similarPairs.map((pair, idx) => (
              <div
                key={`${pair.userAId}-${pair.userBId}`}
                className="flex items-center gap-3 bg-gray-50 dark:bg-gray-700 rounded-lg p-3"
              >
                <div className="w-7 h-7 rounded-full bg-game-green flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">{idx + 1}</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">
                    {t('game.ui.mostAlignedPair', { a: pair.userAName, b: pair.userBName })}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('game.ui.mostAlignedDiff', { diff: pair.averageDiff.toFixed(1) })}
                    {'  ·  '}
                    {t('game.ui.mostAlignedRatings', { count: pair.commonRatings })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
