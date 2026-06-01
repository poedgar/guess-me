import React from 'react';
import { useGame } from '../contexts/GameContext';
import { useAuth } from '../contexts/AuthContext';
import { t } from '@/i18n';
import { sortParticipantsByJoin } from '@mirror/shared';

export function ResultsPage() {
  const { currentGame } = useGame();
  const { user } = useAuth();

  const participantsByJoin = sortParticipantsByJoin(currentGame?.participants || []);

  const participantsWithScores = (currentGame?.participants || [])
    .map(p => {
      const gamePoints = currentGame?.scores?.[p.userId] ?? 0;
      const guessPoints = currentGame?.guessResults?.[p.userId]?.correctGuesses ?? 0;
      return { ...p, gamePoints, guessPoints, totalPoints: gamePoints + guessPoints };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);

  const medals = ['🥇', '🥈', '🥉'];

  if (!currentGame || currentGame.status === 'waiting') {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <p className="text-5xl mb-4">🎯</p>
        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
          {t('results.noResultsTitle')}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-xs">
          {t('results.noResultsMessage')}
        </p>
      </div>
    );
  }

  const completedRounds = [...(currentGame.rounds || [])]
    .sort((a, b) => a.roundNumber - b.roundNumber)
    .filter(r => r.commentsVisible && r.pointsGiven);

  return (
    <div className="space-y-6">
      {/* Leaderboard */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 font-semibold text-gray-700 dark:text-gray-300">
          🏆 {t('results.leaderboardTitle')}
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-700">
          {participantsWithScores.map((p, idx) => (
            <div
              key={p.userId}
              className={`flex items-center gap-3 px-4 py-3 ${
                idx === 0 ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                p.userId === user?.uid ? 'bg-blue-50 dark:bg-blue-900/20' : ''
              }`}
            >
              <span className="w-8 text-center text-xl">
                {idx < 3 ? medals[idx] : <span className="text-sm text-gray-500">#{idx + 1}</span>}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 dark:text-white truncate text-sm">
                  {p.userName}
                  {p.userId === user?.uid && <span className="ml-1 text-xs text-blue-500">{t('game.ui.youLabel')}</span>}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('game.ui.pointsGame')}: {p.gamePoints} · {t('game.ui.pointsGuessing')}: {p.guessPoints}
                </p>
              </div>
              <span className="text-lg font-bold text-game-green">{p.totalPoints}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Round History */}
      {completedRounds.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 dark:text-white mb-3">
            📜 {t('results.roundHistoryTitle')} ({completedRounds.length})
          </h3>
          <div className="space-y-4">
            {completedRounds.map(round => (
              <div
                key={round.roundNumber}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {/* Round header */}
                <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                  <p className="font-bold text-gray-900 dark:text-white">
                    {t('results.round')} {round.roundNumber}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('results.target')}: {round.targetUserName}
                  </p>
                  {(round.targetPointsGivenBy?.length ?? 0) > 0 && (
                    <p className="text-sm font-semibold text-game-green mt-1">
                      {t('results.targetPoints')}: +{round.targetPointsGivenBy?.length ?? 0}
                    </p>
                  )}
                </div>

                {/* Comments */}
                <div className="px-4 py-3">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
                    {t('results.comments')} ({round.comments?.length ?? 0})
                  </p>
                  {round.comments && round.comments.length > 0 ? (
                    <div className="space-y-2">
                      {round.comments.map(comment => (
                        <div key={comment.id} className="bg-gray-50 dark:bg-gray-700 rounded p-3 flex justify-between items-start gap-3">
                          <p className="text-sm text-gray-700 dark:text-gray-300 italic flex-1">
                            "{comment.text}"
                          </p>
                          {comment.points !== undefined && (
                            <span className={`text-sm font-bold flex-shrink-0 ${comment.points >= 0 ? 'text-game-green' : 'text-game-danger'}`}>
                              {comment.points > 0 ? '+' : ''}{comment.points} pts
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic text-center py-2">{t('results.noComments')}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
