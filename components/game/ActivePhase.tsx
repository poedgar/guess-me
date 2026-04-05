import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts, GameColors, StatusColors } from '@/constants/theme';
import { Comment, Game, Participant, useGame } from '@/contexts/GameContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSound } from '@/contexts/SoundContext';
import { t } from '@/i18n';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ShowFancyAlertFn } from './GameHeader';
import PostGuessingPointsPanel from './PostGuessingPointsPanel';

interface Props {
  game: Game;
  isAdmin: boolean;
  user: { uid: string } | null;
  participantsByJoin: Participant[];
  joinIndexById: Record<string, number>;
  getDisplayName: (name: string) => string;
  showFancyAlert: ShowFancyAlertFn;
  locale: string;
  isDark: boolean;
}

export const ActivePhase: React.FC<Props> = ({
  game,
  isAdmin,
  user,
  participantsByJoin,
  joinIndexById,
  getDisplayName,
  showFancyAlert,
  locale,
  isDark,
}) => {
  const { playSound } = useSound();
  const {
    loading,
    submitComment,
    showComments,
    givePoints,
    finishGivingPoints,
    givePointsToTarget,
    startGuessingPhase,
    skipPostCommentPhase,
  } = useGame();

  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [givingPoints, setGivingPoints] = useState<Record<string, boolean>>({});
  const [givingPointsToTarget, setGivingPointsToTarget] = useState(false);

  const getRequiredComments = () => {
    if (!game.currentRound) return 0;
    const targetUserId = game.currentRound.targetUserId;
    const isTargetAdmin = targetUserId === game.adminId;

    if (!game.adminWritesComments) {
      return game.participants.length - 2;
    }

    if (isTargetAdmin && !game.adminWritesComments) {
      return game.participants.length - 1;
    }

    return game.participants.length - 1;
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
    } catch (error: any) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error.message || t('game.alerts.submitCommentFailed', { locale }));
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleShowComments = async () => {
    try {
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await showComments();
      await playSound('success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error.message || t('game.alerts.showCommentsFailed', { locale }));
    }
  };

  const handleGivePoints = async (commentId: string, points: number) => {
    if (!givePoints) {
      showFancyAlert(t('common.error', { locale }), t('game.alerts.notImplemented', { locale }));
      return;
    }
    try {
      setGivingPoints(prev => ({ ...prev, [commentId]: true }));
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await givePoints(commentId, points);
      await playSound('points');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFancyAlert(t('common.success', { locale }), t('game.alerts.pointsAwarded', { locale }));
    } catch (error: any) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error?.message || t('game.alerts.pointsAwardFailed', { locale }));
    } finally {
      setGivingPoints(prev => ({ ...prev, [commentId]: false }));
    }
  };

  const handleFinishGivingPoints = async () => {
    if (!finishGivingPoints) {
      showFancyAlert(t('common.error', { locale }), t('game.alerts.notImplemented', { locale }));
      return;
    }
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await finishGivingPoints();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFancyAlert(t('common.success', { locale }), t('game.alerts.finishPointsSuccess', { locale }));
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error?.message || t('game.alerts.finishPointsFailed', { locale }));
    }
  };

  const handleGivePointsToTarget = async (points: number = 1) => {
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
      await playSound('points');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFancyAlert(t('common.success', { locale }), t('game.alerts.targetPointsAwarded', { locale }));
    } catch (error: any) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error?.message || t('game.alerts.targetPointsAwardFailed', { locale }));
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
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFancyAlert(t('common.success', { locale }), 'You skipped the post-comment phase');
    } catch (error: any) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error?.message || 'Failed to skip phase');
    }
  };

  const handleStartGuessingPhase = async () => {
    if (!isAdmin) return;
    try {
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await startGuessingPhase();
      await playSound('success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error.message || t('game.alerts.startGuessingPhaseFailed', { locale }));
    }
  };

  if (!game.currentRound) return null;

  return (
    <>
      {/* Status badge */}
      <View style={styles.gameStatusContainer}>
        <ThemedText style={styles.statusLabel}>{t('game.ui.statusLabel', { locale })}</ThemedText>
        <View style={[styles.statusBadge, { backgroundColor: StatusColors.active }]}>
          <ThemedText style={styles.statusText}>
            {t('game.ui.statusActive', { locale })}
          </ThemedText>
        </View>
      </View>

      <View style={styles.gameFlowContainer}>
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
          <View style={styles.adminControls}>
            <View style={styles.adminButtonsRow}>
              {!game.currentRound.commentsVisible && (
                <TouchableOpacity
                  style={[
                    styles.adminButton,
                    {
                      backgroundColor: GameColors.admin,
                      shadowColor: '#000',
                    },
                    (game.currentRound.comments?.length || 0) <
                      getRequiredComments() && styles.buttonDisabled,
                  ]}
                  onPress={handleShowComments}
                  disabled={(game.currentRound.comments?.length || 0) <
                    getRequiredComments()}
                  activeOpacity={0.8}
                >
                  <IconSymbol name="eye.fill" size={16} color="#fff" />
                </TouchableOpacity>
              )}
              {game.currentRound.commentsVisible &&
                game.currentRound.pointsGiven && (
                <TouchableOpacity
                  style={[
                    styles.adminButton,
                    {
                      backgroundColor: GameColors.purple,
                      shadowColor: '#000',
                    },
                    loading && styles.buttonDisabled,
                  ]}
                  onPress={handleStartGuessingPhase}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <>
                    <IconSymbol name="brain.head.profile" size={16} color="#fff" />
                    <ThemedText style={styles.buttonText}>
                      {loading ? 'Завантаження...' : ''}
                    </ThemedText>
                  </>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* User is the target */}
        {user?.uid === game.currentRound.targetUserId && (
          <View style={styles.targetView}>
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
                      >
                        {givingPoints[comment.id] ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <IconSymbol name="plus.circle.fill" size={14} color="#fff" />
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
                        shadowColor: '#000',
                      },
                      loading && styles.buttonDisabled,
                    ]}
                    onPress={handleFinishGivingPoints}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <IconSymbol name="checkmark.circle.fill" size={16} color="#fff" />
                    )}
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
          </View>
        )}

        {/* User is not the target */}
        {user?.uid !== game.currentRound.targetUserId && (
          <View style={styles.commentView}>
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
                        {
                          backgroundColor: isDark ? GameColors.inputDark : GameColors.inputLight,
                          color: isDark ? Colors.dark.text : Colors.light.text,
                          borderColor: isDark ? GameColors.inputBorderDark : GameColors.inputBorderLight,
                        },
                      ]}
                      placeholder={t('game.ui.commentPlaceholder', { locale })}
                      placeholderTextColor={isDark ? GameColors.placeholderDark : GameColors.placeholderLight}
                      value={commentText}
                      onChangeText={setCommentText}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                    />
                    <TouchableOpacity
                      style={[
                        styles.submitCommentButton,
                        {
                          backgroundColor: GameColors.blue,
                          shadowColor: '#000',
                        },
                        (!commentText.trim() || isSubmittingComment) && styles.buttonDisabled,
                      ]}
                      onPress={handleSubmitComment}
                      disabled={!commentText.trim() || isSubmittingComment}
                      activeOpacity={0.8}
                    >
                      {isSubmittingComment ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <IconSymbol name="paperplane.fill" size={16} color="#fff" />
                      )}
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
                            <ThemedText style={{ width: 'fit-content', alignSelf: 'center', color: 'white', textAlign: 'center', marginBottom: 8, backgroundColor: GameColors.green, padding: 8, borderRadius: 8 }}>
                              Готово
                            </ThemedText>
                            {game.currentRound!.pointsGiven && !hasCompletedPhase && !alreadyGaveTargetPoints && (
                              <TouchableOpacity
                                style={[
                                  styles.submitCommentButton,
                                  {
                                    backgroundColor: GameColors.green,
                                    shadowColor: '#000',
                                  },
                                ]}
                                onPress={() => handleGivePointsToTarget(1)}
                                disabled={alreadyGaveTargetPoints || givingPointsToTarget}
                                activeOpacity={0.8}
                              >
                                {givingPointsToTarget ? (
                                  <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                  <ThemedText style={styles.buttonText}>
                                    {alreadyGaveTargetPoints
                                      ? 'Бали нараховано'
                                      : 'Дати 1 бал цільовому гравцю'}
                                  </ThemedText>
                                )}
                              </TouchableOpacity>
                            )}
                            {game.currentRound!.pointsGiven && !hasCompletedPhase && !alreadyGaveTargetPoints && (
                              <TouchableOpacity
                                style={[
                                  styles.submitCommentButton,
                                  {
                                    backgroundColor: GameColors.neutral,
                                    shadowColor: '#000',
                                    marginTop: 8,
                                  },
                                ]}
                                onPress={handleSkipPostCommentPhase}
                                activeOpacity={0.8}
                              >
                                <ThemedText style={styles.buttonText}>
                                  {game.playersWhoCompletedPostCommentPhase?.includes(user?.uid || '')
                                    ? 'Пропущено'
                                    : 'Пропустити'}
                                </ThemedText>
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })()
                    )}
                  </View>
                );
              }
            })()}
          </View>
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
    </>
  );
};

const styles = StyleSheet.create({
  gameStatusContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  statusLabel: { marginRight: 12, fontSize: 16, fontFamily: Fonts.sans },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  gameFlowContainer: { marginTop: 24, marginBottom: 24 },
  roundInfo: { marginBottom: 20, padding: 16, borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, 0.05)' },
  roundTitle: { marginBottom: 8, textAlign: 'center', fontFamily: Fonts.sans },
  targetText: { textAlign: 'center', fontSize: 18, fontWeight: '600', fontFamily: Fonts.sans },
  adminControls: { marginTop: 24 },
  adminButtonsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12 },
  adminButton: { borderRadius: 999, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12, paddingVertical: 16, paddingHorizontal: 16, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  targetView: { marginBottom: 20 },
  commentView: { marginBottom: 20 },
  waitingText: { textAlign: 'center', opacity: 0.7, fontSize: 16, marginVertical: 16, fontFamily: Fonts.sans },
  commentsView: { marginTop: 16 },
  commentsTitle: { marginBottom: 16, textAlign: 'center', fontFamily: Fonts.sans },
  commentCard: { padding: 16, borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, 0.05)', marginBottom: 12 },
  commentText: { fontSize: 16, marginBottom: 12, lineHeight: 22, fontFamily: Fonts.sans },
  pointsButton: { borderRadius: 999, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', backgroundColor: GameColors.green, paddingVertical: 8, paddingHorizontal: 12 },
  pointsGivenText: { fontSize: 14, fontWeight: '600', color: GameColors.green, marginTop: 8, fontFamily: Fonts.sans },
  submitCommentButton: { borderRadius: 999, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', paddingVertical: 16, paddingHorizontal: 16, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  commentPrompt: { marginBottom: 12, fontSize: 16, fontFamily: Fonts.sans },
  commentInput: { minHeight: 100, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16, borderWidth: 1, textAlignVertical: 'top', fontFamily: Fonts.sans, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }, android: { elevation: 2 } }) },
});
