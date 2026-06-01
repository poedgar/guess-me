import React from 'react';
import { useSound } from '../../contexts/SoundContext';

export const SoundToggle: React.FC = () => {
  const { isSoundEnabled, toggleSound } = useSound();

  return (
    <button type="button"
      onClick={toggleSound}
      className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
        isSoundEnabled
          ? 'bg-game-green text-white'
          : 'bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white'
      }`}
    >
      <span>{isSoundEnabled ? '🔊' : '🔇'}</span>
      <span>{isSoundEnabled ? 'Sound On' : 'Sound Off'}</span>
    </button>
  );
};
