import React from 'react';
import { Game } from '@mirror/shared';
import { useAuth } from '../../contexts/AuthContext';
import { HeaderLogo } from '../ui/HeaderLogo';
import { LanguageSelector } from '../ui/LanguageSelector';
import { SoundToggle } from '../ui/SoundToggle';
import { t } from '@/i18n';

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
};

export const GameHeader: React.FC<GameHeaderProps> = ({ game, onLeave }) => {
  const { user } = useAuth();
  const isAdmin = user?.uid === game.adminId;

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 mb-6 rounded-lg">
      <div className="flex items-center justify-between mb-4">
        <div className="w-20 h-20">
          <HeaderLogo />
        </div>
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
            {game.status.replace('_', ' ')}
          </span>
          {isAdmin && (
            <span className="bg-game-blue text-white px-3 py-1 rounded text-xs font-semibold">
              {t('game.youAreAdmin') || 'You are admin'}
            </span>
          )}
        </div>
      </div>

      <button type="button"
        onClick={onLeave}
        className="w-full bg-game-danger text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity"
      >
        {t('game.leaveGame') || 'Leave Game'}
      </button>
    </div>
  );
};
