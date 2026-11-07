import { ThemedText } from '@/components/themed-text';
import { FaceMessage } from '@/components/ui/FaceMessage';
import { SuccessAnimation } from '@/components/ui/SuccessAnimation';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts, GameColors, StatusColors, themedInput } from '@/constants/theme';
import { gameStyles } from '../gameStyles';
import { Comment, Game, Participant, useGame } from '@/contexts/GameContext';
import { useSound } from '@/contexts/SoundContext';
import { t } from '@/i18n';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ShowFancyAlertFn } from '../GameHeader';
import PostGuessingPointsPanel from './PostGuessingPointsPanel';
import { AdminRoundTools } from '@/components/game/AdminRoundTools';
import { ScrollIntoView } from '@/components/ui/scrollIntoView';
import { SCROLL_INSETS } from '@/constants/scroll';
import { usePulseBorderOnChange } from '@/hooks/usePulseBorderOnChange';

interface Props {
  game: Game;
  isAdmin: boolean;
  user: { uid: string } | null;
  participantsByJoin: Participant[];
  joinIndexById: Record<string, number>;
  playerNumbers?: Record<string, number>;
  getDisplayName: (name: string) => string;
  showFancyAlert: ShowFancyAlertFn;
  showFaceMessage: (message: string, face?: string) => void;
  locale: string;
  isDark: boolean;
}

export const ActivePhase: React.FC<Props> = ({
  game,
  isAdmin,
  user,
  participantsByJoin,
  joinIndexById,
  playerNumbers,
  getDisplayName,
  showFancyAlert,
  showFaceMessage,
  locale,
  isDark,
}) => {
  const { playSound } = useSound();
  const {
    loading,
    submitComment,
    showComments,
    awardCommentPoints,
    finishAwardingPoints,
    givePointsToTarget,
    startGuessingPhase,
    skipPostCommentPhase,
    startNextRound,
    restartMirrorRound,
    skipMirrorRound,
  } = useGame();

  const [isStartingNextRound, setIsStartingNextRound] = useState(false);

  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  const inputTheme = themedInput(isDark);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [givingPoints, setGivingPoints] = useState<Record<string, boolean>>({});
  const [givingPointsToTarget, setGivingPointsToTarget] = useState(false);
  const [faceMessage, setFaceMessage] = useState<{ visible: boolean; message: string; face?: string }>({
    visible: false,
    message: '',
    face: '😊',
  });

  // Mirrors expectedCommenters' filter logic below: everyone except the
  // round's target, and except the admin when adminWritesComments is off.
  const requiredComments = useMemo(() => {
    if (!game.currentRound) return 0;
    const targetUserId = game.currentRound.targetUserId;
    return game.participants.filter((p) => {
      if (p.userId === targetUserId) return false;
      if (p.userId === game.adminId && !game.adminWritesComments) return false;
      return true;
    }).length;
  }, [game.currentRound, game.adminId, game.adminWritesComments, game.participants]);

  const getMaxPoints = () => {
    // Maximum points is participants count minus 1 (excluding the target themselves)
    return Math.max(1, game.participants.length - 1);
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim()) {
      showFancyAlert(t('common.error', { locale }), t('game.alerts.commentEmpty', { locale }));
      return;
    }
    try {
      setIsSubmittingComment(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await submitComment(commentText.trim());
      setCommentText('');
      await playSound('success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: unknown) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), (error instanceof Error && error.message) || t('game.alerts.submitCommentFailed', { locale }));
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const doShowComments = async () => {
    try {
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await showComments();
      await playSound('success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: unknown) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), (error instanceof Error && error.message) || t('game.alerts.showCommentsFailed', { locale }));
    }
  };

  const handleShowComments = () => {
    const received = game.currentRound?.comments?.length ?? 0;
    if (received < requiredComments) {
      Alert.alert(
        t('game.ui.forceShowCommentsTitle', { locale }),
        t('game.ui.forceShowCommentsMessage', { locale, received, required: requiredComments }),
        [
          { text: t('common.cancel', { locale }), style: 'cancel' },
          { text: t('game.ui.showAnyway', { locale }), onPress: () => { void doShowComments(); } },
        ]
      );
      return;
    }
    void doShowComments();
  };

  const handleGivePoints = async (commentId: string, points: number) => {
    if (!awardCommentPoints) {
      showFancyAlert(t('common.error', { locale }), t('game.alerts.notImplemented', { locale }));
      return;
    }
    try {
      setGivingPoints(prev => ({ ...prev, [commentId]: true }));
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await awardCommentPoints(commentId, points);
      await playSound('points');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFaceMessage(
        t('game.alerts.pointsAwarded', { locale }), 
        <View style={{ padding: 16 }}><SuccessAnimation /></View>
      ); 
    } catch (error: unknown) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), (error instanceof Error && error.message) || t('game.alerts.pointsAwardFailed', { locale }));
    } finally {
      setGivingPoints(prev => ({ ...prev, [commentId]: false }));
    }
  };

  const handleFinishGivingPoints = async () => {
    if (!finishAwardingPoints) {
      showFancyAlert(t('common.error', { locale }), t('game.alerts.notImplemented', { locale }));
      return;
    }
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await finishAwardingPoints();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFaceMessage(
        t('game.alerts.finishPointsSuccess', { locale }), 
        <View style={{ padding: 16 }}><SuccessAnimation /></View>
      ); 
    } catch (error: unknown) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), (error instanceof Error && error.message) || t('game.alerts.finishPointsFailed', { locale }));
    }
  };

  const handleGivePointsToTargetWithConfirm = (points: number) => {
    const message = points === 0
      ? t('game.alerts.confirmSkipPoints', { locale })
      : t('game.alerts.confirmGivePoints', { locale, count: points });

    showFancyAlert(
      t('game.alerts.confirmTitle', { locale }),
      message,
      [
        { text: t('common.cancel', { locale }), style: 'cancel' },
        {
          text: t('common.yes', { locale }),
          onPress: async () => {
            await handleGivePointsToTarget(points);
          }
        },
      ]
    );
  };

  const handleGivePointsToTarget = async (points: number) => {
    if (!game.currentRound) return;
    if (!givePointsToTarget) {
      showFancyAlert(t('common.error', { locale }), t('game.alerts.notImplemented', { locale }));
      return;
    }
    try {
      setGivingPointsToTarget(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await givePointsToTarget(game.currentRound.targetUserId, points);

      showFaceMessage(
        points > 0
          ? t('game.alerts.pointsGivenToTarget', { locale, count: points, name: getDisplayName(game.currentRound.targetUserName) })
          : t('game.alerts.phaseSkipped', { locale }),
        <View style={{ padding: 16 }}><SuccessAnimation /></View>
      );    
    } catch (error: unknown) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), (error instanceof Error && error.message) || t('game.alerts.targetPointsAwardFailed', { locale }));
    } finally {
      setGivingPointsToTarget(false);
    }
  };

  const handleSkipPostCommentPhase = async () => {
    if (!skipPostCommentPhase) {
      showFancyAlert(t('common.error', { locale }), t('game.alerts.notImplemented', { locale }));
      return;
    }
    try {
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await skipPostCommentPhase();
      
      // Show face message instead of fancy alert
      setFaceMessage({
        visible: true,
        message: t('game.alerts.commentPhaseSkipped', { locale }),
        face: '🤷‍♂️',
      });
    } catch (error: unknown) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), (error instanceof Error && error.message) || t('game.alerts.skipPhaseFailed', { locale }));
    }
  };

  const doStartGuessingPhase = async () => {
    try {
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await startGuessingPhase();
      playSound('success').catch(() => {});
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error: unknown) {
      if (!isMounted.current) return;
      playSound('error').catch(() => {});
      showFancyAlert(t('common.error', { locale }), (error instanceof Error && error.message) || t('game.alerts.startGuessingPhaseFailed', { locale }));
    }
  };

  const handleStartGuessingPhase = () => {
    if (!isAdmin) return;
    if (!game.currentRound?.pointsGiven) {
      Alert.alert(
        t('game.ui.forceStartGuessingTitle', { locale }),
        t('game.ui.forceStartGuessingMessage', { locale }),
        [
          { text: t('common.cancel', { locale }), style: 'cancel' },
          { text: t('game.ui.startAnyway', { locale }), onPress: () => { void doStartGuessingPhase(); } },
        ]
      );
      return;
    }
    void doStartGuessingPhase();
  };

  const adminPulse = usePulseBorderOnChange(
    `${game.currentRound?.roundNumber ?? 'none'}:admin:${game.currentRound?.commentsVisible ?? false}`,
    GameColors.green,
  );
  const targetPulse = usePulseBorderOnChange(
    `${game.currentRound?.roundNumber ?? 'none'}:target:${game.currentRound?.commentsVisible ?? false}:${game.currentRound?.pointsGiven ?? false}`,
    GameColors.green,
  );
  const otherPulse = usePulseBorderOnChange(
    `${game.currentRound?.roundNumber ?? 'none'}:other:${game.currentRound?.commentsVisible ?? false}:${game.currentRound?.pointsGiven ?? false}`,
    GameColors.green,
  );

  const doStartNextRound = async () => {
    setIsStartingNextRound(true);
    try {
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await startNextRound();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error: unknown) {
      if (!isMounted.current) return;
      playSound('error').catch(() => {});
      showFancyAlert(t('common.error', { locale }), (error instanceof Error && error.message) || t('game.alerts.startNextRoundFailed', { locale }));
    } finally {
      if (isMounted.current) setIsStartingNextRound(false);
    }
  };

  if (!game.currentRound) {
    // The round transition between guessing and the next round is two
    // sequential awaits (finalizeGuessingPhase then startNextRound) — if
    // the second one fails (e.g. a network blip), the game is left here:
    // status 'active' with no currentRound. Give the admin a retry control
    // instead of leaving the game silently stuck.
    return (
      <View style={styles.phaseWrapper}>
        {isAdmin ? (
          <TouchableOpacity
            style={[
              styles.adminButton,
              { backgroundColor: GameColors.green, shadowColor: GameColors.shadow },
              isStartingNextRound && gameStyles.buttonDisabled,
            ]}
            onPress={doStartNextRound}
            disabled={isStartingNextRound}
            activeOpacity={0.8}
            accessibilityLabel={t('game.nextRound', { locale })}
            accessibilityRole="button"
          >
            {isStartingNextRound
              ? <ActivityIndicator size="small" color={GameColors.white} />
              : <IconSymbol name="forward.end.fill" size={16} color={GameColors.white} />}
            <ThemedText style={styles.buttonText}>{t('game.nextRound', { locale })}</ThemedText>
          </TouchableOpacity>
        ) : (
          <ThemedText style={styles.waitingText}>{t('game.waitingForAdmin', { locale })}</ThemedText>
        )}
      </View>
    );
  }

  const numbers = playerNumbers ?? joinIndexById;
  const expectedCommenters = game.participants.filter(p => {
    if (p.userId === game.currentRound!.targetUserId) return false;
    if (p.userId === game.adminId && !game.adminWritesComments) return false;
    return true;
  });
  const submittedAuthorIds = new Set(game.currentRound.comments?.map((c: Comment) => c.authorId) ?? []);
  const submittedCount = expectedCommenters.filter(p => submittedAuthorIds.has(p.userId)).length;

  return (
    <View style={styles.phaseWrapper}>
      {/* Status badge */}
      <View style={styles.gameStatusContainer}>
        <ThemedText style={gameStyles.statusLabel}>{t('game.ui.statusLabel', { locale })}</ThemedText>
        <View style={[gameStyles.statusBadge, { backgroundColor: StatusColors.active }]}>
          <ThemedText style={gameStyles.statusText}>
            {t('game.ui.statusActive', { locale })}
          </ThemedText>
        </View>
      </View>

      <View style={gameStyles.gameFlowContainer}>
        <View style={styles.roundInfo}>
          <ThemedText type="subtitle" style={styles.roundTitle}>
            {t('game.ui.round', { locale })} {game.currentRound.roundNumber}
          </ThemedText>
          <ThemedText style={styles.targetText}>
            {t('game.ui.target', { locale })}: {game.currentRound && joinIndexById[game.currentRound.targetUserId] ? `${joinIndexById[game.currentRound.targetUserId]}. ` : ''}{getDisplayName(game.currentRound.targetUserName)}
          </ThemedText>
        </View>

        {/* Admin controls */}
        {isAdmin && (
          <ScrollIntoView
            enabled
            scrollIntoViewKey={`${game.currentRound.roundNumber}:admin:${game.currentRound.commentsVisible}`}
            align="center"
            animated
            insets={SCROLL_INSETS}
          >
          <Animated.View style={[styles.adminControls, adminPulse]}>
            {!game.currentRound.commentsVisible && (
              <View style={styles.checklistContainer}>
                <ThemedText style={styles.checklistTitle}>
                  {t('game.ui.commentersStatusTitle', { locale })}
                </ThemedText>
                <ThemedText style={styles.checklistProgress}>
                  {t('game.ui.commentsProgress', { locale, received: submittedCount, required: expectedCommenters.length })}
                </ThemedText>
                {expectedCommenters.map(p => {
                  const hasSubmitted = submittedAuthorIds.has(p.userId);
                  return (
                    <View key={p.userId} style={styles.checklistRow}>
                      <ThemedText style={styles.checklistNumber}>
                        {numbers[p.userId] ? `${numbers[p.userId]}.` : ''}
                      </ThemedText>
                      <ThemedText style={styles.checklistName}>{getDisplayName(p.userName)}</ThemedText>
                      <ThemedText style={hasSubmitted ? styles.checklistStatusDone : styles.checklistStatusPending}>
                        {hasSubmitted ? `✅ ${t('game.ui.submitted', { locale })}` : `⏳ ${t('game.ui.pending', { locale })}`}
                      </ThemedText>
                    </View>
                  );
                })}
              </View>
            )}
            <View style={styles.adminButtonsRow}>
              {!game.currentRound.commentsVisible && (
                <TouchableOpacity
                  style={[
                    styles.adminButton,
                    { backgroundColor: GameColors.admin, shadowColor: GameColors.shadow },
                  ]}
                  onPress={handleShowComments}
                  activeOpacity={0.8}
                  accessibilityLabel={t('game.ui.showComments', { locale })}
                  accessibilityRole="button"
                >
                  <IconSymbol name="eye.fill" size={16} color={GameColors.white} />
                  <ThemedText style={styles.buttonText}>{t('game.ui.showComments', { locale })}</ThemedText>
                </TouchableOpacity>
              )}
              {game.currentRound.commentsVisible && (
                <TouchableOpacity
                  style={[
                    styles.adminButton,
                    { backgroundColor: GameColors.purple, shadowColor: GameColors.shadow },
                    loading && gameStyles.buttonDisabled,
                  ]}
                  onPress={handleStartGuessingPhase}
                  disabled={loading}
                  activeOpacity={0.8}
                  accessibilityLabel={t('game.ui.startGuessingPhase', { locale })}
                  accessibilityRole="button"
                >
                  {loading
                    ? <ActivityIndicator size="small" color={GameColors.white} />
                    : <IconSymbol name="brain.head.profile" size={16} color={GameColors.white} />}
                  <ThemedText style={styles.buttonText}>{t('game.ui.startGuessingPhase', { locale })}</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
          </ScrollIntoView>
        )}
        <AdminRoundTools
          isAdmin={isAdmin}
          locale={locale}
          showFancyAlert={showFancyAlert}
          onRestart={restartMirrorRound}
          onSkip={skipMirrorRound}
        />

        {/* User is the target */}
        {user?.uid === game.currentRound.targetUserId && (
          <ScrollIntoView
            enabled
            scrollIntoViewKey={`${game.currentRound.roundNumber}:target:${game.currentRound.commentsVisible}:${game.currentRound.pointsGiven}`}
            align="top"
            animated
            insets={SCROLL_INSETS}
          >
          <Animated.View style={[styles.targetView, targetPulse]}>
            {!game.currentRound.commentsVisible ? (
              <ThemedText style={styles.waitingText}>
                {t('game.ui.waitingForCommentsAboutYou', { locale })}
              </ThemedText>
            ) : !game.currentRound.pointsGiven ? (
              <View style={styles.commentsView}>
                <ThemedText type="subtitle" style={styles.commentsTitle}>
                  {t('game.ui.commentsAboutYou', { locale })}
                </ThemedText>
                {game.currentRound.comments?.map((comment: Comment) => (
                  <View key={comment.id} style={styles.commentCard}>
                    <ThemedText style={styles.commentText}>{comment.text}</ThemedText>
                    {comment.points === undefined && (
                      <TouchableOpacity
                        style={styles.pointsButton}
                        onPress={() => handleGivePoints(comment.id, 1)}
                        disabled={!!givingPoints[comment.id]}
                        accessibilityLabel={t('game.ui.awardPoint', { locale })}
                        accessibilityRole="button"
                      >
                        {givingPoints[comment.id] ? (
                          <ActivityIndicator size="small" color={GameColors.white} />
                        ) : (
                          <IconSymbol name="plus.circle.fill" size={16} color={GameColors.white} />
                        )}
                      </TouchableOpacity>
                    )}
                    {comment.points !== undefined && (
                      <ThemedText style={styles.pointsGivenText}>
                        {t('game.ui.pointsAwarded', { locale })} {comment.points}
                      </ThemedText>
                    )}
                  </View>
                ))}
                {!game.currentRound.pointsGiven && (
                  <TouchableOpacity
                    style={[
                      styles.submitCommentButton,
                      {
                        backgroundColor: GameColors.purple,
                        shadowColor: GameColors.shadow,
                      },
                      loading && gameStyles.buttonDisabled,
                    ]}
                    onPress={handleFinishGivingPoints}
                    disabled={loading}
                    activeOpacity={0.8}
                    accessibilityLabel={t('game.ui.finishAwardingPoints', { locale })}
                    accessibilityRole="button"
                  >
                    {loading
                      ? <ActivityIndicator size="small" color={GameColors.white} />
                      : <IconSymbol name="checkmark.circle.fill" size={16} color={GameColors.white} />}
                    <ThemedText style={styles.buttonText}>{t('game.ui.finishAwardingPoints', { locale })}</ThemedText>
                  </TouchableOpacity>
                )}
                {game.currentRound.pointsGiven && (
                  <ThemedText style={styles.waitingText}>
                    {t('game.ui.finishedAwardingPointsWaitAdmin', { locale })}
                  </ThemedText>
                )}
              </View>
            ) : (
              <ThemedText style={styles.waitingText}>
                {t('game.ui.finishedAwardingPointsWaitAdmin', { locale })}
              </ThemedText>
            )}
          </Animated.View>
          </ScrollIntoView>
        )}

        {/* User is not the target */}
        {user?.uid !== game.currentRound.targetUserId && (
          <ScrollIntoView
            enabled
            scrollIntoViewKey={`${game.currentRound.roundNumber}:other:${game.currentRound.commentsVisible}:${game.currentRound.pointsGiven}`}
            align="top"
            animated
            insets={SCROLL_INSETS}
          >
          <Animated.View style={[styles.commentView, otherPulse]}>
            {(() => {
              const shouldUserWriteComments = !(
                user?.uid === game.adminId &&
                !game.adminWritesComments &&
                game.currentRound!.targetUserId !== game.adminId
              );

              const userComment = game.currentRound!.comments?.find(
                (c: Comment) => c.authorId === user?.uid
              );

              if (!userComment && shouldUserWriteComments) {
                return (
                  <View>
                    <ThemedText style={styles.commentPrompt}>
                      {t('game.ui.writeAnonymousCommentAbout', { locale, name: `${game.currentRound && joinIndexById[game.currentRound.targetUserId] ? `${joinIndexById[game.currentRound.targetUserId]}. ` : ''}${getDisplayName(game.currentRound!.targetUserName)}` })}
                    </ThemedText>
                    <TextInput
                      style={[
                        styles.commentInput,
                        inputTheme.style,
                      ]}
                      placeholder={t('game.ui.commentPlaceholder', { locale })}
                      placeholderTextColor={inputTheme.placeholderTextColor}
                      value={commentText}
                      onChangeText={setCommentText}
                      multiline
                      numberOfLines={4}
                      maxLength={500}
                      textAlignVertical="top"
                    />
                    <ThemedText style={[styles.charCounter, commentText.length >= 450 && styles.charCounterWarning]}>
                      {commentText.length}/500
                    </ThemedText>
                    <TouchableOpacity
                      style={[
                        styles.submitCommentButton,
                        {
                          backgroundColor: GameColors.blue,
                          shadowColor: GameColors.shadow,
                        },
                        (!commentText.trim() || isSubmittingComment) && gameStyles.buttonDisabled,
                      ]}
                      onPress={handleSubmitComment}
                      disabled={!commentText.trim() || isSubmittingComment}
                      activeOpacity={0.8}
                      accessibilityLabel={t('game.ui.submitComment', { locale })}
                      accessibilityRole="button"
                    >
                      {isSubmittingComment
                        ? <ActivityIndicator size="small" color={GameColors.white} />
                        : <IconSymbol name="paperplane.fill" size={16} color={GameColors.white} />}
                      <ThemedText style={styles.buttonText}>{t('game.ui.submitComment', { locale })}</ThemedText>
                    </TouchableOpacity>
                  </View>
                );
              } else if (!shouldUserWriteComments) {
                return (
                  <ThemedText style={styles.waitingText}>
                    {t('game.ui.adminNotParticipating', { locale })}
                  </ThemedText>
                );
              } else if (!game.currentRound!.commentsVisible) {
                return (
                  <ThemedText style={styles.waitingText}>
                    {t('game.ui.commentSentWaitingShow', { locale })}
                  </ThemedText>
                );
              } else {
                return (
                  <View style={styles.commentsView}>
                    <ThemedText type="subtitle" style={styles.commentsTitle}>
                      {t('game.ui.allComments', { locale })}
                    </ThemedText>
                    {game.currentRound!.comments?.map((comment: Comment) => (
                      <View key={comment.id} style={styles.commentCard}>
                        <ThemedText style={styles.commentText}>{comment.text}</ThemedText>
                        {comment.points !== undefined && (
                          <ThemedText style={styles.pointsGivenText}>
                            {t('game.ui.points', { locale })} {comment.points}
                          </ThemedText>
                        )}
                      </View>
                    ))}
                    {game.currentRound!.pointsGiven && (
                      (() => {
                        const alreadyGaveTargetPoints =
                          game.currentRound!.targetPointsGivenBy?.includes(user?.uid ?? '') ?? false;
                        const hasCompletedPhase = game.playersWhoCompletedPostCommentPhase?.includes(user?.uid || '') ?? false;
                        return (
                          <View style={{ marginTop: 16 }}>
                            {game.currentRound!.pointsGiven && !hasCompletedPhase && !alreadyGaveTargetPoints && (
                                <View style={styles.pointsButtonsContainer}>
                                  {Array.from({ length: getMaxPoints() + 1 }, (_, i) => i).map((points) => (
                                    <TouchableOpacity
                                      key={points}
                                      style={[
                                        styles.pointsButton,
                                        givingPointsToTarget && gameStyles.buttonDisabled,
                                      ]}
                                      onPress={() => handleGivePointsToTargetWithConfirm(points)}
                                      disabled={givingPointsToTarget}
                                      activeOpacity={0.8}
                                      accessibilityLabel={t('game.ui.givePointsLabel', { locale, count: points })}
                                      accessibilityRole="button"
                                    >
                                      {givingPointsToTarget ? (
                                        <ActivityIndicator size="small" color={GameColors.textDark} />
                                      ) : (
                                        <ThemedText style={styles.pointsButtonText}>
                                          {points}
                                        </ThemedText>
                                      )}
                                    </TouchableOpacity>
                                  ))}
                                </View>
                            )}
                          </View>
                        );
                      })()
                    )}
                  </View>
                );
              }
            })()}
          </Animated.View>
          </ScrollIntoView>
        )}
      </View>

      {/* Post-Guessing Point Phase (when active during active status) */}
      {game.postGuessingPointPhase && (
        <PostGuessingPointsPanel
          game={game}
          isAdmin={isAdmin}
          user={user}
          participantsByJoin={participantsByJoin}
          joinIndexById={joinIndexById}
          getDisplayName={getDisplayName}
          showFancyAlert={showFancyAlert}
          locale={locale}
        />
      )}
      
      <FaceMessage
        visible={faceMessage.visible}
        message={faceMessage.message}
        face={faceMessage.face}
        onComplete={() => setFaceMessage(prev => ({ ...prev, visible: false }))}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  phaseWrapper: { backgroundColor: GameColors.activeTint, borderWidth: 1, borderColor: GameColors.activeTintBorder, borderRadius: 16, padding: 16, marginBottom: 8 },
gameStatusContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
roundInfo: { marginBottom: 20, padding: 16, borderRadius: 8, backgroundColor: GameColors.cardBg },
roundTitle: { marginBottom: 8, textAlign: 'center', fontFamily: Fonts.sans },
targetText: { textAlign: 'center', fontSize: 18, fontWeight: '600', fontFamily: Fonts.sans },
adminControls: { marginTop: 24 },
adminButtonsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
checklistContainer: { marginBottom: 12, padding: 12, borderRadius: 8, backgroundColor: GameColors.cardBg },
checklistTitle: { textAlign: 'center', fontWeight: '600', fontSize: 14, marginBottom: 4, fontFamily: Fonts.sans },
checklistProgress: { textAlign: 'center', fontSize: 12, opacity: 0.7, marginBottom: 8, fontFamily: Fonts.sans },
checklistRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
checklistNumber: { width: 20, fontSize: 13, opacity: 0.6, fontFamily: Fonts.sans },
checklistName: { flex: 1, fontSize: 13, fontWeight: '500', fontFamily: Fonts.sans },
checklistStatusDone: { fontSize: 12, fontWeight: '600', color: GameColors.green, fontFamily: Fonts.sans },
checklistStatusPending: { fontSize: 12, fontWeight: '600', opacity: 0.5, fontFamily: Fonts.sans },
adminButton: { flexDirection: 'row', borderRadius: 999, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', paddingVertical: 14, paddingHorizontal: 24, gap: 8, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
buttonText: { color: GameColors.white, fontWeight: '600', fontSize: 15, fontFamily: Fonts.sans },
targetView: { marginBottom: 20 },
commentView: { marginBottom: 20 },
waitingText: { textAlign: 'center', opacity: 0.7, fontSize: 16, marginVertical: 16, fontFamily: Fonts.sans },
commentsView: { marginTop: 16 },
commentsTitle: { marginBottom: 16, textAlign: 'center', fontFamily: Fonts.sans },
commentCard: { padding: 16, borderRadius: 8, backgroundColor: GameColors.cardBg, marginBottom: 12 },
commentText: { fontSize: 16, marginBottom: 12, lineHeight: 22, fontFamily: Fonts.sans },
pointsGivenText: { fontSize: 14, fontWeight: '600', color: GameColors.green, marginTop: 8, fontFamily: Fonts.sans },
submitCommentButton: { flexDirection: 'row', borderRadius: 999, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', paddingVertical: 14, paddingHorizontal: 24, gap: 8, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  pointsSelectionTitle: { textAlign: 'center', fontSize: 16, fontWeight: '600', marginBottom: 12, fontFamily: Fonts.sans },
  pointsButtonsContainer: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  pointsButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: GameColors.lightPageBg,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: GameColors.cardBorder,
  },
  pointsButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: GameColors.textDark,
    fontFamily: Fonts.sans,
  },
  commentPrompt: { marginBottom: 12, fontSize: 16, fontFamily: Fonts.sans },
  commentInput: { minHeight: 100, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 4, borderWidth: 1, textAlignVertical: 'top', fontFamily: Fonts.sans, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }, android: { elevation: 2 } }) },
  charCounter: { fontSize: 12, opacity: 0.5, textAlign: 'right', marginBottom: 12, fontFamily: Fonts.sans },
  charCounterWarning: { opacity: 1, color: '#A63D2A' },
});
