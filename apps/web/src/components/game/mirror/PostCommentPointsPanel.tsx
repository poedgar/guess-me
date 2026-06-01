import { useLanguage } from '../../../contexts/LanguageContext';
import React, { useState } from 'react';
import { Game } from '@mirror/shared';
import { useGame } from '../../../contexts/GameContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useSound } from '../../../contexts/SoundContext';


interface PostCommentPointsPanelProps {
  game: Game;
}

export const PostCommentPointsPanel: React.FC<PostCommentPointsPanelProps> = ({ game }) => {
  const { user } = useAuth();
  const { awardCommentPoints, finishAwardingPoints, skipPostCommentPhase, givePointsToTarget } = useGame();
  const { playSound } = useSound();
  const { t } = useLanguage();
  const [commentPoints, setCommentPoints] = useState<{ [commentId: string]: number }>({});
  const [targetPoints, setTargetPoints] = useState(5);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentRound = game.currentRound;
  const targetUserId = currentRound?.targetUserId;
  const isTarget = user?.uid === targetUserId;
  const comments = currentRound?.comments ?? [];
  const pointsGiven = currentRound?.pointsGiven ?? false;
  const playersWhoCompleted = game.playersWhoCompletedPostCommentPhase ?? [];
  const userHasCompleted = playersWhoCompleted.includes(user?.uid || '');

  const handleAwardPointsToComment = (commentId: string, points: number) => {
    const validPoints = Math.max(0, Math.min(10, points));
    setCommentPoints((prev) => ({ ...prev, [commentId]: validPoints }));
  };

  const handleFinishAwarding = async () => {
    try {
      setIsSubmitting(true);

      // First, award all points that were adjusted
      for (const [commentId, points] of Object.entries(commentPoints)) {
        if (points > 0) {
          await awardCommentPoints(commentId, points);
        }
      }

      // Then finish awarding points
      await finishAwardingPoints();
      await playSound('success');
    } catch (error) {
      console.error('Error finishing:', error);
      setIsSubmitting(false);
    }
  };

  const handleSkipPoints = async () => {
    try {
      setIsSubmitting(true);
      await skipPostCommentPhase();
      await playSound('click');
    } catch (error) {
      console.error('Error skipping:', error);
      setIsSubmitting(false);
    }
  };

  const handleGivePointsToTarget = async () => {
    try {
      setIsSubmitting(true);
      await givePointsToTarget(targetPoints);
      await playSound('success');
    } catch (error) {
      console.error('Error giving points to target:', error);
      setIsSubmitting(false);
    }
  };

  // Non-target players: wait for target to finish awarding
  if (!isTarget && !pointsGiven) {
    return (
      <div className="bg-game-blue/10 border border-game-blue text-game-blue rounded-lg p-4 text-center">
        {t('game.waitingForTargetPoints') || 'Waiting for target to award points to comments...'}
      </div>
    );
  }

  // Target has finished, show completion status
  if (userHasCompleted && !isTarget) {
    return (
      <div className="bg-game-green/10 border border-game-green text-game-green rounded-lg p-4 text-center">
        {t('game.pointsFinalized') || 'You have finished awarding points!'}
      </div>
    );
  }

  // Non-target players: award points to target
  if (!isTarget && pointsGiven && !userHasCompleted) {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border-2 border-game-gold">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
            {t('game.awardPointsToTarget') || 'Award points to the target'}
          </h3>

          <div className="flex items-center justify-center gap-6 mb-6">
            <button type="button"
              onClick={() => setTargetPoints(Math.max(0, targetPoints - 1))}
              disabled={isSubmitting || targetPoints === 0}
              className="bg-gray-300 dark:bg-gray-600 px-4 py-2 rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              −
            </button>
            <div className="text-5xl font-bold text-game-gold w-20 text-center">{targetPoints}</div>
            <button type="button"
              onClick={() => setTargetPoints(Math.min(10, targetPoints + 1))}
              disabled={isSubmitting || targetPoints === 10}
              className="bg-gray-300 dark:bg-gray-600 px-4 py-2 rounded-lg disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              +
            </button>
          </div>

          <button type="button"
            onClick={handleGivePointsToTarget}
            disabled={isSubmitting}
            className="w-full bg-game-gold text-gray-900 px-6 py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isSubmitting ? t('common.loading') || 'Awarding...' : t('game.givePoints') || 'Give Points'}
          </button>
        </div>
      </div>
    );
  }

  // Target: award points to comments
  if (isTarget && !pointsGiven) {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border-2 border-game-gold">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 text-center">
            {t('game.awardPointsToComments') || 'Award points to each comment (0-10)'}
          </h3>

          <div className="space-y-4">
            {comments.map((comment) => (
              <div
                key={comment.id}
                className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-300 dark:border-gray-600"
              >
                <p className="text-gray-900 dark:text-white mb-3">{comment.text}</p>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Points:</span>
                  <div className="flex items-center gap-4">
                    <button type="button"
                      onClick={() =>
                        handleAwardPointsToComment(
                          comment.id,
                          Math.max(0, (commentPoints[comment.id] ?? 0) - 1)
                        )
                      }
                      disabled={isSubmitting}
                      className="bg-gray-300 dark:bg-gray-600 px-3 py-1 rounded enabled:hover:bg-gray-400 disabled:opacity-50 transition-colors"
                    >
                      −
                    </button>
                    <div className="text-2xl font-bold text-game-gold w-12 text-center">
                      {commentPoints[comment.id] ?? 0}
                    </div>
                    <button type="button"
                      onClick={() =>
                        handleAwardPointsToComment(
                          comment.id,
                          Math.min(10, (commentPoints[comment.id] ?? 0) + 1)
                        )
                      }
                      disabled={isSubmitting}
                      className="bg-gray-300 dark:bg-gray-600 px-3 py-1 rounded enabled:hover:bg-gray-400 disabled:opacity-50 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-6">
            <button type="button"
              onClick={handleFinishAwarding}
              disabled={isSubmitting || comments.length === 0}
              className="flex-1 bg-game-green text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isSubmitting ? t('common.loading') || 'Finishing...' : t('game.finishAwarding') || 'Finish Awarding Points'}
            </button>
            <button type="button"
              onClick={handleSkipPoints}
              disabled={isSubmitting}
              className="flex-1 bg-gray-400 dark:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {t('game.skip') || 'Skip Phase'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
