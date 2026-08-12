import { useLanguage } from '../../../contexts/LanguageContext';
import React, { useState } from 'react';
import { Game } from '@mirror/shared';
import { useGame } from '../../../contexts/GameContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useSound } from '../../../contexts/SoundContext';
import { useAlert } from '../../../hooks/useAlert';
import { AdminRoundTools } from '../AdminRoundTools';

interface Props {
  game: Game;
}

export const IdeaWritingPhase: React.FC<Props> = ({ game }) => {
  const { user } = useAuth();
  const { loading, submitIdea, startIdeaRatingRounds, restartIdeaRound, skipIdeaRound } = useGame();
  const { playSound } = useSound();
  const { t } = useLanguage();
  const { showAlert, AlertModal } = useAlert();
  const [ideaText, setIdeaText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const isAdmin = user?.uid === game.adminId;
  const ideaData = game.ideaData!;
  const myIdeas = ideaData.ideas.filter(i => i.authorId === user?.uid);

  const eligibleWriterIds = (game.adminWritesComments ?? false)
    ? game.participants.map(p => p.userId)
    : game.participants.filter(p => p.userId !== game.adminId).map(p => p.userId);
  const authorIdsWithIdeas = new Set(ideaData.ideas.map(i => i.authorId));
  const submittedCount = eligibleWriterIds.filter(id => authorIdsWithIdeas.has(id)).length;
  const allSubmitted = submittedCount >= eligibleWriterIds.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ideaText.trim()) return;
    showAlert(
      t('game.alerts.confirmTitle'),
      t('game.ui.ideas.confirmSubmitIdea'),
      [
        { text: t('common.cancel'), onPress: () => {}, style: 'secondary' },
        {
          text: t('common.yes'),
          onPress: async () => {
            try {
              setIsSubmitting(true);
              await submitIdea(ideaText.trim());
              setIdeaText('');
              await playSound('success');
            } catch (err) {
              showAlert(t('common.error'), (err instanceof Error && err.message) || t('common.error'));
            } finally {
              setIsSubmitting(false);
            }
          },
          style: 'primary',
        },
      ],
    );
  };

  const handleStartRating = async () => {
    try {
      setIsStarting(true);
      await startIdeaRatingRounds();
      await playSound('gameStart');
    } catch (err) {
      setIsStarting(false);
      showAlert(t('common.error'), (err instanceof Error && err.message) || t('common.error'));
    }
  };

  return (
    <>
      {AlertModal}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 space-y-4">
        {myIdeas.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{t('game.ui.ideas.yourIdeas')}</p>
            {myIdeas.map(idea => (
              <div key={idea.id} className="bg-white dark:bg-gray-800 rounded-xl p-3 text-sm text-gray-900 dark:text-white">
                {idea.text}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={ideaText}
            onChange={e => setIdeaText(e.target.value)}
            placeholder={t('game.ui.ideas.writeIdea')}
            maxLength={500}
            rows={3}
            disabled={isSubmitting}
            data-cy="idea-input"
            className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-game-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none disabled:opacity-50"
          />
          <div className="flex justify-between items-center">
            <span className={`text-sm ${ideaText.length >= 450 ? 'text-red-500' : 'text-gray-400'}`}>
              {ideaText.length}/500
            </span>
            <button
              type="submit"
              disabled={!ideaText.trim() || isSubmitting}
              data-cy="submit-idea-button"
              className="bg-game-blue text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isSubmitting ? t('common.loading') : t('game.ui.ideas.addIdea')}
            </button>
          </div>
        </form>

        <p className="text-center text-sm text-gray-400">
          {t('game.ui.ideas.submittedCount', { count: submittedCount })}
        </p>

        {isAdmin && (
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-blue-200 dark:border-blue-800">
            <button
              type="button"
              onClick={handleStartRating}
              disabled={isStarting || loading || !allSubmitted}
              data-cy="start-rating-rounds-button"
              className="bg-game-orange text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isStarting ? t('common.loading') : t('game.ui.ideas.startRating')}
            </button>
            <AdminRoundTools isAdmin={isAdmin} onRestart={restartIdeaRound} onSkip={skipIdeaRound} />
          </div>
        )}
      </div>
    </>
  );
};
