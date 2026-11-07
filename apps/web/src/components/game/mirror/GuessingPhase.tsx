import { useLanguage } from '../../../contexts/LanguageContext';
import React, { useState } from 'react';
import { Game, Comment } from '@mirror/shared';
import { useGame } from '../../../contexts/GameContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useSound } from '../../../contexts/SoundContext';
import { useAlert } from '../../../hooks/useAlert';
import { Leaderboard } from '../Leaderboard';
import PostGuessingPointsPanel from './PostGuessingPointsPanel';

interface GuessingPhaseProps {
  game: Game;
}

export const GuessingPhase: React.FC<GuessingPhaseProps> = ({ game }) => {
  const { user } = useAuth();
  const { loading, submitGuess, markPlayerGuessesSubmitted, finalizeGuessingPhase, startNextRound } = useGame();
  const { playSound } = useSound();
  const { showAlert, AlertModal } = useAlert();
  const { t } = useLanguage();
  const [selections, setSelections] = useState<{ [commentId: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [hasSubmittedLocal, setHasSubmittedLocal] = useState(false);

  interface GuessResult {
    commentText: string;
    correct: boolean;
    actualAuthorName: string;
    guessedAuthorName: string;
    commentPoints: number;
    guessPoints: number;
  }
  const [guessResultModal, setGuessResultModal] = useState<GuessResult[] | null>(null);

  if (!game.guessingData) return null;

  const guessingData = game.guessingData;
  const isAdmin = user?.uid === game.adminId;
  const singleTargetId = guessingData.singleRoundTargetId;
  const possibleAuthors = guessingData.possibleAuthors ?? [];

  const commentsForPlayer: Comment[] = guessingData.commentsByTarget?.[user?.uid ?? ''] ?? [];

  const hasSubmitted =
    hasSubmittedLocal ||
    guessingData.playersWhoSubmittedGuesses?.includes(user?.uid ?? '');

  const targetSubmitted = singleTargetId
    ? guessingData.playersWhoSubmittedGuesses?.includes(singleTargetId)
    : false;

  const allCommentsSelected =
    commentsForPlayer.length === 0 ||
    commentsForPlayer.every(c => !!selections[c.id]);

  const handleSelect = (commentId: string, authorId: string) => {
    setSelections(prev => ({ ...prev, [commentId]: authorId }));
    playSound('click');
  };

  const handleSubmitGuesses = async () => {
    if (!user) return;
    try {
      setIsSubmitting(true);

      const correctCount = commentsForPlayer.filter(c => {
        const guessedAuthorId = selections[c.id];
        return guessedAuthorId !== undefined && guessedAuthorId === c.authorId;
      }).length;

      const failures: string[] = [];
      for (const comment of commentsForPlayer) {
        const selectedAuthorId = selections[comment.id];
        if (!selectedAuthorId) continue;

        const round =
          game.rounds?.find(r => r.comments?.some(c => c.id === comment.id)) ??
          (game.currentRound?.comments?.some(c => c.id === comment.id) ? game.currentRound : undefined);

        if (!round) continue;
        try {
          await submitGuess(round.roundNumber, comment.id, selectedAuthorId);
        } catch (err) {
          failures.push(comment.id);
        }
      }

      await markPlayerGuessesSubmitted(undefined, correctCount);
      setHasSubmittedLocal(true);
      await playSound('correctGuess');

      // Build result modal data from local selections
      const results: GuessResult[] = commentsForPlayer.map(comment => {
        const guessedAuthorId = selections[comment.id];
        const correct = guessedAuthorId === comment.authorId;
        const actualAuthor = game.participants.find(p => p.userId === comment.authorId);
        const guessedAuthor = game.participants.find(p => p.userId === guessedAuthorId);
        return {
          commentText: comment.text,
          correct,
          actualAuthorName: actualAuthor?.userName ?? '?',
          guessedAuthorName: guessedAuthor?.userName ?? '?',
          commentPoints: comment.points ?? 0,
          guessPoints: correct ? 1 : 0,
        };
      });
      if (results.length > 0) setGuessResultModal(results);

      if (failures.length > 0) {
        showAlert(t('common.error'), `Failed to submit guesses for ${failures.length} comment(s).`);
      }
    } catch (error) {
      showAlert(
        t('common.error'),
        (error instanceof Error && error.message) || t('game.ui.submitGuessesFailed'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalizeAndNextRound = async () => {
    try {
      setIsFinalizing(true);
      await finalizeGuessingPhase();
      await playSound('roundComplete');
      try {
        await startNextRound();
      } catch {
        // game finished — no more rounds
      }
    } catch (error) {
      showAlert(
        t('common.error'),
        (error instanceof Error && error.message) || t('game.ui.finishAndStartNextRoundFailed'),
      );
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleFinalizeOnly = async () => {
    try {
      setIsFinalizing(true);
      await finalizeGuessingPhase();
      await playSound('gameOver');
    } catch (error) {
      showAlert(
        t('common.error'),
        (error instanceof Error && error.message) || t('game.ui.finalizeGuessingFailed'),
      );
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleForceFinalize = () => {
    const handler = singleTargetId ? handleFinalizeAndNextRound : handleFinalizeOnly;
    showAlert(
      t('game.ui.forceFinalizeTitle'),
      t('game.ui.forceFinalizeMessage'),
      [
        { text: t('common.cancel'), onPress: () => {}, style: 'secondary' },
        { text: t('game.ui.finalizeAnyway'), onPress: () => void handler(), style: 'primary' },
      ],
    );
  };

  const playerResult = game.guessResults?.[user?.uid ?? ''];

  return (
    <>
      {AlertModal}

      {/* Guess Result Modal */}
      {guessResultModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl max-h-[80vh] flex flex-col">
            <h2 className="text-lg font-semibold text-center mb-4 text-gray-900 dark:text-white">
              {t('game.ui.guessResultsTitle')}
            </h2>
            <div className="overflow-y-auto flex-1 space-y-3 mb-4">
              {guessResultModal.map((result, idx) => (
                <div
                  key={idx}
                  className={`border rounded-xl p-4 ${
                    result.correct
                      ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                      : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                  }`}
                >
                  <p className={`text-sm font-bold mb-2 ${result.correct ? 'text-green-600' : 'text-red-500'}`}>
                    {result.correct ? t('game.ui.correct') : t('game.ui.incorrect')}
                  </p>
                  <p className="text-sm italic text-gray-700 dark:text-gray-300 mb-3">
                    "{result.commentText}"
                  </p>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{t('game.ui.actualAuthor')}: <span className={`font-semibold ${result.correct ? 'text-green-600' : 'text-red-500'}`}>{result.actualAuthorName}</span></span>
                    <span>{t('game.ui.yourGuess')}: <span className="font-semibold text-gray-700 dark:text-gray-300">{result.guessedAuthorName}</span></span>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setGuessResultModal(null)}
              className="w-full bg-game-blue text-white py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity"
            >
              {t('common.ok')}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border-2 border-game-purple">
          <h2 className="text-xl font-bold mb-1 text-game-purple text-center">
            {t('game.ui.guessAuthorsTitle')}
          </h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-4">
            {singleTargetId
              ? t('game.ui.guessingCommentsAbout', {
                  name: game.participants.find(p => p.userId === singleTargetId)?.userName ?? '',
                })
              : t('game.ui.guessAuthorsSubtitle')}
          </p>

          {/* Player guessing UI */}
          {hasSubmitted ? (
            <div className="bg-game-purple/10 border border-game-purple rounded-lg p-4 text-center">
              {playerResult ? (
                <div>
                  <p className="text-game-purple font-semibold text-lg mb-1">
                    {t('game.ui.guessResultsHeader')}
                  </p>
                  <p className="text-gray-700 dark:text-gray-300">
                    {t('game.ui.guessCorrectCount', {
                      correct: playerResult.correctGuesses ?? 0,
                      total: commentsForPlayer.length,
                    })}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t('game.ui.guessPointsEarned', { points: playerResult.correctGuesses ?? 0 })}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-2xl mb-2">✅</p>
                  <p className="text-game-purple font-semibold">{t('game.ui.guessResultsTitle')}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {t('game.ui.waitingForAdminToComplete')}
                  </p>
                </div>
              )}
            </div>
          ) : commentsForPlayer.length > 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('game.ui.guessingInstructions')}
              </p>
              {commentsForPlayer.map(comment => (
                <div key={comment.id} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <p className="text-gray-900 dark:text-white mb-3 italic">"{comment.text}"</p>
                  <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">
                    {t('game.ui.guessPrompt')}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {possibleAuthors.map(author => (
                      <button
                        key={author.userId}
                        type="button"
                        onClick={() => handleSelect(comment.id, author.userId)}
                        className={`px-3 py-1.5 rounded-full border-2 font-semibold text-sm transition-all ${
                          selections[comment.id] === author.userId
                            ? 'bg-game-blue border-game-blue text-white'
                            : 'bg-white dark:bg-gray-600 border-gray-300 dark:border-gray-500 text-gray-900 dark:text-white hover:border-game-blue'
                        }`}
                      >
                        {author.userName}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {!allCommentsSelected && (
                <p className="text-center text-sm text-gray-400">
                  {t('game.alerts.selectAuthorForEachCommentToEnableSubmit')}
                </p>
              )}
              <button
                type="button"
                onClick={handleSubmitGuesses}
                disabled={isSubmitting || loading || !allCommentsSelected}
                className="w-full bg-game-purple text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {isSubmitting ? t('common.loading') : t('game.ui.submitGuesses')}
              </button>
            </div>
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 py-4">
              {t('game.ui.waitingForAdminToStartGuessing')}
            </p>
          )}

          {/* Admin controls */}
          {isAdmin && (
            <div className="mt-6 flex justify-center">
              {singleTargetId && targetSubmitted ? (
                <button
                  type="button"
                  onClick={handleFinalizeAndNextRound}
                  disabled={isFinalizing || loading}
                  className="bg-game-green text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isFinalizing ? t('common.loading') : t('game.ui.nextRound')}
                </button>
              ) : guessingData.allPlayersSubmitted ? (
                <button
                  type="button"
                  onClick={handleFinalizeOnly}
                  disabled={isFinalizing || loading}
                  className="bg-game-green text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isFinalizing ? t('common.loading') : t('game.ui.finalize')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleForceFinalize}
                  disabled={isFinalizing || loading}
                  className="bg-game-neutral text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isFinalizing ? t('common.loading') : t('game.ui.finalize')}
                </button>
              )}
            </div>
          )}
        </div>

        <PostGuessingPointsPanel game={game} />

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
