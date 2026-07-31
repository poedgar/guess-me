import { useLanguage } from '../../contexts/LanguageContext';
import React, { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../hooks/useAlert';
import { HeaderLogo } from '../ui/HeaderLogo';
import { LiquidLoader } from '../ui/LiquidLoader';


export const JoinScreen: React.FC = () => {
  const { enterGame } = useGame();
  const { signOut } = useAuth();
  const { showAlert, AlertModal } = useAlert();
  const { t } = useLanguage();
  const [gameInput, setGameInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gameInput.trim()) {
      showAlert(
        t('game.alerts.invalidInputTitle'),
        t('game.alerts.invalidInputMessage'),
      );
      return;
    }

    try {
      setIsLoading(true);
      await enterGame(gameInput.trim());
    } catch (err) {
      setIsLoading(false);
      showAlert(
        t('common.error'),
        (err instanceof Error && err.message) || t('game.alerts.enterGameFailed'),
      );
    }
  };

  return (
    <>
      {AlertModal}
      <div className="min-h-screen flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <HeaderLogo />

          <h1 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">
            {t('game.joinGame')}
          </h1>

          {isLoading ? (
            <div className="mb-8 flex justify-center">
              <LiquidLoader size={60} />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 mb-8">
              <input
                type="text"
                value={gameInput}
                onChange={e => setGameInput(e.target.value)}
                placeholder={t('game.gameIdPlaceholder')}
                data-cy="game-input"
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-game-blue bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={isLoading}
                data-cy="game-input-submit"
                className="w-full bg-game-blue text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {t('game.join')}
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={() => signOut()}
            className="w-full bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            {t('auth.signOut')}
          </button>
        </div>
      </div>
    </>
  );
};
