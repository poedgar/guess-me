import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ShowFancyAlertFn } from '@/components/game/GameHeader';
import { gameStyles } from '@/components/game/gameStyles';
import { Fonts, GameColors, StatusColors, themedInput } from '@/constants/theme';
import type { Game } from '@/contexts/GameContext';
import type { BasketAssignment } from '@/utils/basketSchedule';
import { useGame } from '@/contexts/GameContext';
import { useSound } from '@/contexts/SoundContext';
import { t } from '@/i18n';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { ScrollIntoView } from 'react-native-scroll-into-view';
import { SCROLL_INSETS } from '@/constants/scroll';
import { usePulseBorderOnChange } from '@/hooks/usePulseBorderOnChange';

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

export const BasketWritingPhase: React.FC<Props> = ({
  game, user, isAdmin, locale, isDark, getDisplayName, showFancyAlert,
}) => {
  const { submitBasketComment, revealBasketComments } = useGame();
  const { playSound } = useSound();
  const inputTheme = themedInput(isDark);

  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  const [commentText, setCommentText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);

  const { schedule, currentRoundIndex, currentRoundComments } = game.basketData!;
  const totalRounds = schedule.length;
  const currentRound = schedule[currentRoundIndex];
  const myAssignment = currentRound?.assignments.find((a: BasketAssignment) => a.writerId === user?.uid);
  const subjectParticipant = game.participants.find(p => p.userId === myAssignment?.subjectId);
  const subjectName = subjectParticipant ? getDisplayName(subjectParticipant.userName) : '?';
  const alreadySubmitted = submitted || currentRoundComments.some(c => c.writerId === user?.uid);
  const submittedCount = currentRoundComments.length;
  const totalCount = currentRound?.assignments.length ?? 0;

  const playerPulse = usePulseBorderOnChange(`${currentRoundIndex}:${alreadySubmitted}`, GameColors.blue);
  const adminPulse = usePulseBorderOnChange(`${currentRoundIndex}:${submittedCount >= totalCount}`, GameColors.blue);

  const handleSubmit = async () => {
    if (!commentText.trim()) return;
    try {
      setIsSubmitting(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await submitBasketComment(commentText.trim());
      setSubmitted(true);
      setCommentText('');
      await playSound('success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert?.(t('common.error', { locale }), (err instanceof Error && err.message) || t('common.error', { locale }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReveal = async () => {
    try {
      setIsRevealing(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await revealBasketComments();
      playSound('success').catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: unknown) {
      if (!isMounted.current) return;
      playSound('error').catch(() => {});
      showFancyAlert?.(t('common.error', { locale }), (err instanceof Error && err.message) || t('common.error', { locale }));
    } finally {
      if (isMounted.current) setIsRevealing(false);
    }
  };

  return (
    <View style={styles.phaseWrapper}>
      <View style={styles.statusRow}>
        <ThemedText style={gameStyles.statusLabel}>{t('game.ui.statusLabel', { locale })}</ThemedText>
        <View style={[gameStyles.statusBadge, { backgroundColor: StatusColors.basket_writing }]}>
          <ThemedText style={gameStyles.statusText}>
            {t('game.ui.basket.round', { locale, current: currentRoundIndex + 1, total: totalRounds })}
          </ThemedText>
        </View>
      </View>

      <View style={gameStyles.gameFlowContainer}>
        <ScrollIntoView
          enabled
          scrollIntoViewKey={`${currentRoundIndex}:${alreadySubmitted}`}
          align="center"
          animated
          insets={SCROLL_INSETS}
        >
        <Animated.View style={playerPulse}>
        {alreadySubmitted ? (
          <View style={styles.waitingCard}>
            <ThemedText style={styles.waitingText}>
              {t('game.ui.basket.waitingForOthers', { locale, count: submittedCount, total: totalCount })}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.writeSection}>
            <View style={styles.subjectCard}>
              <ThemedText style={styles.subjectLabel}>{t('game.ui.basket.yourSubject', { locale })}</ThemedText>
              <ThemedText style={styles.subjectName}>{subjectName}</ThemedText>
            </View>
            <TextInput
              style={[styles.input, inputTheme.style]}
              value={commentText}
              onChangeText={setCommentText}
              placeholder={t('game.ui.basket.writeComment', { locale })}
              placeholderTextColor={inputTheme.placeholderTextColor}
              multiline
              numberOfLines={4}
              maxLength={500}
              textAlignVertical="top"
            />
            <ThemedText style={[styles.charCounter, commentText.length >= 450 && styles.charCounterWarn]}>
              {commentText.length}/500
            </ThemedText>
            <TouchableOpacity
              style={[
                styles.wideButton,
                { backgroundColor: GameColors.blue, shadowColor: GameColors.shadow },
                (!commentText.trim() || isSubmitting) && gameStyles.buttonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!commentText.trim() || isSubmitting}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              {isSubmitting
                ? <ActivityIndicator size="small" color={GameColors.white} />
                : <IconSymbol name="paperplane.fill" size={16} color={GameColors.white} />}
              <ThemedText style={styles.wideButtonText}>{t('game.ui.basket.submit', { locale })}</ThemedText>
            </TouchableOpacity>
          </View>
        )}
        </Animated.View>
        </ScrollIntoView>

        {isAdmin && (
          <ScrollIntoView
            enabled
            scrollIntoViewKey={`${currentRoundIndex}:${submittedCount >= totalCount}`}
            align="center"
            animated
            insets={SCROLL_INSETS}
          >
          <Animated.View style={[styles.adminSection, adminPulse]}>
            <ThemedText style={styles.adminCount}>{submittedCount}/{totalCount}</ThemedText>
            <TouchableOpacity
              style={[
                styles.wideButton,
                { backgroundColor: GameColors.admin, shadowColor: GameColors.shadow },
                (isRevealing || submittedCount < totalCount) && gameStyles.buttonDisabled,
              ]}
              onPress={handleReveal}
              disabled={isRevealing || submittedCount < totalCount}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              {isRevealing
                ? <ActivityIndicator size="small" color={GameColors.white} />
                : <IconSymbol name="eye.fill" size={16} color={GameColors.white} />}
              <ThemedText style={styles.wideButtonText}>{t('game.ui.basket.revealComments', { locale })}</ThemedText>
            </TouchableOpacity>
          </Animated.View>
          </ScrollIntoView>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  phaseWrapper: {
    backgroundColor: 'rgba(0,122,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  writeSection: { gap: 8 },
  subjectCard: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: GameColors.cardBg,
    marginBottom: 8,
    alignItems: 'center',
  },
  subjectLabel: { fontSize: 13, opacity: 0.6, marginBottom: 4, fontFamily: Fonts.sans },
  subjectName: { fontSize: 22, fontWeight: '700', fontFamily: Fonts.sans },
  input: {
    minHeight: 100,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 4,
    borderWidth: 1,
    textAlignVertical: 'top',
    fontFamily: Fonts.sans,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  charCounter: { fontSize: 12, opacity: 0.5, textAlign: 'right', marginBottom: 8, fontFamily: Fonts.sans },
  charCounterWarn: { opacity: 1, color: '#e53935' },
  wideButton: {
    flexDirection: 'row',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 8,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  wideButtonText: { color: GameColors.white, fontWeight: '600', fontSize: 15, fontFamily: Fonts.sans },
  waitingCard: {
    padding: 24,
    borderRadius: 8,
    backgroundColor: GameColors.cardBg,
    alignItems: 'center',
  },
  waitingText: { textAlign: 'center', opacity: 0.7, fontSize: 16, fontFamily: Fonts.sans },
  adminSection: { marginTop: 24, alignItems: 'center', gap: 6 },
  adminCount: { fontSize: 13, opacity: 0.6, fontFamily: Fonts.sans },
});
