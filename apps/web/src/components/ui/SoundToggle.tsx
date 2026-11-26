import React from 'react';
import { useSound } from '../../contexts/SoundContext';
import { useLanguage } from '../../contexts/LanguageContext';

export const SoundToggle: React.FC = () => {
  const { isSoundEnabled, toggleSound } = useSound();
  const { t } = useLanguage();

  return (
    <button type="button"
      onClick={toggleSound}
      aria-label={isSoundEnabled ? t('common.soundOn') : t('common.soundOff')}
      className={`px-3 py-2 rounded-lg font-semibold transition-all flex items-center justify-center ${
        isSoundEnabled
          ? 'bg-game-green text-white'
          : 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white'
      }`}
    >
      <span>{isSoundEnabled ? '🔊' : '🔇'}</span>
    </button>
  );
};
