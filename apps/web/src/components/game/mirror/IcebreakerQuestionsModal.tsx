import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../../contexts/LanguageContext';

interface IcebreakerQuestionsModalProps {
  onClose: () => void;
}

const QUESTIONS = [
  { a: 'game.ui.icebreaker.question1a', b: 'game.ui.icebreaker.question1b' },
  { a: 'game.ui.icebreaker.question2a', b: 'game.ui.icebreaker.question2b' },
  { a: 'game.ui.icebreaker.question3a', b: 'game.ui.icebreaker.question3b' },
];

export const IcebreakerQuestionsModal: React.FC<IcebreakerQuestionsModalProps> = ({ onClose }) => {
  const { t } = useLanguage();
  const [activeIndex, setActiveIndex] = useState(0);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <h2 className="text-lg font-semibold text-center mb-2 text-gray-900 dark:text-white">
          {t('game.ui.icebreaker.modalTitle')}
        </h2>
        <p className="text-sm text-center text-gray-500 dark:text-gray-400 mb-4">
          {t('game.ui.icebreaker.instructions')}
        </p>

        <div className="flex justify-center gap-3 mb-4">
          {QUESTIONS.map((_, idx) => (
            <button
              type="button"
              key={idx}
              onClick={() => setActiveIndex(idx)}
              data-cy="icebreaker-circle"
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

        <div className="space-y-2 mb-6" data-cy="icebreaker-question">
          <p className="text-gray-900 dark:text-white">а) {t(QUESTIONS[activeIndex].a)}</p>
          <p className="text-gray-900 dark:text-white">б) {t(QUESTIONS[activeIndex].b)}</p>
        </div>

        <button
          type="button"
          onClick={onClose}
          data-cy="icebreaker-done"
          className="w-full bg-gray-500 text-white px-4 py-2 rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
        >
          {t('common.done')}
        </button>
      </div>
    </div>,
    document.body,
  );
};
