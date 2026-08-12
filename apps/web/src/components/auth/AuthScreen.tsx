import { useLanguage } from '../../contexts/LanguageContext';
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { mapFirebaseAuthErrorToKey } from '@mirror/shared';
import { HeaderLogo } from '../ui/HeaderLogo';
import { LanguageSelector } from '../ui/LanguageSelector';
import { SoundToggle } from '../ui/SoundToggle';
import { LiquidLoader } from '../ui/LiquidLoader';

type AuthMode = 'signin' | 'register' | 'forgot';

export const AuthScreen: React.FC = () => {
  const { signIn, registerWithEmail, signInWithEmail, resetPassword } = useAuth();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [resetEmail, setResetEmail] = useState('');

  const switchMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setError(null);
    setInfo(null);
  };

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

  const handleEmailSignIn = async () => {
    if (!email.trim() || !password) {
      setError(t('auth.errorFieldsRequired'));
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await signInWithEmail(email.trim(), password);
    } catch (err) {
      setError(t(mapFirebaseAuthErrorToKey(err)));
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!displayName.trim()) {
      setError(t('auth.errorDisplayNameRequired'));
      return;
    }
    if (!email.trim() || !password) {
      setError(t('auth.errorFieldsRequired'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.errorWeakPassword'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.errorPasswordMismatch'));
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await registerWithEmail(email.trim(), password, displayName.trim());
    } catch (err) {
      setError(t(mapFirebaseAuthErrorToKey(err)));
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail.trim()) {
      setError(t('auth.errorInvalidEmail'));
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await resetPassword(resetEmail.trim());
      setInfo(t('auth.resetPasswordSent'));
      setIsLoading(false);
    } catch (err) {
      setError(t(mapFirebaseAuthErrorToKey(err)));
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
        {info && (
          <div className="bg-game-green/10 border border-game-green text-game-green rounded-lg p-4 mb-6 text-sm">
            {info}
          </div>
        )}

        {isLoading ? (
          <div className="mb-8">
            <LiquidLoader size={60} />
          </div>
        ) : authMode === 'forgot' ? (
          <div className="mb-8 space-y-3">
            <input
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder={t('auth.email')}
              data-cy="reset-email-input"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <button
              type="button"
              onClick={handleResetPassword}
              data-cy="send-reset-button"
              className="w-full bg-game-blue text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              {t('auth.sendResetEmail')}
            </button>
            <button
              type="button"
              onClick={() => switchMode('signin')}
              data-cy="back-to-signin-link"
              className="w-full text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {t('auth.backToSignIn')}
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-6 mb-6 justify-center">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                data-cy="signin-tab"
                className={`pb-1 font-semibold ${authMode === 'signin' ? 'border-b-2 border-game-blue text-gray-900 dark:text-white' : 'text-gray-400'}`}
              >
                {t('auth.signIn')}
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                data-cy="register-tab"
                className={`pb-1 font-semibold ${authMode === 'register' ? 'border-b-2 border-game-blue text-gray-900 dark:text-white' : 'text-gray-400'}`}
              >
                {t('auth.register')}
              </button>
            </div>

            <div className="mb-6 space-y-3">
              {authMode === 'register' && (
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('auth.displayNamePlaceholder')}
                  data-cy="display-name-input"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              )}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.email')}
                data-cy="email-input"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.password')}
                data-cy="password-input"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              {authMode === 'register' && (
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('auth.confirmPassword')}
                  data-cy="confirm-password-input"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              )}
              <button
                type="button"
                onClick={authMode === 'register' ? handleRegister : handleEmailSignIn}
                data-cy={authMode === 'register' ? 'register-submit-button' : 'email-signin-submit-button'}
                className="w-full bg-game-blue text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
              >
                {authMode === 'register' ? t('auth.registerWithEmail') : t('auth.signInWithEmail')}
              </button>
              {authMode === 'signin' && (
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  data-cy="forgot-password-link"
                  className="w-full text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {t('auth.forgotPassword')}
                </button>
              )}
            </div>

            <p className="text-center text-gray-400 mb-6 text-sm">{t('common.or')}</p>

            <button type="button"
              onClick={handleSignIn}
              data-cy="google-signin-button"
              className="w-full bg-game-blue text-white px-6 py-4 rounded-lg font-semibold hover:opacity-90 transition-opacity mb-8 text-lg"
            >
              {t('auth.signInGoogle') || 'Sign in with Google'}
            </button>
          </>
        )}

        <div className="space-y-4 flex flex-col items-center">
          <LanguageSelector />
          <SoundToggle />
        </div>
      </div>
    </div>
  );
};
