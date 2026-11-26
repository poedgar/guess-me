import React from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../../contexts/LanguageContext';
import { HINT_LABELS } from './topicsData';

interface TopicHintsModalProps {
  hintKeys: string[];
  onClose: () => void;
}

export const TopicHintsModal: React.FC<TopicHintsModalProps> = ({ hintKeys, onClose }) => {
  const { t } = useLanguage();

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60]"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <h3 className="text-lg font-semibold text-center mb-4 text-gray-900 dark:text-white">
          {t('game.ui.topicsHints.hintsModalTitle')}
        </h3>
        <div className="space-y-2 mb-6" data-cy="topic-hints-content">
          {hintKeys.map((key, idx) => (
            <p key={key} className="text-gray-900 dark:text-white">
              {HINT_LABELS[idx]}) {t(key)}
            </p>
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          data-cy="topic-hints-close"
          className="w-full bg-gray-500 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          {t('common.done')}
        </button>
      </div>
    </div>,
    document.body,
  );
};
