import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../../contexts/LanguageContext';
import { TOPICS } from './topicsData';
import { TopicHintsModal } from './TopicHintsModal';

interface TopicsHintsModalProps {
  activeIndex: number | null;
  onSelect: (index: number) => void;
  onClear: () => void;
  onClose: () => void;
}

export const TopicsHintsModal: React.FC<TopicsHintsModalProps> = ({
  activeIndex,
  onSelect,
  onClear,
  onClose,
}) => {
  const { t } = useLanguage();
  const [showHints, setShowHints] = useState(false);
  const activeTopic = activeIndex != null ? TOPICS[activeIndex] : null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <>
      {createPortal(
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={handleBackdropClick}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h2 className="text-lg font-semibold text-center mb-4 text-gray-900 dark:text-white">
              {t('game.ui.topicsHints.modalTitle')}
            </h2>

            <div className="flex justify-center flex-wrap gap-3 mb-4">
              {TOPICS.map((_, idx) => (
                <button
                  type="button"
                  key={idx}
                  onClick={() => {
                    setShowHints(false);
                    onSelect(idx);
                  }}
                  data-cy="topic-circle"
                  data-cy-index={idx}
                  className={`w-10 h-10 rounded-full font-semibold text-sm transition-colors ${
                    activeIndex === idx
                      ? 'bg-game-orange text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>

            {activeTopic ? (
              <div className="mb-6" data-cy="topic-content">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-gray-900 dark:text-white">{t(activeTopic.titleKey)}</p>
                  {activeTopic.hintKeys && (
                    <button
                      type="button"
                      onClick={() => setShowHints(true)}
                      data-cy="topic-hints-trigger"
                      aria-label={t('game.ui.topicsHints.hintsButtonLabel')}
                      className="text-game-orange text-lg leading-none px-2"
                    >
                      ▶
                    </button>
                  )}
                </div>
                {activeTopic.questionKey && (
                  <p className="mt-2 text-gray-900 dark:text-white">{t(activeTopic.questionKey)}</p>
                )}
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  {t('game.ui.topicsHints.visibleToEveryone')}
                </p>
                <button
                  type="button"
                  onClick={onClear}
                  data-cy="topic-clear-button"
                  className="mt-2 text-xs text-game-danger"
                >
                  {t('game.ui.topicsHints.hideButton')}
                </button>
              </div>
            ) : (
              <p className="mb-6 text-sm text-center text-gray-500 dark:text-gray-400">
                {t('game.ui.topicsHints.pickPrompt')}
              </p>
            )}

            <button
              type="button"
              onClick={onClose}
              data-cy="topics-hints-done"
              className="w-full bg-gray-500 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              {t('common.done')}
            </button>
          </div>
        </div>,
        document.body,
      )}

      {showHints && activeTopic?.hintKeys && (
        <TopicHintsModal hintKeys={activeTopic.hintKeys} onClose={() => setShowHints(false)} />
      )}
    </>
  );
};
