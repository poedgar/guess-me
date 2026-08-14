import { useLanguage } from '../../../contexts/LanguageContext';
import React, { useState } from 'react';
import { Game, Comment } from '@mirror/shared';
import { useGame } from '../../../contexts/GameContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useSound } from '../../../contexts/SoundContext';
import { useAlert } from '../../../hooks/useAlert';
import { Leaderboard } from '../Leaderboard';
import { AdminRoundTools } from '../AdminRoundTools';
import { getPlayerNumber } from '../../../utils/playerNumbers';
import { getDisplayName } from '../../../utils/displayName';
import { useScrollIntoViewOnChange } from '../../../hooks/useScrollIntoViewOnChange';
import { PULSE_COLORS } from '../../../constants/pulseColors';


interface GuessingPhaseProps {
  game: Game;
}

export const GuessingPhase: React.FC<GuessingPhaseProps> = ({ game }) => {
  const { user } = useAuth();
  const { loading, submitGuess, markPlayerGuessesSubmitted, finalizeGuessingPhase, startNextRound, restartMirrorRound, skipMirrorRound } = useGame();
  const { playSound } = useSound();
  const { showAlert, AlertModal } = useAlert();
  const { t } = useLanguage();
  const [selections, setSelections] = useState<{ [commentId: string]: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [hasSubmittedLocal, setHasSubmittedLocal] = useState(false);

  // Hooks must run unconditionally on every render (Rules of Hooks), so these
  // are declared before the `!game.guessingData` early return below, with
  // null-safe trigger-key expressions. Not currently reachable given today's
  // Firestore write ordering, but kept safe against future ordering changes.
  const guessingData = game.guessingData;
  const singleTargetId = guessingData?.singleRoundTargetId;
  const hasSubmitted =
    hasSubmittedLocal ||
    (guessingData?.playersWhoSubmittedGuesses?.includes(user?.uid ?? '') ?? false);
  const commentsForPlayerCount =
    (guessingData?.commentsByTarget?.[user?.uid ?? ''] ?? []).length;
  const targetSubmitted = singleTargetId
    ? (guessingData?.playersWhoSubmittedGuesses?.includes(singleTargetId) ?? false)
    : false;

  // `commentsForPlayerCount > 0` is folded into the key so the 3-way branch
  // (submitted / has comments to guess / waiting for admin to start) is
  // fully represented, not just the has-submitted boundary.
  const playerScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${singleTargetId ?? 'legacy'}:${hasSubmitted}:${commentsForPlayerCount > 0}`,
    'start',
    PULSE_COLORS.purple,
  );
  const adminScrollRef = useScrollIntoViewOnChange<HTMLDivElement>(
    `${singleTargetId ?? 'legacy'}:${guessingData?.allPlayersSubmitted ?? false}:${targetSubmitted}`,
    'center',
    PULSE_COLORS.purple,
  );

  if (!game.guessingData) return null;

  const guessingDataResolved = game.guessingData;
  const isAdmin = user?.uid === game.adminId;
  const possibleAuthors = guessingDataResolved.possibleAuthors ?? [];

  const commentsForPlayer: Comment[] = guessingDataResolved.commentsByTarget?.[user?.uid ?? ''] ?? [];

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
      } catch (error) {
        // startNextRound() resolves normally (no throw) when the game
        // legitimately ends — a throw here is always a real failure
        // (e.g. network/Firestore error), so surface it rather than
        // swallowing it. ActivePhase shows a retry control for this state.
        showAlert(
          t('common.error'),
          (error instanceof Error && error.message) || t('game.alerts.startNextRoundFailed'),
        );
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
      <div className="space-y-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border-2 border-game-purple" data-cy="guessing-phase-info">
          <h2 className="text-xl font-bold mb-1 text-game-purple text-center">
            {t('game.ui.guessAuthorsTitle')}
          </h2>
          <p className="text-center text-gray-500 dark:text-gray-400 mb-4">
            {singleTargetId
              ? t('game.ui.guessingCommentsAbout', {
                  name: getDisplayName(
                    game.participants.find(p => p.userId === singleTargetId)?.userName ?? '',
                    game.showSurnames ?? false,
                  ),
                })
              : t('game.ui.guessAuthorsSubtitle')}
          </p>

          {/* Player guessing UI */}
          <div ref={playerScrollRef}>
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
                          data-cy="guess-author-button"
                          data-cy-author-id={author.userId}
                          className={`px-3 py-1.5 rounded-full border-2 font-semibold text-sm transition-all ${
                            selections[comment.id] === author.userId
                              ? 'bg-game-blue border-game-blue text-white'
                              : 'bg-white dark:bg-gray-600 border-gray-300 dark:border-gray-500 text-gray-900 dark:text-white hover:border-game-blue'
                          }`}
                        >
                          {getPlayerNumber(game, author.userId)}. {getDisplayName(author.userName, game.showSurnames ?? false)}
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
                  data-cy="submit-guesses-button"
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
          </div>

          {/* Admin controls */}
          {isAdmin && (
            <div className="mt-6 flex justify-center" ref={adminScrollRef}>
              {singleTargetId && targetSubmitted ? (
                <button
                  type="button"
                  onClick={handleFinalizeAndNextRound}
                  disabled={isFinalizing || loading}
                  data-cy="finalize-button"
                  className="bg-game-green text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isFinalizing ? t('common.loading') : t('game.ui.nextRound')}
                </button>
              ) : guessingDataResolved.allPlayersSubmitted ? (
                <button
                  type="button"
                  onClick={handleFinalizeOnly}
                  disabled={isFinalizing || loading}
                  data-cy="finalize-button"
                  className="bg-game-green text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isFinalizing ? t('common.loading') : t('game.ui.finalize')}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleForceFinalize}
                  disabled={isFinalizing || loading}
                  data-cy="finalize-button"
                  className="bg-game-neutral text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {isFinalizing ? t('common.loading') : t('game.ui.finalize')}
                </button>
              )}
              <AdminRoundTools isAdmin={isAdmin} onRestart={restartMirrorRound} onSkip={skipMirrorRound} />
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
      </div>
    </>
  );
};
