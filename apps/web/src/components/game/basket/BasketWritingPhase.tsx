import React, { useState } from 'react';
import { Game } from '@mirror/shared';
import { useGame } from '../../../contexts/GameContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useSound } from '../../../contexts/SoundContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useAlert } from '../../../hooks/useAlert';
import { useScrollIntoViewOnChange } from '../../../hooks/useScrollIntoViewOnChange';
import { PULSE_COLORS } from '../../../constants/pulseColors';
import type { BasketAssignment } from '@mirror/shared';

interface Props {
  game: Game;
}

export const BasketWritingPhase: React.FC<Props> = ({ game }) => {
  const { user } = useAuth();
  const { loading, submitBasketComment, revealBasketComments } = useGame();
  const { playSound } = useSound();
  const { t } = useLanguage();
  const { showAlert, AlertModal } = useAlert();
  const [commentText, setCommentText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);

  const isAdmin = user?.uid === game.adminId;
  const { schedule, currentRoundIndex, currentRoundComments } = game.basketData!;
  const totalRounds = schedule.length;
  const currentRound = schedule[currentRoundIndex];
  const myAssignment = currentRound?.assignments.find((a: BasketAssignment) => a.writerId === user?.uid);
  const subjectParticipant = game.participants.find(p => p.userId === myAssignment?.subjectId);
  const subjectName = subjectParticipant?.userName ?? '?';
  const alreadySubmitted = submitted || currentRoundComments.some((c: any) => c.writerId === user?.uid);
  const submittedCount = currentRoundComments.length;
  const totalCount = currentRound?.assignments.length ?? 0;

  const playerScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${alreadySubmitted}`,
    'center',
    PULSE_COLORS.blue,
  );
  const adminScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${totalCount > 0 && submittedCount >= totalCount}`,
    'center',
    PULSE_COLORS.blue,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      setIsSubmitting(true);
      await submitBasketComment(commentText.trim());
      setSubmitted(true);
      setCommentText('');
      await playSound('success');
    } catch (err) {
      showAlert(t('common.error'), (err instanceof Error && err.message) || t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReveal = async () => {
    try {
      setIsRevealing(true);
      await revealBasketComments();
      await playSound('success');
    } catch (err) {
      showAlert(t('common.error'), (err instanceof Error && err.message) || t('common.error'));
    } finally {
      setIsRevealing(false);
    }
  };

  return (
    <>
      {AlertModal}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 space-y-4">
        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">{t('game.ui.statusLabel')}</span>
          <span className="bg-game-blue text-white text-xs font-bold px-3 py-1 rounded-full">
            {t('game.ui.basket.round', { current: currentRoundIndex + 1, total: totalRounds })}
          </span>
        </div>

        <div ref={playerScrollRef}>
          {alreadySubmitted ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                {t('game.ui.basket.waitingForOthers', { count: submittedCount, total: totalCount })}
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Subject card */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">{t('game.ui.basket.yourSubject')}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{subjectName}</p>
              </div>

              <textarea
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                placeholder={t('game.ui.basket.writeComment')}
                maxLength={500}
                rows={4}
                disabled={isSubmitting}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-game-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none disabled:opacity-50"
              />
              <div className="flex justify-between items-center">
                <span className={`text-sm ${commentText.length >= 450 ? 'text-red-500' : 'text-gray-400'}`}>
                  {commentText.length}/500
                </span>
                <button
                  type="submit"
                  disabled={!commentText.trim() || isSubmitting}
                  className="bg-game-blue text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isSubmitting ? t('common.loading') : t('game.ui.basket.submit')}
                </button>
              </div>
            </form>
          )}
        </div>

        {isAdmin && (
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-blue-200 dark:border-blue-800" ref={adminScrollRef}>
            <p className="text-sm text-gray-400">{submittedCount}/{totalCount}</p>
            <button
              type="button"
              onClick={handleReveal}
              disabled={isRevealing || loading || submittedCount < totalCount}
              className="bg-game-orange text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isRevealing ? t('common.loading') : t('game.ui.basket.revealComments')}
            </button>
          </div>
        )}
      </div>
    </>
  );
};
