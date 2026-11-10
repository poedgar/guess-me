import { useLanguage } from '../../../contexts/LanguageContext';
import React, { useState } from 'react';
import { Game, assignAnonymousAvatars } from '@mirror/shared';
import { AnonymousAvatar } from '../../ui/AnonymousAvatar';
import { useGame } from '../../../contexts/GameContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useSound } from '../../../contexts/SoundContext';
import { useAlert } from '../../../hooks/useAlert';
import { AdminRoundTools } from '../AdminRoundTools';

interface Props {
  game: Game;
}

export const IdeaRatingPhase: React.FC<Props> = ({ game }) => {
  const { user } = useAuth();
  const { loading, submitIdeaRating, startNextIdeaRound, restartIdeaRound, skipIdeaRound } = useGame();
  const { playSound } = useSound();
  const { t } = useLanguage();
  const { showAlert, AlertModal } = useAlert();
  const [selectedPoints, setSelectedPoints] = useState<Record<string, number>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [submittingIdeaId, setSubmittingIdeaId] = useState<string | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const ideaData = game.ideaData!;
  const { schedule, currentRoundIndex, currentRoundRatings, incognitoMode, ideas } = ideaData;
  const isAdmin = user?.uid === game.adminId;
  const isLastRound = currentRoundIndex + 1 >= schedule.length;
  const currentAuthorId = schedule[currentRoundIndex];
  const currentIdeas = ideas.filter(i => i.authorId === currentAuthorId);
  // Over all ideas, so an idea has the same avatar here and on the leaderboard.
  const ideaAvatars = assignAnonymousAvatars(ideas.map(i => i.id), 'ideas');

  const raterId = user?.uid ?? '';
  const myRatingsThisRound = new Set(
    currentRoundRatings.filter(r => r.raterId === raterId).map(r => r.ideaId),
  );

  const eligibleRaterIds = (game.adminWritesComments ?? false)
    ? game.participants.map(p => p.userId)
    : game.participants.filter(p => p.userId !== game.adminId).map(p => p.userId);
  const allRatersDone = eligibleRaterIds.every(id => {
    const ratedIdeaIds = new Set(currentRoundRatings.filter(r => r.raterId === id).map(r => r.ideaId));
    return currentIdeas.every(idea => ratedIdeaIds.has(idea.id));
  });

  const handleSelectPoints = (ideaId: string, points: number) => {
    setSelectedPoints(prev => ({ ...prev, [ideaId]: points }));
  };

  const handleSubmitRating = (ideaId: string) => {
    const points = selectedPoints[ideaId];
    if (points === undefined) return;
    showAlert(
      t('game.alerts.confirmTitle'),
      t('game.ui.ideas.confirmSubmitRating'),
      [
        { text: t('common.cancel'), onPress: () => {}, style: 'secondary' },
        {
          text: t('common.yes'),
          onPress: async () => {
            try {
              setSubmittingIdeaId(ideaId);
              await submitIdeaRating(ideaId, points, commentDrafts[ideaId]);
              await playSound('points');
            } catch (err) {
              showAlert(t('common.error'), (err instanceof Error && err.message) || t('common.error'));
            } finally {
              setSubmittingIdeaId(null);
            }
          },
          style: 'primary',
        },
      ],
    );
  };

  const handleNextRound = async () => {
    if (isAdvancing) return;
    try {
      setIsAdvancing(true);
      await startNextIdeaRound();
      await playSound(isLastRound ? 'gameOver' : 'roundComplete');
    } catch (err) {
      showAlert(t('common.error'), (err instanceof Error && err.message) || t('common.error'));
    } finally {
      setIsAdvancing(false);
    }
  };

  return (
    <>
      {AlertModal}
      <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">{t('game.ui.statusLabel')}</span>
          <span className="bg-game-purple text-white text-xs font-bold px-3 py-1 rounded-full">
            {t('game.ui.ideas.round', { current: currentRoundIndex + 1, total: schedule.length })}
          </span>
        </div>

        <div className="space-y-4">
          {currentIdeas.map(idea => {
            const alreadyRated = myRatingsThisRound.has(idea.id);
            return (
              <div
                key={idea.id}
                data-cy="idea-rating-card"
                data-cy-idea-id={idea.id}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <AnonymousAvatar avatarId={ideaAvatars[idea.id]} />
                  <p className="flex-1 min-w-0 break-words text-gray-900 dark:text-white">{idea.text}</p>
                </div>
                {alreadyRated ? (
                  <p className="text-sm text-game-green font-semibold">{t('game.ui.ideas.waitingForRatings', {
                    count: currentRoundRatings.filter(r => r.ideaId === idea.id).length,
                    total: eligibleRaterIds.length,
                  })}</p>
                ) : eligibleRaterIds.includes(raterId) ? (
                  <>
                    <p className="text-xs text-gray-400">{t('game.ui.ideas.pointsLabel')}</p>
                    <div className="flex gap-2">
                      {[0, 1, 2, 3, 4, 5].map(points => (
                        <button
                          key={points}
                          type="button"
                          onClick={() => handleSelectPoints(idea.id, points)}
                          disabled={submittingIdeaId === idea.id || loading}
                          data-cy="idea-rating-points-button"
                          data-cy-idea-id={idea.id}
                          data-cy-points={points}
                          className={`w-10 h-10 rounded-full border-2 font-semibold transition-all ${
                            selectedPoints[idea.id] === points
                              ? 'bg-game-blue border-game-blue text-white'
                              : 'border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:border-game-blue'
                          }`}
                        >
                          {points}
                        </button>
                      ))}
                    </div>
                    {incognitoMode && (
                      <textarea
                        value={commentDrafts[idea.id] ?? ''}
                        onChange={e => setCommentDrafts(prev => ({ ...prev, [idea.id]: e.target.value }))}
                        placeholder={t('game.ui.ideas.commentPlaceholder')}
                        maxLength={500}
                        rows={2}
                        disabled={submittingIdeaId === idea.id}
                        data-cy="idea-rating-comment-input"
                        data-cy-idea-id={idea.id}
                        className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-game-purple bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none disabled:opacity-50 text-sm"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => handleSubmitRating(idea.id)}
                      disabled={selectedPoints[idea.id] === undefined || submittingIdeaId === idea.id || loading}
                      data-cy="submit-idea-rating-button"
                      data-cy-idea-id={idea.id}
                      className="bg-game-purple text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {submittingIdeaId === idea.id ? t('common.loading') : t('game.ui.ideas.submitRating')}
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 italic" data-cy="idea-rating-not-eligible">
                    {t('game.ui.ideas.notEligibleToRate')}
                  </p>
                )}
                {incognitoMode && (() => {
                  const comments = currentRoundRatings.filter(r => r.ideaId === idea.id && r.comment);
                  return comments.length > 0 ? (
                    <div className="space-y-1 pt-1" data-cy="idea-rating-comments-list" data-cy-idea-id={idea.id}>
                      <p className="text-xs text-gray-400">{t('game.ui.ideas.commentsHeading')}</p>
                      {comments.map((r, i) => (
                        <p key={i} className="text-sm text-gray-600 dark:text-gray-300 italic" data-cy="idea-rating-comment-item">
                          &ldquo;{r.comment}&rdquo;
                        </p>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>
            );
          })}
        </div>

        {isAdmin && (
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-purple-200 dark:border-purple-800">
            {isLastRound && (
              <p className="text-sm font-semibold text-game-green">{t('game.ui.ideas.finishGame')}</p>
            )}
            <button
              type="button"
              onClick={handleNextRound}
              disabled={isAdvancing || loading || !allRatersDone}
              data-cy="next-idea-round-button"
              className={`px-6 py-3 rounded-full text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity ${
                isLastRound ? 'bg-game-green' : 'bg-game-blue'
              }`}
            >
              {isAdvancing ? t('common.loading') : t('game.ui.ideas.nextRound')}
            </button>
            <AdminRoundTools isAdmin={isAdmin} onRestart={restartIdeaRound} onSkip={skipIdeaRound} />
          </div>
        )}
      </div>
    </>
  );
};
