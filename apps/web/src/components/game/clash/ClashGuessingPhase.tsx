import React, { useState } from 'react';
import { Game, assignAnonymousAvatars } from '@mirror/shared';
import { AnonymousAvatar } from '../../ui/AnonymousAvatar';
import { useGame } from '../../../contexts/GameContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useSound } from '../../../contexts/SoundContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useAlert } from '../../../hooks/useAlert';
import { useScrollIntoViewOnChange } from '../../../hooks/useScrollIntoViewOnChange';
import { PULSE_COLORS } from '../../../constants/pulseColors';
import { ClashScoreboard } from './ClashScoreboard';
import { AdminRoundTools } from '../AdminRoundTools';
import { getDisplayName } from '../../../utils/displayName';
import { getClashLeader } from '@mirror/shared';

type CardPhase = 'idle' | 'subject_picking' | 'correct' | 'wrong' | 'author_picking' | 'done';

interface Props {
  game: Game;
}

export const ClashGuessingPhase: React.FC<Props> = ({ game }) => {
  const { user } = useAuth();
  const { loading, submitClashGuess, submitClashAuthorGuess, advanceClashGuessing, restartClashRound, skipClashRound } = useGame();
  const { playSound } = useSound();
  const { t } = useLanguage();
  const { showAlert, AlertModal } = useAlert();

  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [cardPhases, setCardPhases] = useState<Record<string, CardPhase>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

  // Hooks must run unconditionally on every render (Rules of Hooks), so these
  // are declared before the `!game.clashData` early return below, with
  // null-safe trigger-key expressions. Not currently reachable given today's
  // Firestore write ordering, but kept safe against future ordering changes.
  const cd = game.clashData;
  const currentRoundIndex = cd?.currentRoundIndex ?? 0;
  const currentGroup = cd?.currentGuessingGroup;
  const uid = user?.uid ?? '';
  const activeLeaderId = cd && currentGroup
    ? getClashLeader(currentGroup === 'a' ? cd.groupA : cd.groupB, currentRoundIndex)
    : undefined;
  const isActiveLeader = uid === activeLeaderId;

  const commentsToGuess: any[] = currentGroup === 'a' ? (cd?.currentRoundCommentsB ?? []) : (cd?.currentRoundCommentsA ?? []);
  // Random cartoon avatar per anonymous comment (never tied to the writer).
  const commentAvatars = assignAnonymousAvatars(
    commentsToGuess.map((c: any) => c.writerId as string),
    `${game.id}:clash:${currentRoundIndex}:${currentGroup}`,
  );
  const existingGuesses: any[] = currentGroup === 'a' ? (cd?.currentRoundGuessesA ?? []) : (cd?.currentRoundGuessesB ?? []);

  const currentGroupDone = commentsToGuess.length > 0 && commentsToGuess.every((c: any) => {
    const guess = existingGuesses.find((g: any) => g.commentWriterId === c.writerId);
    return guess !== undefined && (!guess.subjectCorrect || guess.guessedAuthorId !== undefined);
  });

  const playerScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${currentGroup ?? 'none'}:${isActiveLeader}`,
    'start',
    PULSE_COLORS.danger,
  );
  const adminScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${currentGroup ?? 'none'}:${currentGroupDone}`,
    'center',
    PULSE_COLORS.danger,
  );

  if (!game.clashData) return null;

  const { teamScores } = cd!;
  const totalRounds = cd!.schedule.length;
  const isAdmin = user?.uid === game.adminId;
  const activeLeaderName = getDisplayName(
    game.participants.find(p => p.userId === activeLeaderId)?.userName ?? '?',
    game.showSurnames ?? false,
  );

  const ownGroupIds: string[] = currentGroup === 'a' ? cd!.groupA.memberIds : cd!.groupB.memberIds;
  const oppositeGroupIds: string[] = currentGroup === 'a' ? cd!.groupB.memberIds : cd!.groupA.memberIds;

  const isLastRound = currentRoundIndex + 1 >= totalRounds;
  const otherGroup: 'a' | 'b' = currentGroup === 'a' ? 'b' : 'a';
  const otherGuessCount = otherGroup === 'a' ? cd!.currentRoundGuessesA.length : cd!.currentRoundGuessesB.length;
  const otherCommentCount = otherGroup === 'a' ? cd!.currentRoundCommentsB.length : cd!.currentRoundCommentsA.length;
  const otherGroupDone = otherCommentCount > 0 && otherGuessCount >= otherCommentCount;

  const advanceLabel = otherGroupDone
    ? (isLastRound ? t('game.ui.clash.finishGame') : t('game.ui.clash.nextRound'))
    : t('game.ui.clash.nextLeader');

  const getCardPhase = (writerId: string): CardPhase => {
    const local = cardPhases[writerId];
    if (local) return local;
    const existing = existingGuesses.find((g: any) => g.commentWriterId === writerId);
    if (!existing) return 'idle';
    if (!existing.subjectCorrect) return 'wrong';
    if (existing.guessedAuthorId !== undefined) return 'done';
    return 'correct';
  };

  const handleCardPress = (writerId: string) => {
    if (!isActiveLeader || isSubmitting) return;
    const phase = getCardPhase(writerId);
    if (phase !== 'idle') return;
    const isExpanding = expandedCard !== writerId;
    setExpandedCard(isExpanding ? writerId : null);
    setCardPhases(p => ({ ...p, [writerId]: isExpanding ? 'subject_picking' : 'idle' }));
  };

  const handleSubjectSelect = (commentWriterId: string, guessedSubjectId: string, displayName: string) => {
    showAlert(
      t('game.alerts.confirmTitle'),
      t('game.ui.clash.confirmSubjectGuess', { name: displayName }),
      [
        { text: t('common.cancel'), onPress: () => {}, style: 'secondary' },
        {
          text: t('common.yes'),
          onPress: async () => {
            if (isSubmitting) return;
            const comment = commentsToGuess.find((c: any) => c.writerId === commentWriterId);
            if (!comment) return;
            const correct = comment.subjectId === guessedSubjectId;
            try {
              setIsSubmitting(true);
              await submitClashGuess(commentWriterId, guessedSubjectId);
              setCardPhases(p => ({ ...p, [commentWriterId]: correct ? 'correct' : 'wrong' }));
              await playSound(correct ? 'correctGuess' : 'wrongGuess');
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

  const handleAuthorSelect = (commentWriterId: string, guessedAuthorId: string, displayName: string) => {
    showAlert(
      t('game.alerts.confirmTitle'),
      t('game.ui.clash.confirmAuthorGuess', { name: displayName }),
      [
        { text: t('common.cancel'), onPress: () => {}, style: 'secondary' },
        {
          text: t('common.yes'),
          onPress: async () => {
            if (isSubmitting) return;
            try {
              setIsSubmitting(true);
              await submitClashAuthorGuess(commentWriterId, guessedAuthorId);
              setCardPhases(p => ({ ...p, [commentWriterId]: 'done' }));
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

  const handleAdvance = async () => {
    if (isAdvancing) return;
    try {
      setIsAdvancing(true);
      await advanceClashGuessing();
      await playSound(isLastRound && otherGroupDone ? 'gameOver' : 'roundComplete');
    } catch (err) {
      showAlert(t('common.error'), (err instanceof Error && err.message) || t('common.error'));
    } finally {
      setIsAdvancing(false);
    }
  };

  return (
    <>
      {AlertModal}
      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-2xl p-5 space-y-4">
        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">{t('game.ui.statusLabel')}</span>
          <span className="bg-game-danger text-white text-xs font-bold px-3 py-1 rounded-full">
            {t('game.ui.clash.round', { current: currentRoundIndex + 1, total: totalRounds })}
          </span>
        </div>

        <ClashScoreboard scoreA={teamScores.a} scoreB={teamScores.b} />

        <div ref={playerScrollRef}>
          {!isActiveLeader ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                {t('game.ui.clash.leaderGuessing', { name: activeLeaderName })}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {commentsToGuess.map((comment: any) => {
                const phase = getCardPhase(comment.writerId);
                return (
                  <div key={comment.writerId}>
                    <button
                      type="button"
                      data-cy="clash-guess-comment-button"
                      data-cy-writer-id={comment.writerId}
                      onClick={() => handleCardPress(comment.writerId)}
                      disabled={phase !== 'idle' || isSubmitting || loading}
                      className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-colors ${
                        phase === 'correct' || phase === 'done'
                          ? 'border-green-400 bg-green-50 dark:bg-green-900/20'
                          : phase === 'wrong'
                            ? 'border-red-400 bg-red-50 dark:bg-red-900/20 opacity-60'
                            : phase === 'subject_picking'
                              ? 'border-game-blue bg-white dark:bg-gray-800'
                              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-game-blue'
                      } disabled:cursor-default`}
                    >
                      <div className="flex items-center gap-3">
                        <AnonymousAvatar avatarId={commentAvatars[comment.writerId]} />
                        <p className="flex-1 min-w-0 break-words text-gray-900 dark:text-white">{comment.text}</p>
                      </div>
                    </button>

                    {phase === 'subject_picking' && (
                      <div className="mt-2 ml-4 space-y-2">
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('game.ui.clash.whichMember')}</p>
                        {ownGroupIds.map(memberId => {
                          const p = game.participants.find(pt => pt.userId === memberId);
                          const name = p ? getDisplayName(p.userName, game.showSurnames ?? false) : memberId;
                          return (
                            <button key={memberId} type="button"
                              data-cy="clash-guess-subject-button"
                              data-cy-user-id={memberId}
                              onClick={() => handleSubjectSelect(comment.writerId, memberId, name)}
                              disabled={isSubmitting}
                              className="w-full text-left px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-900 dark:text-white hover:border-game-blue disabled:opacity-50 transition-colors">
                              {name}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {phase === 'wrong' && (
                      <p className="mt-1 ml-4 text-sm font-bold text-red-500">{t('game.ui.clash.wrong')}</p>
                    )}

                    {phase === 'correct' && (
                      <div className="mt-2 ml-4 space-y-2">
                        <p className="text-sm font-bold text-green-600">{t('game.ui.clash.correct')}</p>
                        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('game.ui.clash.whoWroteIt')}</p>
                        {oppositeGroupIds.map(authorId => {
                          const p = game.participants.find(pt => pt.userId === authorId);
                          const name = p ? getDisplayName(p.userName, game.showSurnames ?? false) : authorId;
                          return (
                            <button key={authorId} type="button"
                              data-cy="clash-guess-author-button"
                              data-cy-user-id={authorId}
                              onClick={() => handleAuthorSelect(comment.writerId, authorId, name)}
                              disabled={isSubmitting}
                              className="w-full text-left px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-sm font-medium text-gray-900 dark:text-white hover:border-game-green disabled:opacity-50 transition-colors">
                              {name}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {phase === 'done' && (
                      <p className="mt-1 ml-4 text-sm font-bold text-green-600">{t('game.ui.clash.correctAuthor')}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {isAdmin && (
          <div className="flex flex-col items-center pt-2 border-t border-red-200 dark:border-red-800" ref={adminScrollRef}>
            <button type="button" data-cy="clash-advance-button" onClick={handleAdvance}
              disabled={isAdvancing || loading || !currentGroupDone}
              className={`px-6 py-3 rounded-full text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity ${
                otherGroupDone && isLastRound ? 'bg-game-green' : 'bg-game-blue'
              }`}>
              {isAdvancing ? t('common.loading') : advanceLabel}
            </button>
            <AdminRoundTools isAdmin={isAdmin} onRestart={restartClashRound} onSkip={skipClashRound} />
          </div>
        )}
      </div>
    </>
  );
};
