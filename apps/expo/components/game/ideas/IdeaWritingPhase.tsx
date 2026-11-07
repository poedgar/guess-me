import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ShowFancyAlertFn } from '@/components/game/GameHeader';
import { gameStyles } from '@/components/game/gameStyles';
import { Fonts, GameColors, themedInput } from '@/constants/theme';
import type { Game } from '@/contexts/GameContext';
import { useGame } from '@/contexts/GameContext';
import { useSound } from '@/contexts/SoundContext';
import { t } from '@/i18n';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

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

export const IdeaWritingPhase: React.FC<Props> = ({
  game, user, isAdmin, locale, isDark, showFancyAlert,
}) => {
  const { submitIdea, startIdeaRatingRounds } = useGame();
  const { playSound } = useSound();
  const inputTheme = themedInput(isDark);

  const [ideaText, setIdeaText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const ideaData = game.ideaData!;
  const myIdeas = ideaData.ideas.filter(i => i.authorId === user?.uid);

  const eligibleWriterIds = (game.adminWritesComments ?? false)
    ? game.participants.map(p => p.userId)
    : game.participants.filter(p => p.userId !== game.adminId).map(p => p.userId);
  const authorIdsWithIdeas = new Set(ideaData.ideas.map(i => i.authorId));
  const submittedCount = eligibleWriterIds.filter(id => authorIdsWithIdeas.has(id)).length;
  const allSubmitted = submittedCount >= eligibleWriterIds.length;

  const confirmSubmit = () => {
    if (!ideaText.trim()) return;
    showFancyAlert?.(
      t('game.alerts.confirmTitle', { locale }),
      t('game.ui.ideas.confirmSubmitIdea', { locale }),
      [
        { text: t('common.cancel', { locale }), style: 'cancel' },
        { text: t('common.yes', { locale }), onPress: async () => { await handleSubmit(); } },
      ],
    );
  };

  const handleSubmit = async () => {
    if (!ideaText.trim() || isSubmitting) return;
    try {
      setIsSubmitting(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await submitIdea(ideaText.trim());
      setIdeaText('');
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

  const handleStartRating = async () => {
    try {
      setIsStarting(true);
      await playSound('gameStart');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await startIdeaRatingRounds();
      await playSound('success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      await playSound('error');
      showFancyAlert?.(t('common.error', { locale }), (err instanceof Error && err.message) || t('common.error', { locale }));
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <View style={styles.phaseWrapper}>
      {myIdeas.length > 0 && (
        <View style={styles.myIdeasSection}>
          <ThemedText style={styles.myIdeasLabel}>{t('game.ui.ideas.yourIdeas', { locale })}</ThemedText>
          {myIdeas.map(idea => (
            <View key={idea.id} style={styles.ideaCard}>
              <ThemedText style={styles.ideaCardText}>{idea.text}</ThemedText>
            </View>
          ))}
        </View>
      )}

      <TextInput
        style={[styles.input, inputTheme.style]}
        value={ideaText}
        onChangeText={setIdeaText}
        placeholder={t('game.ui.ideas.writeIdea', { locale })}
        placeholderTextColor={inputTheme.placeholderTextColor}
        multiline
        numberOfLines={3}
        maxLength={500}
        textAlignVertical="top"
      />
      <ThemedText style={[styles.charCounter, ideaText.length >= 450 && styles.charCounterWarn]}>
        {ideaText.length}/500
      </ThemedText>
      <TouchableOpacity
        style={[
          styles.wideButton,
          { backgroundColor: GameColors.blue, shadowColor: GameColors.shadow },
          (!ideaText.trim() || isSubmitting) && gameStyles.buttonDisabled,
        ]}
        onPress={confirmSubmit}
        disabled={!ideaText.trim() || isSubmitting}
        activeOpacity={0.8}
        accessibilityRole="button"
      >
        {isSubmitting
          ? <ActivityIndicator size="small" color={GameColors.white} />
          : <IconSymbol name="plus.circle.fill" size={16} color={GameColors.white} />}
        <ThemedText style={styles.wideButtonText}>{t('game.ui.ideas.addIdea', { locale })}</ThemedText>
      </TouchableOpacity>

      <ThemedText style={styles.submittedCount}>
        {t('game.ui.ideas.submittedCount', { locale, count: submittedCount })}
      </ThemedText>

      {isAdmin && (
        <View style={styles.adminSection}>
          <TouchableOpacity
            style={[
              styles.wideButton,
              { backgroundColor: GameColors.admin, shadowColor: GameColors.shadow },
              (isStarting || !allSubmitted) && gameStyles.buttonDisabled,
            ]}
            onPress={handleStartRating}
            disabled={isStarting || !allSubmitted}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            {isStarting
              ? <ActivityIndicator size="small" color={GameColors.white} />
              : <IconSymbol name="star.fill" size={16} color={GameColors.white} />}
            <ThemedText style={styles.wideButtonText}>{t('game.ui.ideas.startRating', { locale })}</ThemedText>
          </TouchableOpacity>
        </View>
      )}
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
  myIdeasSection: { marginBottom: 12, gap: 6 },
  myIdeasLabel: { fontSize: 12, opacity: 0.6, textTransform: 'uppercase', fontFamily: Fonts.sans },
  ideaCard: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: GameColors.cardBg,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
      android: { elevation: 1 },
    }),
  },
  ideaCardText: { fontSize: 14, fontFamily: Fonts.sans },
  input: {
    minHeight: 90,
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
  charCounterWarn: { opacity: 1, color: '#A63D2A' },
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
  submittedCount: { textAlign: 'center', fontSize: 13, opacity: 0.6, marginTop: 8, fontFamily: Fonts.sans },
  adminSection: { marginTop: 20, alignItems: 'center' },
});
