import React from 'react';
import { Idea, assignAnonymousAvatars } from '@mirror/shared';
import { AnonymousAvatar } from '../../ui/AnonymousAvatar';
import { useLanguage } from '../../../contexts/LanguageContext';

interface IdeaLeaderboardProps {
  ideas: Idea[];
  maxHeight?: string;
  title?: string;
}

export const IdeaLeaderboard: React.FC<IdeaLeaderboardProps> = ({
  ideas,
  maxHeight = 'max-h-96',
  title,
}) => {
  const { t } = useLanguage();

  const ranked = [...ideas].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const ideaAvatars = assignAnonymousAvatars(ideas.map(i => i.id), 'ideas');
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="mb-6">
      {title && (
        <p className="text-center font-semibold text-lg mb-3 text-gray-900 dark:text-white">
          {title}
        </p>
      )}
      {ranked.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-4">
          {t('game.ui.ideas.noIdeasYet')}
        </p>
      ) : (
        <div className={`space-y-2 ${maxHeight} overflow-y-auto`}>
          {ranked.map((idea, idx) => (
            <div
              key={idea.id}
              data-cy="idea-leaderboard-row"
              className={`flex items-center gap-3 p-3 rounded-lg ${
                idx === 0
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-600'
                  : 'bg-gray-50 dark:bg-gray-700'
              }`}
            >
              <div className="w-9 text-center flex-shrink-0">
                {idx < 3 ? (
                  <span className="text-2xl">{medals[idx]}</span>
                ) : (
                  <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">
                    #{idx + 1}
                  </span>
                )}
              </div>

              <AnonymousAvatar avatarId={ideaAvatars[idea.id]} size="sm" />

              <p className="flex-1 min-w-0 text-sm text-gray-900 dark:text-white">
                {idea.text}
              </p>

              <div className="text-right flex-shrink-0">
                <p className="text-xl font-bold text-game-green" data-cy="idea-leaderboard-points">
                  {idea.score ?? 0}
                </p>
                <p className="text-xs text-gray-400">{t('game.ui.pointsTotal')}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
