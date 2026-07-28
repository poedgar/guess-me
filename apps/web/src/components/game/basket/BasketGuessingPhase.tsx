import React, { useState } from 'react';
import { Game } from '@mirror/shared';
import { useGame } from '../../../contexts/GameContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useSound } from '../../../contexts/SoundContext';
import { useLanguage } from '../../../contexts/LanguageContext';
import { useAlert } from '../../../hooks/useAlert';
import { useScrollIntoViewOnChange } from '../../../hooks/useScrollIntoViewOnChange';

interface Props {
  game: Game;
}

export const BasketGuessingPhase: React.FC<Props> = ({ game }) => {
  const { user } = useAuth();
  const { loading, submitBasketCommentGuess, submitBasketAuthorGuess, startNextBasketRound } = useGame();
  const { playSound } = useSound();
  const { t } = useLanguage();
  const { showAlert, AlertModal } = useAlert();

  const [selectedWriterId, setSelectedWriterId] = useState<string | null>(null);
  const [isCommentCorrect, setIsCommentCorrect] = useState<boolean | null>(null);
  const [authorSubmitted, setAuthorSubmitted] = useState(false);
  const [isSubmittingGuess, setIsSubmittingGuess] = useState(false);
  const [isSubmittingAuthor, setIsSubmittingAuthor] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

  if (!game.basketData) return null;

  const { schedule, currentRoundIndex, currentRoundComments, currentRoundGuesses } = game.basketData;
  const totalRounds = schedule.length;
  const guesserId = user?.uid ?? '';
  const isAdmin = user?.uid === game.adminId;
  const isLastRound = currentRoundIndex + 1 >= schedule.length;

  const existingGuess = currentRoundGuesses.find((g: any) => g.guesserId === guesserId);
  const actualComment = currentRoundComments.find((c: any) => c.subjectId === guesserId);

  const writerIds = new Set(schedule[currentRoundIndex].assignments.map((a: any) => a.writerId));
  const otherPlayers = game.participants.filter(p => p.userId !== guesserId && writerIds.has(p.userId));

  const effectiveCorrect = isCommentCorrect !== null
    ? isCommentCorrect
    : (existingGuess?.commentCorrect ?? null);

  const showAuthorPrompt = effectiveCorrect === true &&
    !authorSubmitted &&
    existingGuess?.authorGuessId === undefined;

  const isDone = authorSubmitted || (
    existingGuess && (!existingGuess.commentCorrect || existingGuess.authorGuessId !== undefined)
  );

  const showWrong = effectiveCorrect === false && selectedWriterId !== null;

  const subjectIds = schedule[currentRoundIndex]?.assignments.map((a: any) => a.subjectId) ?? [];
  const allGuessersDone = subjectIds.length > 0 && subjectIds.every((subjectId: string) => {
    const guess = currentRoundGuesses.find((g: any) => g.guesserId === subjectId);
    return guess !== undefined && (!guess.commentCorrect || guess.authorGuessId !== undefined);
  });

  const playerScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${isDone || showWrong}:${showAuthorPrompt}`,
  );
  const adminScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${currentRoundIndex}:${allGuessersDone}`,
  );

  const handleCommentSelect = async (commentWriterId: string) => {
    showAlert(
      t('game.alerts.confirmTitle'),
      t('game.ui.basket.confirmCommentGuess'),
      [
        { text: t('common.cancel'), onPress: () => {}, style: 'secondary' },
        {
          text: t('common.yes'),
          onPress: async () => {
            if (selectedWriterId !== null || isSubmittingGuess) return;
            try {
              setIsSubmittingGuess(true);
              const correct = actualComment?.writerId === commentWriterId;
              setSelectedWriterId(commentWriterId);
              setIsCommentCorrect(correct);
              await submitBasketCommentGuess(commentWriterId);
              await playSound(correct ? 'correctGuess' : 'wrongGuess');
            } catch (err) {
              showAlert(t('common.error'), (err instanceof Error && err.message) || t('common.error'));
            } finally {
              setIsSubmittingGuess(false);
            }
          },
          style: 'primary',
        },
      ],
    );
  };

  const handleAuthorSelect = async (authorId: string, displayName: string) => {
    showAlert(
      t('game.alerts.confirmTitle'),
      t('game.ui.basket.confirmAuthorGuess', { name: displayName }),
      [
        { text: t('common.cancel'), onPress: () => {}, style: 'secondary' },
        {
          text: t('common.yes'),
          onPress: async () => {
            if (authorSubmitted || isSubmittingAuthor) return;
            try {
              setIsSubmittingAuthor(true);
              await submitBasketAuthorGuess(authorId);
              setAuthorSubmitted(true);
              await playSound('success');
            } catch (err) {
              showAlert(t('common.error'), (err instanceof Error && err.message) || t('common.error'));
            } finally {
              setIsSubmittingAuthor(false);
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
      await startNextBasketRound();
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
        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">{t('game.ui.statusLabel')}</span>
          <span className="bg-game-purple text-white text-xs font-bold px-3 py-1 rounded-full">
            {t('game.ui.basket.round', { current: currentRoundIndex + 1, total: totalRounds })}
          </span>
        </div>

        <div ref={playerScrollRef}>
        {isDone || showWrong ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center space-y-2">
            {showWrong && (
              <p className="text-red-500 font-bold">{t('game.ui.basket.wrong')}</p>
            )}
            <p className="text-gray-500 dark:text-gray-400">
              {t('game.ui.basket.waitingForGuesses', {
                count: currentRoundGuesses.length,
                total: game.participants.length,
              })}
            </p>
          </div>
        ) : showAuthorPrompt ? (
          <div className="space-y-3">
            <p className="text-game-green font-bold">{t('game.ui.basket.correct')}</p>
            <p className="font-semibold text-gray-900 dark:text-white">{t('game.ui.basket.whoWroteIt')}</p>
            {otherPlayers.map(p => (
              <button
                key={p.userId}
                type="button"
                onClick={() => handleAuthorSelect(p.userId, p.userName)}
                disabled={isSubmittingAuthor || loading}
                className="w-full text-left bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 font-medium text-gray-900 dark:text-white hover:border-game-purple disabled:opacity-50 transition-colors"
              >
                {p.userName}
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="font-semibold text-gray-900 dark:text-white">{t('game.ui.basket.whichIsAboutYou')}</p>
            {currentRoundComments.map((comment: any) => (
              <button
                key={comment.writerId}
                type="button"
                onClick={() => handleCommentSelect(comment.writerId)}
                disabled={selectedWriterId !== null || isSubmittingGuess || loading}
                className={`w-full text-left bg-white dark:bg-gray-800 border-2 rounded-lg px-4 py-3 text-gray-900 dark:text-white hover:border-game-blue disabled:opacity-50 transition-colors ${
                  selectedWriterId === comment.writerId
                    ? 'border-game-blue'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                {comment.text}
              </button>
            ))}
          </div>
        )}
        </div>

        {isAdmin && (
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-purple-200 dark:border-purple-800" ref={adminScrollRef}>
            {isLastRound && (
              <p className="text-sm font-semibold text-game-green">{t('game.ui.basket.finishGame')}</p>
            )}
            <button
              type="button"
              onClick={handleNextRound}
              disabled={isAdvancing || loading || !allGuessersDone}
              className={`px-6 py-3 rounded-full text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity ${
                isLastRound ? 'bg-game-green' : 'bg-game-blue'
              }`}
            >
              {isAdvancing ? t('common.loading') : t('game.ui.basket.nextRound')}
            </button>
          </div>
        )}
      </div>
    </>
  );
};
