import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ShowFancyAlertFn } from '@/components/game/GameHeader';
import { gameStyles } from '@/components/game/gameStyles';
import { Fonts, GameColors, StatusColors, themedInput } from '@/constants/theme';
import type { Game, Idea } from '@/contexts/GameContext';
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

export const IdeaRatingPhase: React.FC<Props> = ({
  game, user, isAdmin, locale, isDark, showFancyAlert,
}) => {
  const { submitIdeaRating, startNextIdeaRound } = useGame();
  const { playSound } = useSound();
  const inputTheme = themedInput(isDark);

  const [selectedPoints, setSelectedPoints] = useState<Record<string, number>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [submittingIdeaId, setSubmittingIdeaId] = useState<string | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const ideaData = game.ideaData!;
  const { schedule, currentRoundIndex, currentRoundRatings, incognitoMode, ideas } = ideaData;
  const isLastRound = currentRoundIndex + 1 >= schedule.length;
  const currentAuthorId = schedule[currentRoundIndex];
  const currentIdeas = ideas.filter((i: Idea) => i.authorId === currentAuthorId);

  const raterId = user?.uid ?? '';
  const myRatingsThisRound = new Set(
    currentRoundRatings.filter(r => r.raterId === raterId).map(r => r.ideaId),
  );

  const eligibleRaterIds = (game.adminWritesComments ?? false)
    ? game.participants.map(p => p.userId)
    : game.participants.filter(p => p.userId !== game.adminId).map(p => p.userId);
  const isEligible = eligibleRaterIds.includes(raterId);
  const allRatersDone = eligibleRaterIds.every(id => {
    const ratedIdeaIds = new Set(currentRoundRatings.filter(r => r.raterId === id).map(r => r.ideaId));
    return currentIdeas.every(idea => ratedIdeaIds.has(idea.id));
  });

  const confirmSubmitRating = (ideaId: string) => {
    const points = selectedPoints[ideaId];
    if (points === undefined) return;
    showFancyAlert?.(
      t('game.alerts.confirmTitle', { locale }),
      t('game.ui.ideas.confirmSubmitRating', { locale }),
      [
        { text: t('common.cancel', { locale }), style: 'cancel' },
        { text: t('common.yes', { locale }), onPress: async () => { await handleSubmitRating(ideaId, points); } },
      ],
    );
  };

  const handleSubmitRating = async (ideaId: string, points: number) => {
    try {
      setSubmittingIdeaId(ideaId);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await submitIdeaRating(ideaId, points, commentDrafts[ideaId]);
      await playSound('points');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      await playSound('error');
      showFancyAlert?.(t('common.error', { locale }), (err instanceof Error && err.message) || t('common.error', { locale }));
    } finally {
      setSubmittingIdeaId(null);
    }
  };

  const handleNextRound = async () => {
    if (isAdvancing) return;
    try {
      setIsAdvancing(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await startNextIdeaRound();
      await playSound(isLastRound ? 'gameOver' : 'roundComplete');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: unknown) {
      playSound('error').catch(() => {});
      showFancyAlert?.(t('common.error', { locale }), (err instanceof Error && err.message) || t('common.error', { locale }));
    } finally {
      setIsAdvancing(false);
    }
  };

  return (
    <View style={styles.phaseWrapper}>
      <View style={styles.statusRow}>
        <ThemedText style={gameStyles.statusLabel}>{t('game.ui.statusLabel', { locale })}</ThemedText>
        <View style={[gameStyles.statusBadge, { backgroundColor: StatusColors.guessing_phase }]}>
          <ThemedText style={gameStyles.statusText}>
            {t('game.ui.ideas.round', { locale, current: currentRoundIndex + 1, total: schedule.length })}
          </ThemedText>
        </View>
      </View>

      {currentIdeas.map(idea => {
        const alreadyRated = myRatingsThisRound.has(idea.id);
        const comments = incognitoMode
          ? currentRoundRatings.filter(r => r.ideaId === idea.id && r.comment)
          : [];
        return (
          <View key={idea.id} style={styles.ideaCard}>
            <ThemedText style={styles.ideaText}>{idea.text}</ThemedText>

            {alreadyRated ? (
              <ThemedText style={styles.waitingText}>
                {t('game.ui.ideas.waitingForRatings', {
                  locale,
                  count: currentRoundRatings.filter(r => r.ideaId === idea.id).length,
                  total: eligibleRaterIds.length,
                })}
              </ThemedText>
            ) : isEligible ? (
              <>
                <ThemedText style={styles.pointsLabel}>{t('game.ui.ideas.pointsLabel', { locale })}</ThemedText>
                <View style={styles.pointsRow}>
                  {[0, 1, 2, 3, 4, 5].map(points => (
                    <TouchableOpacity
                      key={points}
                      style={[
                        styles.pointButton,
                        selectedPoints[idea.id] === points && styles.pointButtonSelected,
                      ]}
                      onPress={() => setSelectedPoints(prev => ({ ...prev, [idea.id]: points }))}
                      disabled={submittingIdeaId === idea.id}
                      activeOpacity={0.8}
                    >
                      <ThemedText style={[
                        styles.pointButtonText,
                        selectedPoints[idea.id] === points && styles.pointButtonTextSelected,
                      ]}>
                        {points}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
                {incognitoMode && (
                  <TextInput
                    style={[styles.commentInput, inputTheme.style]}
                    value={commentDrafts[idea.id] ?? ''}
                    onChangeText={text => setCommentDrafts(prev => ({ ...prev, [idea.id]: text }))}
                    placeholder={t('game.ui.ideas.commentPlaceholder', { locale })}
                    placeholderTextColor={inputTheme.placeholderTextColor}
                    multiline
                    numberOfLines={2}
                    maxLength={500}
                  />
                )}
                <TouchableOpacity
                  style={[
                    styles.wideButton,
                    { backgroundColor: GameColors.purple, shadowColor: GameColors.shadow },
                    (selectedPoints[idea.id] === undefined || submittingIdeaId === idea.id) && gameStyles.buttonDisabled,
                  ]}
                  onPress={() => confirmSubmitRating(idea.id)}
                  disabled={selectedPoints[idea.id] === undefined || submittingIdeaId === idea.id}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                >
                  {submittingIdeaId === idea.id
                    ? <ActivityIndicator size="small" color={GameColors.white} />
                    : <IconSymbol name="checkmark.circle.fill" size={16} color={GameColors.white} />}
                  <ThemedText style={styles.wideButtonText}>{t('game.ui.ideas.submitRating', { locale })}</ThemedText>
                </TouchableOpacity>
              </>
            ) : (
              <ThemedText style={styles.notEligibleText}>{t('game.ui.ideas.notEligibleToRate', { locale })}</ThemedText>
            )}

            {comments.length > 0 && (
              <View style={styles.commentsSection}>
                <ThemedText style={styles.commentsHeading}>{t('game.ui.ideas.commentsHeading', { locale })}</ThemedText>
                {comments.map((r, i) => (
                  <ThemedText key={i} style={styles.commentItem}>&ldquo;{r.comment}&rdquo;</ThemedText>
                ))}
              </View>
            )}
          </View>
        );
      })}

      {isAdmin && (
        <View style={styles.adminSection}>
          {isLastRound && (
            <ThemedText style={styles.finishLabel}>{t('game.ui.ideas.finishGame', { locale })}</ThemedText>
          )}
          <TouchableOpacity
            style={[
              styles.wideButton,
              { backgroundColor: isLastRound ? GameColors.green : GameColors.blue, shadowColor: GameColors.shadow },
              (isAdvancing || !allRatersDone) && gameStyles.buttonDisabled,
            ]}
            onPress={handleNextRound}
            disabled={isAdvancing || !allRatersDone}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            {isAdvancing
              ? <ActivityIndicator size="small" color={GameColors.white} />
              : <IconSymbol name={isLastRound ? 'flag.checkered' : 'forward.end.fill'} size={16} color={GameColors.white} />}
            <ThemedText style={styles.wideButtonText}>{t('game.ui.ideas.nextRound', { locale })}</ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  phaseWrapper: {
    backgroundColor: 'rgba(175,82,222,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(175,82,222,0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  ideaCard: {
    padding: 14,
    borderRadius: 8,
    backgroundColor: GameColors.cardBg,
    borderWidth: 1,
    borderColor: GameColors.cardBorder,
    marginBottom: 12,
    gap: 8,
    ...Platform.select({
      ios: { shadowColor: GameColors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  ideaText: { fontSize: 16, lineHeight: 22, fontFamily: Fonts.sans },
  waitingText: { fontSize: 14, color: GameColors.green, fontWeight: '600', fontFamily: Fonts.sans },
  notEligibleText: { fontSize: 13, opacity: 0.6, fontStyle: 'italic', fontFamily: Fonts.sans },
  pointsLabel: { fontSize: 12, opacity: 0.6, fontFamily: Fonts.sans },
  pointsRow: { flexDirection: 'row', gap: 8 },
  pointButton: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 2, borderColor: GameColors.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  pointButtonSelected: { backgroundColor: GameColors.blue, borderColor: GameColors.blue },
  pointButtonText: { fontSize: 15, fontWeight: '600', fontFamily: Fonts.sans },
  pointButtonTextSelected: { color: GameColors.white },
  commentInput: {
    minHeight: 60, borderRadius: 8, padding: 10, fontSize: 14,
    borderWidth: 1, textAlignVertical: 'top', fontFamily: Fonts.sans,
  },
  wideButton: {
    flexDirection: 'row', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 20,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', gap: 8,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  wideButtonText: { color: GameColors.white, fontWeight: '600', fontSize: 14, fontFamily: Fonts.sans },
  commentsSection: { marginTop: 4, gap: 2 },
  commentsHeading: { fontSize: 11, opacity: 0.5, fontFamily: Fonts.sans },
  commentItem: { fontSize: 13, opacity: 0.75, fontStyle: 'italic', fontFamily: Fonts.sans },
  adminSection: { marginTop: 8, alignItems: 'center', gap: 6 },
  finishLabel: { fontSize: 13, color: GameColors.green, fontWeight: '600', opacity: 0.85, fontFamily: Fonts.sans },
});
