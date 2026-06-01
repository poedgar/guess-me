import React, { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { useAuth } from '../../contexts/AuthContext';
import { HeaderLogo } from '../ui/HeaderLogo';
import { LiquidLoader } from '../ui/LiquidLoader';
import { FancyAlert } from '../ui/FancyAlert';
import { t } from '@/i18n';

export const JoinScreen: React.FC = () => {
  const { enterGame } = useGame();
  const { signOut } = useAuth();
  const [gameInput, setGameInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameInput.trim()) {
      setError(t('game.enterGameId') || 'Please enter a game ID or password');
      setShowError(true);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      await enterGame(gameInput.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join game');
      setShowError(true);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      {showError && error && (
        <FancyAlert
          title={t('game.error') || 'Error'}
          message={error}
          buttons={[
            {
              text: t('common.ok') || 'OK',
              onPress: () => setShowError(false),
            },
          ]}
          onDismiss={() => setShowError(false)}
        />
      )}

      <div className="w-full max-w-sm">
        <HeaderLogo />

        <h1 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">
          {t('game.joinGame') || 'Join a Game'}
        </h1>

        {isLoading ? (
          <div className="mb-8">
            <LiquidLoader size={60} />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 mb-8">
            <input
              type="text"
              value={gameInput}
              onChange={(e) => setGameInput(e.target.value)}
              placeholder={t('game.gameIdPlaceholder') || 'Game ID or Admin Password'}
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-game-blue bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <button type="button"
              type="submit"
              disabled={isLoading}
              className="w-full bg-game-blue text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {t('game.join') || 'Join Game'}
            </button>
          </form>
        )}

        <button type="button"
          onClick={() => signOut()}
          className="w-full bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity"
        >
          {t('auth.signOut') || 'Sign Out'}
        </button>
      </div>
    </div>
  );
};
