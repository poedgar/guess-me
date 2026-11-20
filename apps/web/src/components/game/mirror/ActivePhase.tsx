import { useLanguage } from '../../../contexts/LanguageContext';
import React, { useEffect, useState } from 'react';
import { Game, assignAnonymousAvatars } from '@mirror/shared';
import { AnonymousAvatar } from '../../ui/AnonymousAvatar';
import { Comment, useGame } from '../../../contexts/GameContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useSound } from '../../../contexts/SoundContext';
import { useAlert } from '../../../hooks/useAlert';
import { Leaderboard } from '../Leaderboard';
import { AdminRoundTools } from '../AdminRoundTools';
import { PostGuessingPointsPanel } from './PostGuessingPointsPanel';
import { getPlayerNumber } from '../../../utils/playerNumbers';
import { getDisplayName } from '../../../utils/displayName';
import { useScrollIntoViewOnChange } from '../../../hooks/useScrollIntoViewOnChange';
import { PULSE_COLORS } from '../../../constants/pulseColors';


interface ActivePhaseProps {
  game: Game;
}

export const ActivePhase: React.FC<ActivePhaseProps> = ({ game }) => {
  const { user } = useAuth();
  const {
    loading,
    submitComment,
    showComments,
    sendCommentBackForEdit,
    awardCommentPoints,
    activateComment,
    rateTargetReaction,
    startGuessingPhase,
    startNextRound,
    restartMirrorRound,
    skipMirrorRound,
  } = useGame();
  const { playSound } = useSound();
  const { showAlert, AlertModal } = useAlert();
  const { t } = useLanguage();
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isDeciding, setIsDeciding] = useState(false);
  const [isRating, setIsRating] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isSendingBack, setIsSendingBack] = useState(false);
  const [isStartingNextRound, setIsStartingNextRound] = useState(false);

  const currentRound = game.currentRound;

  const targetUserId = currentRound?.targetUserId;
  const isAdmin = user?.uid === game.adminId;
  const isTarget = user?.uid === targetUserId;
  const commentsVisible = currentRound?.commentsVisible ?? false;
  // Random cartoon avatar per anonymous comment (never tied to the author).
  const commentAvatars = assignAnonymousAvatars(
    (currentRound?.comments ?? []).map(c => c.id),
    `${game.id}:mirror:${targetUserId}`,
  );
  const reviewFinished = currentRound?.pointsGiven ?? false;
  const activeComment = currentRound?.activeCommentIndex !== undefined
    ? currentRound?.comments?.[currentRound.activeCommentIndex]
    : undefined;

  // Hooks must run unconditionally on every render (Rules of Hooks), so these
  // are declared before the `!currentRound` early return below, with
  // null-safe trigger-key expressions. `adminScrollRef` is declared LAST so
  // its effect wins when both `isAdmin` and `!isTarget` are true (the admin
  // is never the round's target in mirror mode, so those two conditions
  // overlap for every admin, every round).
  const targetScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRound?.roundNumber ?? 'none'}:target:${commentsVisible}:${activeComment?.id ?? 'none'}:${reviewFinished}`,
    'start',
    PULSE_COLORS.green,
  );
  const otherScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRound?.roundNumber ?? 'none'}:other:${commentsVisible}:${activeComment?.id ?? 'none'}:${reviewFinished}`,
    'start',
    PULSE_COLORS.green,
  );
  const adminScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRound?.roundNumber ?? 'none'}:admin:${commentsVisible}`,
    'center',
    PULSE_COLORS.green,
  );

  const userComment = currentRound?.comments?.find(c => c.authorId === user?.uid);

  // Pre-fills the form with the original text the moment the admin sends
  // this author's comment back for editing, so they revise rather than
  // retype from scratch.
  useEffect(() => {
    if (userComment?.needsRevision && commentText === '') {
      setCommentText(userComment.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userComment?.needsRevision]);

  const handleStartNextRound = async () => {
    setIsStartingNextRound(true);
    try {
      await startNextRound();
    } catch (error) {
      showAlert(
        t('common.error'),
        (error instanceof Error && error.message) || t('game.alerts.startNextRoundFailed'),
      );
    } finally {
      setIsStartingNextRound(false);
    }
  };

  if (!currentRound) {
    // The round transition between guessing and the next round is two
    // sequential awaits (finalizeGuessingPhase then startNextRound) — if
    // the second one fails (e.g. a network blip), the game is left here:
    // status 'active' with no currentRound. Give the admin a retry control
    // instead of leaving the game silently stuck.
    return (
      <>
        {AlertModal}
        <div className="text-center py-12">
          {isAdmin ? (
            <button
              type="button"
              onClick={handleStartNextRound}
              disabled={isStartingNextRound}
              className="bg-game-green text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isStartingNextRound ? t('common.loading') : t('game.nextRound')}
            </button>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">{t('game.waitingForAdmin')}</p>
          )}
        </div>
      </>
    );
  }

  const shouldWriteComments = !(
    user?.uid === game.adminId &&
    !game.adminWritesComments &&
    targetUserId !== game.adminId
  );

  // Everyone required to act on each comment: every participant except the
  // round's target, and except the admin unless adminWritesComments.
  const nonTargetPlayers = game.participants.filter(p => {
    if (p.userId === targetUserId) return false;
    if (p.userId === game.adminId && !(game.adminWritesComments ?? false)) return false;
    return true;
  });

  const commentsByAuthor = new Map((currentRound.comments ?? []).map(c => [c.authorId, c]));
  const submittedCount = nonTargetPlayers.filter(p => {
    const c = commentsByAuthor.get(p.userId);
    return c && !c.needsRevision;
  }).length;

  const activeCommentVotes = activeComment?.targetReactionPoints ?? {};
  const votersWhoRated = nonTargetPlayers.filter(p => activeCommentVotes[p.userId] !== undefined);

  const isCommentFullyRated = (comment: Comment) => {
    const voted = comment.targetReactionPoints ?? {};
    return nonTargetPlayers.every(p => voted[p.userId] !== undefined);
  };
  const allReactionsRated = (currentRound.comments ?? []).every(isCommentFullyRated);

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

  const handleSendCommentBack = async (commentId: string) => {
    try {
      setIsSendingBack(true);
      await sendCommentBackForEdit(commentId);
      await playSound('click');
    } catch (error) {
      showAlert(
        t('common.error'),
        (error instanceof Error && error.message) || t('game.alerts.sendCommentBackFailed'),
      );
    } finally {
      setIsSendingBack(false);
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

  const handleDecideCommentPoints = async (commentId: string, points: 0 | 1) => {
    try {
      setIsDeciding(true);
      await awardCommentPoints(commentId, points);
      await playSound(points === 1 ? 'points' : 'click');
    } catch (error) {
      showAlert(
        t('common.error'),
        (error instanceof Error && error.message) || t('game.alerts.pointsAwardFailed'),
      );
    } finally {
      setIsDeciding(false);
    }
  };

  const handleRateTargetReaction = async (commentId: string, points: 0 | 1) => {
    try {
      setIsRating(true);
      await rateTargetReaction(commentId, points);
      await playSound(points === 1 ? 'points' : 'click');
    } catch (error) {
      showAlert(
        t('common.error'),
        (error instanceof Error && error.message) || t('game.alerts.reactionRatingFailed'),
      );
    } finally {
      setIsRating(false);
    }
  };

  const handleActivateComment = async (commentId: string) => {
    try {
      setIsActivating(true);
      await activateComment(commentId);
      await playSound('notification');
    } catch (error) {
      showAlert(
        t('common.error'),
        (error instanceof Error && error.message) || t('game.alerts.activateCommentFailed'),
      );
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <>
      {AlertModal}
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border-2 border-game-green">
          <div className="text-center mb-4" data-cy="round-info" data-cy-round={currentRound.roundNumber}>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('game.ui.round')} {currentRound.roundNumber}</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('game.ui.target')}: {currentRound.targetUserName}
            </p>
          </div>

          {/* Admin controls */}
          {isAdmin && (
            <div className="mb-6" ref={adminScrollRef}>
              {!commentsVisible && (
                <div className="mb-4">
                  <p className="text-sm font-semibold text-center text-gray-700 dark:text-gray-300 mb-1">
                    {t('game.ui.commentersStatusTitle')}
                  </p>
                  <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-3">
                    {t('game.ui.commentsProgress', { received: submittedCount, required: nonTargetPlayers.length })}
                  </p>
                  <div className="space-y-1 max-h-80 overflow-y-auto">
                    {nonTargetPlayers.map(p => {
                      const comment = commentsByAuthor.get(p.userId);
                      return (
                        <div
                          key={p.userId}
                          className="px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-gray-700"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500 dark:text-gray-400 w-6">
                              {getPlayerNumber(game, p.userId)}.
                            </span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">
                              {getDisplayName(p.userName, game.showSurnames ?? false)}
                            </span>
                            <span
                              className={`text-xs font-semibold ${
                                !comment ? 'text-gray-400' : comment.needsRevision ? 'text-game-orange' : 'text-game-green'
                              }`}
                            >
                              {!comment
                                ? `⏳ ${t('game.ui.pending')}`
                                : comment.needsRevision
                                  ? `🔄 ${t('game.ui.sentBackForRevision')}`
                                  : `✅ ${t('game.ui.submitted')}`}
                            </span>
                          </div>
                          {comment && !comment.needsRevision && (
                            <div className="mt-1 pl-8">
                              <p className="text-sm text-gray-600 dark:text-gray-400 break-words">{comment.text}</p>
                              <button
                                type="button"
                                onClick={() => handleSendCommentBack(comment.id)}
                                disabled={isSendingBack || loading}
                                data-cy="send-comment-back-button"
                                className="text-xs text-game-danger hover:underline mt-1 disabled:opacity-50"
                              >
                                {t('game.ui.sendBackForEdit')}
                              </button>
                            </div>
                          )}
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
                    data-cy="show-comments-button"
                    className="bg-game-orange text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {loading ? t('common.loading') : t('game.ui.startReview')}
                  </button>
                )}
                {reviewFinished && (
                  <button
                    type="button"
                    onClick={handleStartGuessing}
                    disabled={loading}
                    data-cy="start-guessing-button"
                    className="bg-game-purple text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {loading ? t('common.loading') : t('game.ui.startGuessingPhase')}
                  </button>
                )}
              </div>
              <AdminRoundTools isAdmin={isAdmin} onRestart={restartMirrorRound} onSkip={skipMirrorRound} />
            </div>
          )}

          {/* Target player view */}
          {isTarget && (
            <div ref={targetScrollRef}>
              {!commentsVisible ? (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4" data-cy="target-waiting-view">
                  {t('game.ui.waitingForCommentsAboutYou')}
                </p>
              ) : !reviewFinished ? (
                <div>
                  <p className="font-semibold text-center mb-1">{t('game.ui.commentsAboutYou')}</p>
                  <div className="space-y-3">
                    {(currentRound.comments ?? []).map((comment) => {
                      const commentFullyRated = isCommentFullyRated(comment);
                      return (
                        <div key={comment.id} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                          <div className="flex items-start gap-3 mb-3">
                            <AnonymousAvatar avatarId={commentAvatars[comment.id]} />
                            <p className="flex-1 min-w-0 break-words text-gray-900 dark:text-white">{comment.text}</p>
                          </div>
                          {comment.points !== undefined ? (
                            <p className="text-game-green text-sm font-semibold">
                              {t('game.ui.pointsAwarded')} {comment.points}
                            </p>
                          ) : allReactionsRated ? (
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleDecideCommentPoints(comment.id, 1)}
                                disabled={isDeciding || loading}
                                data-cy="award-comment-points-button"
                                data-cy-points={1}
                                className="bg-game-green text-white px-4 py-1 rounded-full text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                              >
                                {isDeciding ? t('common.loading') : t('game.ui.awardOnePoint')}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDecideCommentPoints(comment.id, 0)}
                                disabled={isDeciding || loading}
                                data-cy="award-comment-points-button"
                                data-cy-points={0}
                                className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white px-4 py-1 rounded-full text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                              >
                                {isDeciding ? t('common.loading') : t('game.ui.declineCommentPoint')}
                              </button>
                            </div>
                          ) : comment.id === activeComment?.id ? (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {t('game.ui.reactionProgress', { received: votersWhoRated.length, required: nonTargetPlayers.length })}
                            </p>
                          ) : commentFullyRated ? (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {t('game.ui.reactionsCompleteWaitingTurn')}
                            </p>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleActivateComment(comment.id)}
                              disabled={isActivating || loading || (activeComment !== undefined && !isCommentFullyRated(activeComment))}
                              data-cy="activate-comment-button"
                              className="bg-game-orange text-white px-4 py-1 rounded-full text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                            >
                              {isActivating ? t('common.loading') : t('game.ui.activateComment')}
                            </button>
                          )}
                        </div>
                      );
                    })}
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
            <div ref={otherScrollRef}>
              {!commentsVisible ? (
                <>
                  {(!userComment || userComment.needsRevision) && shouldWriteComments ? (
                    <form onSubmit={handleSubmitComment} className="space-y-3">
                      {userComment?.needsRevision ? (
                        <p className="text-sm text-game-orange font-semibold">
                          {t('game.ui.commentSentBackBanner')}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {t('game.ui.writeAnonymousCommentAbout', { name: currentRound.targetUserName })}
                        </p>
                      )}
                      <textarea
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        placeholder={t('game.ui.commentPlaceholder')}
                        maxLength={500}
                        rows={4}
                        disabled={isSubmittingComment}
                        data-cy="comment-input"
                        className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-game-green bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none disabled:opacity-50"
                      />
                      <div className="flex justify-between items-center">
                        <span className={`text-sm ${commentText.length >= 450 ? 'text-red-500' : 'text-gray-500'}`}>
                          {commentText.length}/500
                        </span>
                        <button
                          type="submit"
                          disabled={!commentText.trim() || isSubmittingComment}
                          data-cy="submit-comment-button"
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
                    {(currentRound.comments ?? []).map((comment) => {
                      const isActive = comment.id === activeComment?.id;
                      const myRating = comment.targetReactionPoints?.[user?.uid ?? ''];
                      return (
                        <div key={comment.id} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                          <div className="flex items-start gap-3 mb-2">
                            <AnonymousAvatar avatarId={commentAvatars[comment.id]} />
                            <p className="flex-1 min-w-0 break-words text-gray-900 dark:text-white">{comment.text}</p>
                          </div>
                          {comment.points !== undefined ? (
                            <p className="text-game-green text-sm font-semibold">
                              {t('game.ui.points')} {comment.points}
                            </p>
                          ) : isActive ? (
                            myRating === undefined ? (
                              <div className="flex gap-2 mt-3">
                                <button
                                  type="button"
                                  onClick={() => handleRateTargetReaction(comment.id, 1)}
                                  disabled={isRating || loading}
                                  data-cy="rate-target-reaction-button"
                                  data-cy-points={1}
                                  className="bg-game-gold text-white px-4 py-1 rounded-full text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                                >
                                  {isRating ? t('common.loading') : t('game.ui.rateReactionPositive')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRateTargetReaction(comment.id, 0)}
                                  disabled={isRating || loading}
                                  data-cy="rate-target-reaction-button"
                                  data-cy-points={0}
                                  className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white px-4 py-1 rounded-full text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                                >
                                  {isRating ? t('common.loading') : t('game.ui.rateReactionNone')}
                                </button>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                {t('game.ui.yourReactionRating', { points: myRating })}
                              </p>
                            )
                          ) : isCommentFullyRated(comment) ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                              {t('game.ui.reactionsCompleteWaitingTurn')}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                              {t('game.ui.notYetActivated')}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <Leaderboard
          game={game}
          participants={game.participants}
          scores={game.roundStartScores ?? game.scores}
          guessResults={game.roundStartGuessResults ?? game.guessResults}
          maxHeight="max-h-80"
          showSurnames={game.showSurnames}
        />

        {game.postGuessingPointPhase && <PostGuessingPointsPanel game={game} />}
      </div>
    </>
  );
};
