import { useLanguage } from '../../../contexts/LanguageContext';
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { HeaderLogo } from '../ui/HeaderLogo';
import { LanguageSelector } from '../ui/LanguageSelector';
import { SoundToggle } from '../ui/SoundToggle';
import { LiquidLoader } from '../ui/LiquidLoader';


export const AuthScreen: React.FC = () => {
  const { signIn } = useAuth();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <HeaderLogo />

        <h1 className="text-4xl font-bold text-center mb-4 text-gray-900 dark:text-white">
          In The Mirror
        </h1>

        <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
          {t('game.description') || 'A multiplayer game for understanding yourself and others better.'}
        </p>

        {error && (
          <div className="bg-game-danger/10 border border-game-danger text-game-danger rounded-lg p-4 mb-6 text-sm">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="mb-8">
            <LiquidLoader size={60} />
          </div>
        ) : (
          <button type="button"
            onClick={handleSignIn}
            className="w-full bg-game-blue text-white px-6 py-4 rounded-lg font-semibold hover:opacity-90 transition-opacity mb-8 text-lg"
          >
            {t('auth.signInGoogle') || 'Sign in with Google'}
          </button>
        )}

        <div className="space-y-4 flex flex-col items-center">
          <LanguageSelector />
          <SoundToggle />
        </div>
      </div>
    </div>
  );
};
