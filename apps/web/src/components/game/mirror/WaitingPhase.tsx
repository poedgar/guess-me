import React, { useState } from 'react';
import { Game } from '@mirror/shared';
import { useGame } from '../../../contexts/GameContext';
import { useAuth } from '../../../contexts/AuthContext';
import { Leaderboard } from '../Leaderboard';
import { t } from '@/i18n';

interface WaitingPhaseProps {
  game: Game;
}

export const WaitingPhase: React.FC<WaitingPhaseProps> = ({ game }) => {
  const { user } = useAuth();
  const {
    loading,
    startGame,
    updateAdminWritesComments,
    updateShowSurnames,
    updateTargetSelectionMode,
  } = useGame();
  const [isStarting, setIsStarting] = useState(false);

  const isAdmin = user?.uid === game.adminId;

  const handleStartGame = async () => {
    try {
      setIsStarting(true);
      await startGame();
    } catch (error) {
      console.error('Error starting game:', error);
      setIsStarting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border-2 border-game-orange">
        <h2 className="text-2xl font-bold mb-4 text-game-orange">
          {t('game.waiting') || 'Waiting for Players'}
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {t('game.waitingMessage', { count: game.participants.length })}
        </p>

        {isAdmin && (
          <div className="space-y-4 mt-6 pt-6 border-t border-gray-300 dark:border-gray-600">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {t('game.adminSettings') || 'Admin Settings'}
            </h3>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={game.adminWritesComments ?? false}
                onChange={(e) => updateAdminWritesComments(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-gray-700 dark:text-gray-300">
                {t('game.adminWritesComments') || 'Admin also writes comments'}
              </span>
            </label>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={game.showSurnames ?? false}
                onChange={(e) => updateShowSurnames(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-gray-700 dark:text-gray-300">
                {t('game.showSurnames') || 'Show surnames'}
              </span>
            </label>

            <label className="flex items-center gap-3">
              <select
                value={game.targetSelectionMode || 'random'}
                onChange={(e) =>
                  updateTargetSelectionMode(e.target.value as 'random' | 'chronological')
                }
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="random">
                  {t('game.targetSelectionRandom') || 'Random targets'}
                </option>
                <option value="chronological">
                  {t('game.targetSelectionChronological') || 'Chronological targets'}
                </option>
              </select>
            </label>

            <button
              type="button"
              onClick={handleStartGame}
              disabled={game.participants.length < 2 || isStarting || loading}
              className="w-full bg-game-green text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity mt-6"
            >
              {loading || isStarting ? t('common.loading') || 'Starting...' : t('game.startGame') || 'Start Game'}
            </button>
          </div>
        )}
      </div>

      <Leaderboard
        participants={game.participants}
        scores={game.scores}
        guessResults={game.guessResults}
        maxHeight="max-h-80"
      />
    </div>
  );
};
