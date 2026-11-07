import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AdminRoundTools } from '@/components/game/AdminRoundTools';
import { ShowFancyAlertFn } from '@/components/game/GameHeader';
import { gameStyles } from '@/components/game/gameStyles';
import { ClashScoreboard } from './ClashScoreboard';
import { Fonts, GameColors, StatusColors } from '@/constants/theme';
import type { Game, ClashComment, ClashGuess } from '@/contexts/GameContext';
import { useGame } from '@/contexts/GameContext';
import { useSound } from '@/contexts/SoundContext';
import { t } from '@/i18n';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ScrollIntoView } from '@/components/ui/scrollIntoView';
import { SCROLL_INSETS } from '@/constants/scroll';
import { usePulseBorderOnChange } from '@/hooks/usePulseBorderOnChange';
import { getClashLeader } from '@/utils/clashSchedule';

interface Props {
  game: Game;
  user: { uid: string } | null;
  isAdmin: boolean;
  locale: string;
  isDark: boolean;
  getDisplayName: (name: string) => string;
  showFancyAlert?: ShowFancyAlertFn;
  showFaceMessage?: (message: string, face?: string) => void;
}

type CardPhase = 'idle' | 'subject_picking' | 'correct' | 'wrong' | 'author_picking' | 'done';

export const ClashGuessingPhase: React.FC<Props> = ({
  game, user, isAdmin, locale, getDisplayName, showFancyAlert,
}) => {
  const { submitClashGuess, submitClashAuthorGuess, advanceClashGuessing, restartClashRound, skipClashRound } = useGame();
  const { playSound } = useSound();

  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [cardPhases, setCardPhases] = useState<Record<string, CardPhase>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  const playerPulse = usePulseBorderOnChange(
    `${game.clashData?.currentRoundIndex ?? 0}:${game.clashData?.currentGuessingGroup ?? 'none'}`,
    GameColors.danger,
  );
  const adminPulse = usePulseBorderOnChange(
    `${game.clashData?.currentRoundIndex ?? 0}:${game.clashData?.currentGuessingGroup ?? 'none'}`,
    GameColors.danger,
  );

  if (!game.clashData) return null;
  const cd = game.clashData;
  const { currentRoundIndex, teamScores } = cd;
  const totalRounds = cd.schedule.length;
  const uid = user?.uid ?? '';
  const currentGroup = cd.currentGuessingGroup!;
  const activeLeaderId = getClashLeader(currentGroup === 'a' ? cd.groupA : cd.groupB, currentRoundIndex);
  const isActiveLeader = uid === activeLeaderId;

  const activeLeaderParticipant = game.participants.find(p => p.userId === activeLeaderId);
  const activeLeaderName = activeLeaderParticipant ? getDisplayName(activeLeaderParticipant.userName) : '?';

  // Comments written BY the opposite group (which the active leader guesses about)
  const commentsToGuess: ClashComment[] = currentGroup === 'a' ? cd.currentRoundCommentsB : cd.currentRoundCommentsA;
  // Own group members (subjects to pick from)
  const ownGroupIds = currentGroup === 'a' ? cd.groupA.memberIds : cd.groupB.memberIds;
  // Opposite group members (authors to pick from)
  const oppositeGroupIds = currentGroup === 'a' ? cd.groupB.memberIds : cd.groupA.memberIds;

  const existingGuesses: ClashGuess[] = currentGroup === 'a' ? cd.currentRoundGuessesA : cd.currentRoundGuessesB;

  const isLastRound = currentRoundIndex + 1 >= totalRounds;
  const otherGroup: 'a' | 'b' = currentGroup === 'a' ? 'b' : 'a';
  const otherGuessCount = otherGroup === 'a' ? cd.currentRoundGuessesA.length : cd.currentRoundGuessesB.length;
  const otherCommentCount = otherGroup === 'a' ? cd.currentRoundCommentsB.length : cd.currentRoundCommentsA.length;
  const otherGroupDone = otherCommentCount > 0 && otherGuessCount >= otherCommentCount;

  // Every comment must be fully resolved: either the subject was wrong, or the author has been guessed
  const currentGroupDone = commentsToGuess.length > 0 && commentsToGuess.every(c => {
    const guess = existingGuesses.find(g => g.commentWriterId === c.writerId);
    return guess !== undefined && (!guess.subjectCorrect || guess.guessedAuthorId !== undefined);
  });

  const advanceLabel = otherGroupDone
    ? (isLastRound ? t('game.ui.clash.finishGame', { locale }) : t('game.ui.clash.nextRound', { locale }))
    : t('game.ui.clash.nextLeader', { locale });

  const getCardPhase = (writerId: string): CardPhase => {
    const local = cardPhases[writerId];
    if (local) return local;
    const existing = existingGuesses.find(g => g.commentWriterId === writerId);
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

  const handleSubjectSelect = async (commentWriterId: string, guessedSubjectId: string) => {
    if (isSubmitting) return;
    const comment = commentsToGuess.find(c => c.writerId === commentWriterId);
    if (!comment) return;
    const correct = comment.subjectId === guessedSubjectId;
    try {
      setIsSubmitting(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await submitClashGuess(commentWriterId, guessedSubjectId);
      setCardPhases(p => ({ ...p, [commentWriterId]: correct ? 'correct' : 'wrong' }));
      if (correct) {
        await playSound('correctGuess');
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await playSound('wrongGuess');
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: unknown) {
      await playSound('error');
      showFancyAlert?.(t('common.error', { locale }), (err instanceof Error && err.message) || t('common.error', { locale }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmSubjectSelect = (commentWriterId: string, guessedSubjectId: string, displayName: string) => {
    showFancyAlert?.(
      t('game.alerts.confirmTitle', { locale }),
      t('game.ui.clash.confirmSubjectGuess', { locale, name: displayName }),
      [
        { text: t('common.cancel', { locale }), style: 'cancel' },
        { text: t('common.yes', { locale }), onPress: async () => { await handleSubjectSelect(commentWriterId, guessedSubjectId); } },
      ]
    );
  };

  const handleAuthorSelect = async (commentWriterId: string, guessedAuthorId: string) => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await submitClashAuthorGuess(commentWriterId, guessedAuthorId);
      setCardPhases(p => ({ ...p, [commentWriterId]: 'done' }));
      await playSound('success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      await playSound('error');
      showFancyAlert?.(t('common.error', { locale }), (err instanceof Error && err.message) || t('common.error', { locale }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmAuthorSelect = (commentWriterId: string, guessedAuthorId: string, displayName: string) => {
    showFancyAlert?.(
      t('game.alerts.confirmTitle', { locale }),
      t('game.ui.clash.confirmAuthorGuess', { locale, name: displayName }),
      [
        { text: t('common.cancel', { locale }), style: 'cancel' },
        { text: t('common.yes', { locale }), onPress: async () => { await handleAuthorSelect(commentWriterId, guessedAuthorId); } },
      ]
    );
  };

  const handleAdvance = async () => {
    if (isAdvancing) return;
    try {
      setIsAdvancing(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await advanceClashGuessing();
      // The game status change will unmount this component — keep post-advance
      // effects fire-and-forget so they can't surface as errors to the catch block.
      playSound(isLastRound && otherGroupDone ? 'gameOver' : 'roundComplete').catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: unknown) {
      if (!isMounted.current) return;
      playSound('error').catch(() => {});
      showFancyAlert?.(t('common.error', { locale }), (err instanceof Error && err.message) || t('common.error', { locale }));
    } finally {
      if (isMounted.current) setIsAdvancing(false);
    }
  };

  return (
    <View style={styles.phaseWrapper}>
      <View style={styles.statusRow}>
        <ThemedText style={gameStyles.statusLabel}>{t('game.ui.statusLabel', { locale })}</ThemedText>
        <View style={[gameStyles.statusBadge, { backgroundColor: StatusColors.clash_guessing }]}>
          <ThemedText style={gameStyles.statusText}>
            {t('game.ui.clash.round', { locale, current: currentRoundIndex + 1, total: totalRounds })}
          </ThemedText>
        </View>
      </View>

      <ClashScoreboard scoreA={teamScores.a} scoreB={teamScores.b} locale={locale} />

      <View style={gameStyles.gameFlowContainer}>
        <ScrollIntoView
          enabled
          scrollIntoViewKey={`${currentRoundIndex}:${currentGroup}:${isActiveLeader}`}
          align="top"
          animated
          insets={SCROLL_INSETS}
        >
        <Animated.View style={playerPulse}>
        {!isActiveLeader ? (
          <View style={styles.waitingCard}>
            <ThemedText style={styles.waitingText}>
              {t('game.ui.clash.leaderGuessing', { locale, name: activeLeaderName })}
            </ThemedText>
          </View>
        ) : (
          <View>
            {commentsToGuess.map(comment => {
              const phase = getCardPhase(comment.writerId);
              return (
                <View key={comment.writerId} style={styles.commentBlock}>
                  <TouchableOpacity
                    style={[styles.commentCard, phase === 'wrong' && styles.commentCardWrong, (phase === 'done' || phase === 'correct') && styles.commentCardCorrect]}
                    onPress={() => handleCardPress(comment.writerId)}
                    disabled={phase !== 'idle' || isSubmitting}
                    activeOpacity={0.8}
                  >
                    <ThemedText style={styles.commentText}>{comment.text}</ThemedText>
                  </TouchableOpacity>

                  {phase === 'subject_picking' && (
                    <View style={styles.pickerSection}>
                      <ThemedText style={styles.pickerLabel}>{t('game.ui.clash.whichMember', { locale })}</ThemedText>
                      {ownGroupIds.map(memberId => {
                        const p = game.participants.find(p => p.userId === memberId);
                        const name = p ? getDisplayName(p.userName) : memberId;
                        return (
                          <TouchableOpacity
                            key={memberId}
                            style={styles.choiceCard}
                            onPress={() => confirmSubjectSelect(comment.writerId, memberId, name)}
                            disabled={isSubmitting}
                            activeOpacity={0.8}
                          >
                            <ThemedText style={styles.choiceName}>{name}</ThemedText>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  {phase === 'wrong' && (
                    <ThemedText style={styles.wrongText}>{t('game.ui.clash.wrong', { locale })}</ThemedText>
                  )}

                  {phase === 'correct' && (
                    <View style={styles.pickerSection}>
                      <ThemedText style={styles.correctText}>{t('game.ui.clash.correct', { locale })}</ThemedText>
                      <ThemedText style={styles.pickerLabel}>{t('game.ui.clash.whoWroteIt', { locale })}</ThemedText>
                      {oppositeGroupIds.map(authorId => {
                        const p = game.participants.find(p => p.userId === authorId);
                        const name = p ? getDisplayName(p.userName) : authorId;
                        return (
                          <TouchableOpacity
                            key={authorId}
                            style={styles.choiceCard}
                            onPress={() => confirmAuthorSelect(comment.writerId, authorId, name)}
                            disabled={isSubmitting}
                            activeOpacity={0.8}
                          >
                            <ThemedText style={styles.choiceName}>{name}</ThemedText>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  {phase === 'done' && (
                    <ThemedText style={styles.doneText}>{t('game.ui.clash.correctAuthor', { locale })}</ThemedText>
                  )}
                </View>
              );
            })}
            {isSubmitting && <ActivityIndicator style={{ marginTop: 8 }} color={GameColors.blue} />}
          </View>
        )}
        </Animated.View>
        </ScrollIntoView>

        {isAdmin && (
          <ScrollIntoView
            enabled
            scrollIntoViewKey={`${currentRoundIndex}:${currentGroup}:${currentGroupDone}`}
            align="center"
            animated
            insets={SCROLL_INSETS}
          >
          <Animated.View style={[styles.adminSection, adminPulse]}>
            <TouchableOpacity
              style={[styles.wideButton, { backgroundColor: otherGroupDone && isLastRound ? GameColors.green : GameColors.blue, shadowColor: GameColors.shadow }, (isAdvancing || !currentGroupDone) && gameStyles.buttonDisabled]}
              onPress={handleAdvance}
              disabled={isAdvancing || !currentGroupDone}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              {isAdvancing
                ? <ActivityIndicator size="small" color={GameColors.white} />
                : <IconSymbol name={otherGroupDone && isLastRound ? 'flag.checkered' : 'forward.end.fill'} size={16} color={GameColors.white} />}
              <ThemedText style={styles.wideButtonText}>{advanceLabel}</ThemedText>
            </TouchableOpacity>
          </Animated.View>
          </ScrollIntoView>
        )}
        <AdminRoundTools
          isAdmin={isAdmin}
          locale={locale}
          showFancyAlert={showFancyAlert}
          onRestart={restartClashRound}
          onSkip={skipClashRound}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  phaseWrapper: { backgroundColor: 'rgba(255,80,0,0.06)', borderWidth: 1, borderColor: 'rgba(255,80,0,0.15)', borderRadius: 16, padding: 16, marginBottom: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  commentBlock: { marginBottom: 12 },
  commentCard: { padding: 16, borderRadius: 8, backgroundColor: GameColors.cardBg, borderWidth: 1, borderColor: GameColors.cardBorder, ...Platform.select({ ios: { shadowColor: GameColors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4 }, android: { elevation: 2 } }) },
  commentCardCorrect: { borderColor: GameColors.correct, borderWidth: 2 },
  commentCardWrong: { borderColor: GameColors.incorrect, borderWidth: 2, opacity: 0.6 },
  commentText: { fontSize: 16, lineHeight: 22, fontFamily: Fonts.sans },
  pickerSection: { marginTop: 8, gap: 6 },
  pickerLabel: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.sans, marginBottom: 4 },
  choiceCard: { padding: 12, borderRadius: 8, backgroundColor: GameColors.cardBg, borderWidth: 1, borderColor: GameColors.cardBorder },
  choiceName: { fontSize: 15, fontWeight: '500', fontFamily: Fonts.sans },
  correctText: { color: GameColors.correct, fontWeight: '700', fontSize: 14, fontFamily: Fonts.sans },
  wrongText: { color: GameColors.incorrect, fontWeight: '700', fontSize: 14, fontFamily: Fonts.sans, marginTop: 4 },
  doneText: { color: GameColors.correct, fontWeight: '700', fontSize: 14, fontFamily: Fonts.sans, marginTop: 4 },
  waitingCard: { padding: 24, borderRadius: 8, backgroundColor: GameColors.cardBg, alignItems: 'center' },
  waitingText: { textAlign: 'center', opacity: 0.7, fontSize: 16, fontFamily: Fonts.sans },
  adminSection: { marginTop: 24, alignItems: 'center' },
  wideButton: { flexDirection: 'row', borderRadius: 999, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', gap: 8, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  wideButtonText: { color: GameColors.white, fontWeight: '600', fontSize: 15, fontFamily: Fonts.sans },
});
