import React from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';

interface Props {
  scoreA: number;
  scoreB: number;
}

export const ClashScoreboard: React.FC<Props> = ({ scoreA, scoreB }) => {
  const { t } = useLanguage();
  return (
    <div className="flex justify-center mb-3">
      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl px-5 py-2">
        <p
          data-cy="clash-team-score"
          data-cy-a={scoreA}
          data-cy-b={scoreB}
          className="text-sm font-bold text-gray-900 dark:text-white"
        >
          {t('game.ui.clash.teamScore', { a: scoreA, b: scoreB })}
        </p>
      </div>
    </div>
  );
};
