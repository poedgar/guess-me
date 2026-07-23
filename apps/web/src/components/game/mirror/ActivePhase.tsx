import { useLanguage } from '../../../contexts/LanguageContext';
import React, { useState } from 'react';
import { Game } from '@mirror/shared';
import { useGame } from '../../../contexts/GameContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useSound } from '../../../contexts/SoundContext';
import { useAlert } from '../../../hooks/useAlert';
import { Leaderboard } from '../Leaderboard';
import { getPlayerNumber } from '../../../utils/playerNumbers';


interface ActivePhaseProps {
  game: Game;
}

export const ActivePhase: React.FC<ActivePhaseProps> = ({ game }) => {
  const { user } = useAuth();
  const {
    loading,
    submitComment,
    showComments,
    awardCommentPoints,
    finishAwardingPoints,
    givePointsToTarget,
    startGuessingPhase,
  } = useGame();
  const { playSound } = useSound();
  const { showAlert, AlertModal } = useAlert();
  const { t } = useLanguage();
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [givingPoints, setGivingPoints] = useState<Record<string, boolean>>({});
  const [givingPointsToTarget, setGivingPointsToTarget] = useState(false);
  const [pointsGiven, setPointsGiven] = useState<Record<string, number>>({});

  const currentRound = game.currentRound;
  if (!currentRound) return null;

  const targetUserId = currentRound.targetUserId;
  const isAdmin = user?.uid === game.adminId;
  const isTarget = user?.uid === targetUserId;
  const commentsVisible = currentRound.commentsVisible ?? false;
  const targetFinishedPoints = currentRound.pointsGiven ?? false;

  const alreadyGaveTargetPoints =
    currentRound.targetPointsGivenBy?.includes(user?.uid ?? '') ?? false;
  const hasCompletedPhase =
    game.playersWhoCompletedPostCommentPhase?.includes(user?.uid ?? '') ?? false;

  const userComment = currentRound.comments?.find(c => c.authorId === user?.uid);
  const shouldWriteComments = !(
    user?.uid === game.adminId &&
    !game.adminWritesComments &&
    targetUserId !== game.adminId
  );

  const maxPoints = Math.max(1, game.participants.length - 1);

  const completedPlayers = game.playersWhoCompletedPostCommentPhase ?? [];
  const nonTargetPlayers = game.participants.filter(p => {
    if (p.userId === targetUserId) return false;
    if (p.userId === game.adminId && !(game.adminWritesComments ?? false)) return false;
    return true;
  });
  const allPlayersCompletedPointsPhase = nonTargetPlayers.every(p =>
    completedPlayers.includes(p.userId)
  );

  const submittedAuthorIds = new Set(currentRound.comments?.map(c => c.authorId) ?? []);
  const submittedCount = nonTargetPlayers.filter(p => submittedAuthorIds.has(p.userId)).length;

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) {
      showAlert(t('common.error'), t('game.alerts.commentEmpty'));
      return;
    }
    try {
      setIsSubmittingComment(true);
      await submitComment(commentText.trim());
      setCommentText('');
      await playSound('success');
    } catch (error) {
      showAlert(
        t('common.error'),
        (error instanceof Error && error.message) || t('game.alerts.submitCommentFailed'),
      );
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleShowComments = async () => {
    try {
      await showComments();
      await playSound('notification');
    } catch (error) {
      showAlert(
        t('common.error'),
        (error instanceof Error && error.message) || t('game.alerts.showCommentsFailed'),
      );
    }
  };

  const handleStartGuessing = async () => {
    try {
      await startGuessingPhase();
      await playSound('gameStart');
    } catch (error) {
      showAlert(
        t('common.error'),
        (error instanceof Error && error.message) || t('game.alerts.startGuessingPhaseFailed') || 'Failed to start guessing phase',
      );
    }
  };

  const handleGivePoints = async (commentId: string) => {
    try {
      setGivingPoints(prev => ({ ...prev, [commentId]: true }));
      await awardCommentPoints(commentId, 1);
      setPointsGiven(prev => ({ ...prev, [commentId]: 1 }));
      await playSound('points');
    } catch (error) {
      showAlert(
        t('common.error'),
        (error instanceof Error && error.message) || t('game.alerts.pointsAwardFailed'),
      );
    } finally {
      setGivingPoints(prev => ({ ...prev, [commentId]: false }));
    }
  };

  const handleFinishGivingPoints = async () => {
    try {
      await finishAwardingPoints();
      await playSound('success');
    } catch (error) {
      showAlert(
        t('common.error'),
        (error instanceof Error && error.message) || t('game.alerts.finishPointsFailed'),
      );
    }
  };

  const handleGivePointsToTarget = async (points: number) => {
    showAlert(
      t('game.alerts.confirmTitle'),
      points === 0
        ? t('game.alerts.confirmSkipPoints')
        : t('game.alerts.confirmGivePoints', { count: points }),
      [
        {
          text: t('common.cancel'),
          onPress: () => {},
          style: 'secondary',
        },
        {
          text: t('common.yes'),
          onPress: async () => {
            try {
              setGivingPointsToTarget(true);
              await givePointsToTarget(currentRound.targetUserId, points);
              await playSound('success');
            } catch (error) {
              showAlert(
                t('common.error'),
                (error instanceof Error && error.message) || t('game.alerts.targetPointsAwardFailed'),
              );
            } finally {
              setGivingPointsToTarget(false);
            }
          },
          style: 'primary',
        },
      ],
    );
  };

  return (
    <>
      {AlertModal}
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border-2 border-game-green">
          <div className="text-center mb-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">Round {currentRound.roundNumber}</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('game.ui.target')}: {currentRound.targetUserName}
            </p>
          </div>

          {/* Admin controls */}
          {isAdmin && (
            <div className="mb-6">
              {!commentsVisible && (
                <div className="mb-4">
                  <p className="text-sm font-semibold text-center text-gray-700 dark:text-gray-300 mb-1">
                    {t('game.ui.commentersStatusTitle')}
                  </p>
                  <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-3">
                    {t('game.ui.commentsProgress', { received: submittedCount, required: nonTargetPlayers.length })}
                  </p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {nonTargetPlayers.map(p => {
                      const hasSubmitted = submittedAuthorIds.has(p.userId);
                      return (
                        <div
                          key={p.userId}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700"
                        >
                          <span className="text-sm text-gray-500 dark:text-gray-400 w-6">
                            {getPlayerNumber(game, p.userId)}.
                          </span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">
                            {p.userName}
                          </span>
                          <span
                            className={`text-xs font-semibold ${
                              hasSubmitted ? 'text-game-green' : 'text-gray-400'
                            }`}
                          >
                            {hasSubmitted ? `✅ ${t('game.ui.submitted')}` : `⏳ ${t('game.ui.pending')}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex justify-center gap-3">
                {!commentsVisible && (
                  <button
                    type="button"
                    onClick={handleShowComments}
                    disabled={loading || (currentRound.comments?.length ?? 0) === 0}
                    className="bg-game-orange text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {loading ? t('common.loading') : t('game.ui.showComments')}
                  </button>
                )}
                {commentsVisible && (
                  <button
                    type="button"
                    onClick={handleStartGuessing}
                    disabled={loading || !targetFinishedPoints || !allPlayersCompletedPointsPhase}
                    className="bg-game-purple text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {loading ? t('common.loading') : t('game.ui.startGuessingPhase')}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Target player view */}
          {isTarget && (
            <div>
              {!commentsVisible ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                  {t('game.ui.waitingForCommentsAboutYou')}
                </p>
              ) : !targetFinishedPoints ? (
                <div>
                  <p className="font-semibold text-center mb-4">{t('game.ui.commentsAboutYou')}</p>
                  <div className="space-y-3">
                    {currentRound.comments?.map(comment => (
                      <div key={comment.id} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                        <p className="text-gray-900 dark:text-white mb-3">{comment.text}</p>
                        {comment.points === undefined && !pointsGiven[comment.id] ? (
                          <button
                            type="button"
                            onClick={() => handleGivePoints(comment.id)}
                            disabled={!!givingPoints[comment.id] || loading}
                            className="bg-game-green text-white px-4 py-1 rounded-full text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                          >
                            {givingPoints[comment.id] ? t('common.loading') : '+ 1 point'}
                          </button>
                        ) : (
                          <p className="text-game-green text-sm font-semibold">
                            {t('game.ui.pointsAwarded')} {comment.points ?? pointsGiven[comment.id] ?? 1}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-center mt-4">
                    <button
                      type="button"
                      onClick={handleFinishGivingPoints}
                      disabled={loading}
                      className="bg-game-purple text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {loading ? t('common.loading') : t('game.ui.finishAwardingPoints')}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                  {t('game.ui.finishedAwardingPointsWaitAdmin')}
                </p>
              )}
            </div>
          )}

          {/* Non-target player view */}
          {!isTarget && (
            <div>
              {!commentsVisible ? (
                <>
                  {!userComment && shouldWriteComments ? (
                    <form onSubmit={handleSubmitComment} className="space-y-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {t('game.ui.writeAnonymousCommentAbout', { name: currentRound.targetUserName })}
                      </p>
                      <textarea
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        placeholder={t('game.ui.commentPlaceholder')}
                        maxLength={500}
                        rows={4}
                        disabled={isSubmittingComment}
                        className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-game-green bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none disabled:opacity-50"
                      />
                      <div className="flex justify-between items-center">
                        <span className={`text-sm ${commentText.length >= 450 ? 'text-red-500' : 'text-gray-500'}`}>
                          {commentText.length}/500
                        </span>
                        <button
                          type="submit"
                          disabled={!commentText.trim() || isSubmittingComment}
                          className="bg-game-blue text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                        >
                          {isSubmittingComment ? t('common.loading') : t('game.ui.submitComment')}
                        </button>
                      </div>
                    </form>
                  ) : !shouldWriteComments ? (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                      {t('game.ui.adminNotParticipating')}
                    </p>
                  ) : (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                      {t('game.ui.commentSentWaitingShow')}
                    </p>
                  )}
                </>
              ) : (
                <div>
                  <p className="font-semibold text-center mb-4">{t('game.ui.allComments')}</p>
                  <div className="space-y-3">
                    {currentRound.comments?.map(comment => (
                      <div key={comment.id} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                        <p className="text-gray-900 dark:text-white mb-2">{comment.text}</p>
                        {comment.points !== undefined && (
                          <p className="text-game-green text-sm font-semibold">
                            {t('game.ui.points')} {comment.points}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  {targetFinishedPoints && !hasCompletedPhase && !alreadyGaveTargetPoints && (
                    <div className="mt-6">
                      <p className="text-center font-semibold mb-3 text-gray-900 dark:text-white">
                        {t('game.awardPointsToTarget')}
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {Array.from({ length: maxPoints + 1 }, (_, i) => i).map(points => (
                          <button
                            key={points}
                            type="button"
                            onClick={() => handleGivePointsToTarget(points)}
                            disabled={givingPointsToTarget || loading}
                            className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-600 border-2 border-gray-300 dark:border-gray-500 text-lg font-semibold hover:border-game-gold hover:bg-game-gold/10 disabled:opacity-50 transition-all"
                          >
                            {points}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {(hasCompletedPhase || alreadyGaveTargetPoints) && targetFinishedPoints && (
                    <p className="text-center text-game-green font-semibold mt-4">
                      {t('game.pointsFinalized')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <Leaderboard
          participants={game.participants}
          scores={game.scores}
          guessResults={game.guessResults}
          maxHeight="max-h-80"
        />
      </div>
    </>
  );
};
