import { useLanguage } from '../../contexts/LanguageContext';
import React from 'react';
import { Game } from '@mirror/shared';
import { useAuth } from '../../contexts/AuthContext';
import { LanguageSelector } from '../ui/LanguageSelector';
import { SoundToggle } from '../ui/SoundToggle';


interface GameHeaderProps {
  game: Game;
  onLeave: () => void;
}

const statusColorMap: Record<string, string> = {
  waiting: 'bg-game-orange',
  active: 'bg-game-green',
  guessing_phase: 'bg-game-purple',
  finished: 'bg-game-neutral',
  basket_writing: 'bg-game-blue',
  basket_guessing: 'bg-game-purple',
  clash_writing: 'bg-game-orange',
  clash_guessing: 'bg-red-500',
  idea_writing: 'bg-game-blue',
  idea_rating: 'bg-game-purple',
};

const statusLabelKeyMap: Record<string, string> = {
  waiting: 'game.ui.statusWaiting',
  active: 'game.ui.statusActive',
  guessing_phase: 'game.ui.statusGuessing',
  finished: 'game.ui.statusFinished',
  basket_writing: 'game.ui.statusBasketWriting',
  basket_guessing: 'game.ui.statusBasketGuessing',
  clash_writing: 'game.ui.statusClashWriting',
  clash_guessing: 'game.ui.statusClashGuessing',
  idea_writing: 'game.ui.statusIdeaWriting',
  idea_rating: 'game.ui.statusIdeaRating',
};

export const GameHeader: React.FC<GameHeaderProps> = ({ game, onLeave }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.uid === game.adminId;

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 mb-6 rounded-lg">
      <div className="flex items-center justify-end mb-4">
        <div className="flex gap-3">
          <LanguageSelector />
          <SoundToggle />
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {game.id}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('game.admin') || 'Admin'}: {game.adminName}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`${statusColorMap[game.status] || 'bg-gray-400'} text-white px-4 py-2 rounded-lg font-semibold text-sm capitalize`}
          >
            {statusLabelKeyMap[game.status] ? t(statusLabelKeyMap[game.status]) : game.status.replace('_', ' ')}
          </span>
          {isAdmin && (
            <span className="bg-game-blue text-white px-3 py-1 rounded text-xs font-semibold">
              {t('game.youAreAdmin') || 'You are admin'}
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button"
          onClick={onLeave}
          data-cy="leave-game-button"
          className="text-xs text-game-danger/70 px-2 py-1 rounded hover:text-game-danger hover:bg-game-danger/10 transition-colors"
        >
          {t('game.leaveGame') || 'Leave Game'}
        </button>
      </div>
    </div>
  );
};
