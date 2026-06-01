import React, { useState } from 'react';
import { Game } from '@mirror/shared';
import { useGame } from '../../../contexts/GameContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useSound } from '../../../contexts/SoundContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useAlert } from '../../../hooks/useAlert';
import { ClashScoreboard } from './ClashScoreboard';
import type { ClashAssignment } from '@mirror/shared';

interface Props {
  game: Game;
}

export const ClashWritingPhase: React.FC<Props> = ({ game }) => {
  const { user } = useAuth();
  const { loading, submitClashComment, revealClashComments } = useGame();
  const { playSound } = useSound();
  const { t } = useLanguage();
  const { showAlert, AlertModal } = useAlert();
  const [commentText, setCommentText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);

  const cd = game.clashData!;
  const { schedule, currentRoundIndex, currentRoundCommentsA, currentRoundCommentsB, teamScores } = cd;
  const totalRounds = schedule.length;
  const uid = user?.uid ?? '';
  const isAdmin = user?.uid === game.adminId;
  const isGroupA = cd.groupA.memberIds.includes(uid);
  const myAssignments = isGroupA
    ? schedule[currentRoundIndex].assignmentsA
    : schedule[currentRoundIndex].assignmentsB;
  const myAssignment = myAssignments.find((a: ClashAssignment) => a.writerId === uid);
  const subjectParticipant = game.participants.find(p => p.userId === myAssignment?.subjectId);
  const subjectName = subjectParticipant?.userName ?? '?';

  const groupSize = cd.groupA.memberIds.length;
  const alreadySubmitted = submitted
    || (isGroupA ? currentRoundCommentsA : currentRoundCommentsB).some((c: any) => c.writerId === uid);
  const countA = currentRoundCommentsA.length;
  const countB = currentRoundCommentsB.length;
  const allSubmitted = countA >= groupSize && countB >= groupSize;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    try {
      setIsSubmitting(true);
      await submitClashComment(commentText.trim());
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
      await revealClashComments();
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
      <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-2xl p-5 space-y-4">
        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">{t('game.ui.statusLabel')}</span>
          <span className="bg-game-orange text-white text-xs font-bold px-3 py-1 rounded-full">
            {t('game.ui.clash.round', { current: currentRoundIndex + 1, total: totalRounds })}
          </span>
        </div>

        {alreadySubmitted ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center">
            <p className="text-gray-500 dark:text-gray-400">
              {t('game.ui.clash.waitingForGroup', { a: countA, b: countB, n: groupSize })}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-400 mb-1">{t('game.ui.clash.yourSubject')}</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{subjectName}</p>
            </div>
            <textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder={t('game.ui.clash.writeComment')}
              maxLength={500}
              rows={4}
              disabled={isSubmitting}
              className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-game-orange bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none disabled:opacity-50"
            />
            <div className="flex justify-between items-center">
              <span className={`text-sm ${commentText.length >= 450 ? 'text-red-500' : 'text-gray-400'}`}>
                {commentText.length}/500
              </span>
              <button type="submit" disabled={!commentText.trim() || isSubmitting}
                className="bg-game-blue text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
                {isSubmitting ? t('common.loading') : t('game.ui.clash.submit')}
              </button>
            </div>
          </form>
        )}

        {isAdmin && (
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-orange-200 dark:border-orange-800">
            <ClashScoreboard scoreA={teamScores.a} scoreB={teamScores.b} />
            <p className="text-sm text-gray-400">{countA}/{groupSize} · {countB}/{groupSize}</p>
            <button type="button" onClick={handleReveal}
              disabled={isRevealing || loading || !allSubmitted}
              className="bg-game-orange text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity">
              {isRevealing ? t('common.loading') : t('game.ui.clash.revealComments')}
            </button>
          </div>
        )}
      </div>
    </>
  );
};
