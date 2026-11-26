import React, { useState } from 'react';
import { useLanguage } from '../../../contexts/LanguageContext';
import { TOPICS } from './topicsData';
import { TopicHintsModal } from './TopicHintsModal';

interface ActiveTopicBannerProps {
  activeTopicIndex: number | null | undefined;
}

export const ActiveTopicBanner: React.FC<ActiveTopicBannerProps> = ({ activeTopicIndex }) => {
  const { t } = useLanguage();
  const [showHints, setShowHints] = useState(false);

  if (activeTopicIndex == null) return null;
  const topic = TOPICS[activeTopicIndex];
  if (!topic) return null;

  return (
    <div
      className="bg-game-orange/10 border border-game-orange/30 rounded-lg p-4 mb-4"
      data-cy="active-topic-banner"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-gray-900 dark:text-white">{t(topic.titleKey)}</p>
        {topic.hintKeys && (
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
      {topic.questionKey && (
        <p className="mt-2 text-gray-900 dark:text-white">{t(topic.questionKey)}</p>
      )}

      {showHints && topic.hintKeys && (
        <TopicHintsModal hintKeys={topic.hintKeys} onClose={() => setShowHints(false)} />
      )}
    </div>
  );
};
