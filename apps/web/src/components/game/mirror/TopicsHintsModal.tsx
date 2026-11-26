import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../../contexts/LanguageContext';

interface TopicsHintsModalProps {
  onClose: () => void;
}

interface Topic {
  titleKey: string;
  questionKey?: string;
  hintKeys?: string[];
}

const TOPICS: Topic[] = [
  { titleKey: 'game.ui.topicsHints.topic1Title', questionKey: 'game.ui.topicsHints.topic1Question' },
  {
    titleKey: 'game.ui.topicsHints.topic2Title',
    hintKeys: ['game.ui.topicsHints.topic2HintA', 'game.ui.topicsHints.topic2HintB', 'game.ui.topicsHints.topic2HintC'],
  },
  {
    titleKey: 'game.ui.topicsHints.topic3Title',
    hintKeys: ['game.ui.topicsHints.topic3HintA', 'game.ui.topicsHints.topic3HintB', 'game.ui.topicsHints.topic3HintC'],
  },
  {
    titleKey: 'game.ui.topicsHints.topic4Title',
    hintKeys: ['game.ui.topicsHints.topic4HintA', 'game.ui.topicsHints.topic4HintB', 'game.ui.topicsHints.topic4HintC'],
  },
  {
    titleKey: 'game.ui.topicsHints.topic5Title',
    hintKeys: ['game.ui.topicsHints.topic5HintA', 'game.ui.topicsHints.topic5HintB', 'game.ui.topicsHints.topic5HintC'],
  },
];

const HINT_LABELS = ['а', 'б', 'в'];

export const TopicsHintsModal: React.FC<TopicsHintsModalProps> = ({ onClose }) => {
  const { t } = useLanguage();
  const [activeIndex, setActiveIndex] = useState(0);
  const [showHints, setShowHints] = useState(false);
  const activeTopic = TOPICS[activeIndex];

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return createPortal(
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
                setActiveIndex(idx);
                setShowHints(false);
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
        </div>

        <button
          type="button"
          onClick={onClose}
          data-cy="topics-hints-done"
          className="w-full bg-gray-500 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          {t('common.done')}
        </button>
      </div>

      {showHints && activeTopic.hintKeys && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[60]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowHints(false);
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-semibold text-center mb-4 text-gray-900 dark:text-white">
              {t('game.ui.topicsHints.hintsModalTitle')}
            </h3>
            <div className="space-y-2 mb-6" data-cy="topic-hints-content">
              {activeTopic.hintKeys.map((key, idx) => (
                <p key={key} className="text-gray-900 dark:text-white">
                  {HINT_LABELS[idx]}) {t(key)}
                </p>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowHints(false)}
              data-cy="topic-hints-close"
              className="w-full bg-gray-500 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              {t('common.done')}
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
};
