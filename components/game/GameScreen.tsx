import { LanguageSelector } from '@/components/LanguageSelector';
import { SoundToggle } from '@/components/SoundToggle';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { Comment, Participant, useGame } from '@/contexts/GameContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSound } from '@/contexts/SoundContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/i18n';
import * as Haptics from 'expo-haptics';
import { Image as ExpoImage } from 'expo-image';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Clipboard,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

function HeaderLogo() {
  const source =
    Platform.OS === 'web'
      ? require('../../assets/images/logo.svg')
      : require('../../assets/images/icon.png');

  return (
    <View style={styles.headerLogoContainer as any}>
      <ExpoImage 
        source={source} 
        style={styles.headerLogo as any} 
        contentFit="contain" 
      />
    </View>
  );
}

export const GameScreen: React.FC = () => {
  const { user, isSignedIn } = useAuth();
  const { locale } = useLanguage();
  const { playSound } = useSound();
  const { 
    currentGame, 
    loading, 
    enterGame,
    leaveGame, 
    startGame, 
    submitComment, 
    showComments, 
    givePoints, 
    finishGivingPoints,
    givePointsToTarget, 
    startNextRound,
    startGuessingPhase,
    submitGuess,
    finalizeGuessingPhase,
    markPlayerGuessesSubmitted,
    updateAdminWritesComments,
  } = useGame();
  const [gameIdInput, setGameIdInput] = useState('');
  const [isProcessingEnter, setIsProcessingEnter] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [givingPoints, setGivingPoints] = useState<Record<string, boolean>>({});
  const [givingPointsToTarget, setGivingPointsToTarget] = useState(false);
  const [selectedGuesses, setSelectedGuesses] = useState<Record<string, string>>({});
  const [isSubmittingGuesses, setIsSubmittingGuesses] = useState(false);
  const [isFinalizingGuesses, setIsFinalizingGuesses] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Animation for admin toggle
  const toggleAnimation = useRef(new Animated.Value(0)).current;

  // Update toggle animation when adminWritesComments changes
  useEffect(() => {
    Animated.timing(toggleAnimation, {
      toValue: currentGame?.adminWritesComments ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [currentGame?.adminWritesComments]);

  // Fancy alert state
  const [fancyVisible, setFancyVisible] = useState(false);
  const [fancyTitle, setFancyTitle] = useState<string | null>(null);
  const [fancyMessage, setFancyMessage] = useState<string | null>(null);
  const [fancyButtons, setFancyButtons] = useState<{ text: string; onPress?: () => void; style?: any }[]>([]);

  const showFancyAlert = (title: string, message?: string | null, buttons?: { text: string; onPress?: () => void; style?: any }[]) => {
    setFancyTitle(title);
    setFancyMessage(message ?? null);
    setFancyButtons(
      buttons && buttons.length > 0
        ? buttons
        : [{ text: t('common.ok', { locale }) }]
    );
    setFancyVisible(true);
  };

  const closeFancyAlert = () => {
    setFancyVisible(false);
  };

  const handleToggleAdminComments = async () => {
    if (!currentGame) return;
    
    try {
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newValue = !currentGame.adminWritesComments;
      await updateAdminWritesComments(newValue);
      await playSound('success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error.message || t('game.alerts.updateSettingsFailed', { locale }));
    }
  };

  const handleEnterGame = async () => {
    if (!isSignedIn) {
      showFancyAlert(t('game.alerts.loginRequiredTitle', { locale }), t('game.alerts.loginRequiredMessage', { locale }));
      return;
    }

    const input = gameIdInput.trim();
    if (!input) {
      showFancyAlert(t('game.alerts.invalidInputTitle', { locale }), t('game.alerts.invalidInputMessage', { locale }));
      return;
    }

    try {
      setIsProcessingEnter(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const result = await enterGame(input, false); // Default to false for game creation

      await playSound('success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // If enterGame returned a string, it is the new game id (created as admin)
      if (typeof result === 'string') {
        const gameId = result;
        setGameIdInput('');
        showFancyAlert(
          t('game.alerts.gameCreatedTitle', { locale }),
          t('game.alerts.gameCreatedMessage', { locale, gameId }),
          [
            {
              text: t('game.alerts.copyId', { locale }),
              onPress: async () => {
                await playSound('copy');
                Clipboard.setString(gameId);
                showFancyAlert(t('game.alerts.copiedTitle', { locale }), t('game.alerts.copiedMessage', { locale }));
              },
            },
            { text: t('common.ok', { locale }) },
          ]
        );
      } else {
        setGameIdInput('');
        showFancyAlert(t('common.success', { locale }), t('game.alerts.joinedGameMessage', { locale }));
      }
    } catch (error: any) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error.message || t('game.alerts.enterGameFailed', { locale }));
    } finally {
      setIsProcessingEnter(false);
    }
  }; 

  const handleLeaveGame = async () => {
    await playSound('click');
    showFancyAlert(
      t('game.alerts.leaveGameTitle', { locale }),
      t('game.alerts.leaveGameMessage', { locale }),
      [
        { text: t('common.cancel', { locale }), style: 'cancel' },
        {
          text: t('game.alerts.confirmLeave', { locale }),
          style: 'destructive',
          onPress: async () => {
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await leaveGame();
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showFancyAlert(t('game.alerts.leftGameTitle', { locale }));
            } catch (error: any) {
              console.error('handleLeaveGame error', error);
              showFancyAlert(t('common.error', { locale }), error.message || t('game.alerts.leaveGameFailed', { locale }));
            }
          },
        },
      ]
    );
  };

  // Direct leave action (used for debugging/fallback) — removes user and shows result
  const handleLeaveNow = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await leaveGame();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFancyAlert(t('game.alerts.leftGameTitle', { locale }));
    } catch (error: any) {
      console.error('handleLeaveNow error', error);
      showFancyAlert(t('common.error', { locale }), error.message || t('game.alerts.leaveGameFailed', { locale }));
    }
  };

  const handleStartGame = async () => {
    try {
      await playSound('gameStart');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await startGame();
      await playSound('success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error.message || t('game.alerts.startGameFailed', { locale }));
    }
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
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await showComments();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
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

  const handleStartNextRound = async () => {
    try {
      await playSound('gameStart');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await startNextRound();
      await playSound('success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error.message || t('game.alerts.startNextRoundFailed', { locale }));
    }
  };

  const handleCopyGameId = async () => {
    if (currentGame) {
      await playSound('copy');
      Clipboard.setString(currentGame.id);
      showFancyAlert(t('game.alerts.copiedTitle', { locale }), t('game.alerts.copiedMessage', { locale }));
    }
  };

  const isAdmin = currentGame?.adminId === user?.uid;
  const commentsForPlayer = currentGame?.guessingData?.commentsByTarget?.[user?.uid || ''] || []; 
  const allCommentsHaveGuesses = commentsForPlayer.length === 0 || commentsForPlayer.every(c => !!selectedGuesses[c.id]);
  const totalTargets = currentGame?.participants?.filter(p => p.userId !== currentGame?.adminId).length ?? 0;
  const isFinalRound = !!currentGame?.currentRound && currentGame.currentRound.roundNumber === totalTargets;
  
  // Calculate required number of comments for current round
  const getRequiredComments = () => {
    if (!currentGame?.currentRound) return 0;
    const targetUserId = currentGame.currentRound.targetUserId;
    const isTargetAdmin = targetUserId === currentGame.adminId;
    
    // If target is admin and admin doesn't write comments, exclude admin from comment writers
    if (isTargetAdmin && !currentGame.adminWritesComments) {
      return currentGame.participants.length - 1; // All non-admin participants
    }
    
    // Otherwise, all participants except the target can write comments
    return currentGame.participants.length - 1;
  };
  
  // Participants sorted by join time (ascending). Show a 1-based index next to each name.
  const participantsByJoin = (currentGame?.participants || []).slice().sort((a, b) => {
    const aMillis = a.joinedAt && typeof (a.joinedAt as any)?.toDate === 'function' ? (a.joinedAt as any).toDate().getTime() : new Date(a.joinedAt).getTime();
    const bMillis = b.joinedAt && typeof (b.joinedAt as any)?.toDate === 'function' ? (b.joinedAt as any).toDate().getTime() : new Date(b.joinedAt).getTime();
    return aMillis - bMillis;
  });

  // Map of userId -> 1-based join index for quick lookup when rendering names elsewhere
  const joinIndexById: Record<string, number> = Object.fromEntries(
    participantsByJoin.map((p, i) => [p.userId, i + 1])
  );
  const handleGivePointsToTarget = async (points: number = 1) => {
    if (!currentGame?.currentRound) return;
    if (!givePointsToTarget) {
      showFancyAlert(t('common.error', { locale }), t('game.alerts.notImplemented', { locale }));
      return;
    }
    try {
      setGivingPointsToTarget(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await givePointsToTarget(currentGame.currentRound.targetUserId, points);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFancyAlert(t('common.success', { locale }), t('game.alerts.targetPointsAwarded', { locale }));
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error?.message || t('game.alerts.targetPointsAwardFailed', { locale }));
    } finally {
      setGivingPointsToTarget(false);
    }
  };

  const handleStartGuessingPhase = async () => {
    if (!isAdmin) return;
    
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await startGuessingPhase();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error?.message || t('game.alerts.startGuessingPhaseFailed', { locale }));
    }
  };

  const handleSubmitGuesses = async () => {
    if (!currentGame || !user) return;

    try {
      setIsSubmittingGuesses(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const commentsForPlayerLocal = currentGame.guessingData?.commentsByTarget?.[user?.uid || ''] || [];
      
      const missing = commentsForPlayerLocal.filter(c => !selectedGuesses[c.id]);
      if (missing.length > 0) {
        showFancyAlert(t('game.alerts.incomplete', { locale }), t('game.alerts.selectAuthorForEachComment', { locale }));
        setIsSubmittingGuesses(false);
        return;
      }

      const failures: { commentId: string; error: any }[] = [];

      for (const comment of commentsForPlayerLocal) {
        const selectedAuthorId = selectedGuesses[comment.id];
        if (!selectedAuthorId) continue;

        let roundContaining = currentGame.rounds?.find(r => r.comments?.some(c => c.id === comment.id));
        if (!roundContaining && currentGame.currentRound?.comments?.some(c => c.id === comment.id)) {
          roundContaining = currentGame.currentRound;
        }
        if (!roundContaining) {
          failures.push({ commentId: comment.id, error: 'Round not found' });
          continue;
        }

        try {
          await submitGuess(roundContaining.roundNumber, comment.id, selectedAuthorId);
        } catch (err) {
          failures.push({ commentId: comment.id, error: err });
        }
      }

      try {
        await markPlayerGuessesSubmitted();
      } catch (err) {
        console.warn('Failed to mark player as submitted', err);
      }

      if (failures.length > 0) {
        const failedIds = failures.map(f => f.commentId).join(', ');
        showFancyAlert(t('game.alerts.partialError', { locale }), `${t('game.alerts.failedToSubmitGuessesForComments', { locale })}: ${failedIds}`);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showFancyAlert(t('common.success', { locale }), t('game.alerts.guessesSubmitted', { locale }));
        setSelectedGuesses({});
      }
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error?.message || t('game.alerts.submitGuessesFailed', { locale }));
    } finally {
      setIsSubmittingGuesses(false);
    }
  };

  const handleFinalizeGuessingPhase = async () => {
    if (!isAdmin || !currentGame) return;
    
    try {
      setIsFinalizingGuesses(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await finalizeGuessingPhase();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFancyAlert(t('common.success', { locale }), t('game.alerts.guessingPhaseCompleteGameFinished', { locale }));
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error?.message || t('game.alerts.finalizeGuessingFailed', { locale }));
    } finally {
      setIsFinalizingGuesses(false);
    }
  };

  const handleFinalizeAndNextRound = async () => {
    if (!isAdmin || !currentGame) return;
    try {
      setIsFinalizingGuesses(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await finalizeGuessingPhase();
      // Try to start the next round (may finish the game if no participants left)
      try {
        await startNextRound();
      } catch (e) {
        // startNextRound may throw if game finished; that's fine
        console.warn('startNextRound after finalize failed or game finished', e);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error?.message || t('game.alerts.finishAndStartNextRoundFailed', { locale }));
    } finally {
      setIsFinalizingGuesses(false);
    }
  };

  const handleGuessSelect = (commentId: string, authorId: string) => {
    setSelectedGuesses(prev => ({
      ...prev,
      [commentId]: authorId
    }));
  };


  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!isSignedIn ? (
          <View style={styles.notSignedInContainer}>
            <View style={styles.inlineLanguageToggle}>
              <HeaderLogo />
              <View style={{marginTop: 12, display: 'flex', justifyContent: 'space-around', alignItems: 'center', gap: 12}}>
                <LanguageSelector />
                <SoundToggle />
              </View>
            </View>
            <ThemedText type="title" style={styles.notSignedInText}>
              {t('game.ui.pleaseSignIn', { locale })}
            </ThemedText>
          </View>
        ) : currentGame ? (
          <View style={styles.gameContainer}>
            {/* Game Info */}
            <View style={styles.gameInfoCard}>
              <View style={styles.gameHeader}>
                <ThemedText type="title" style={styles.gameTitle}>
                  <HeaderLogo />
                </ThemedText>
                <View style={styles.gameHeaderRight}>
                  <View style={{marginTop: 12, display: 'flex', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', gap: 12}}>
                    <LanguageSelector />
                    <SoundToggle />
                    {isAdmin && (
                    <View style={styles.adminBadge}>
                      <ThemedText style={styles.adminBadgeText}>{t('game.ui.adminBadge', { locale })}</ThemedText>
                    </View>
                  )}
                  </View>
                </View>
              </View>
              {currentGame.status === 'waiting' && (
                <View style={{display: 'flex', flexDirection: 'row'}}>
                <View style={styles.gameIdContainer}>
                  <ThemedText type="subtitle" style={styles.gameIdLabel}>
                    {t('game.ui.gameIdLabel', { locale })}
                  </ThemedText>
                  <TouchableOpacity
                    onPress={handleCopyGameId}
                    style={styles.gameIdBox}
                  >
                    <ThemedText style={styles.gameIdText}>{currentGame.id}</ThemedText>
                    <ThemedText style={styles.copyHint}>{t('game.ui.tapToCopy', { locale })}</ThemedText>
                  </TouchableOpacity>
                </View>
                {/* Show QR Code for Admin */}
                {currentGame.status === 'waiting' && isAdmin && (
                  <View style={styles.qrCodeContainer}>
                    <View style={[
                      styles.qrCodeBox,
                      isDark && styles.qrCodeBoxDark
                    ]}>
                      <QRCode
                        value={currentGame.id}
                        size={75}
                        color={isDark ? '#fff' : '#000'}
                        backgroundColor={isDark ? '#2a2a2a' : '#fff'}
                      />
                    </View>
                  </View>
                )}
              </View>
              )}
              <View style={styles.gameStatusContainer}>
                <ThemedText style={styles.statusLabel}>{t('game.ui.statusLabel', { locale })}</ThemedText>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor:
                        currentGame.status === 'waiting'
                          ? '#FFA500'
                          : currentGame.status === 'active'
                          ? '#4CAF50'
                          : currentGame.status === 'guessing_phase'
                          ? '#9C27B0'
                          : '#9E9E9E',
                    },
                  ]}
                >
                  <ThemedText style={styles.statusText}>
                    {(
                      {
                        waiting: t('game.ui.statusWaiting', { locale }),
                        active: t('game.ui.statusActive', { locale }),
                        guessing_phase: t('game.ui.statusGuessing', { locale }),
                        finished: t('game.ui.statusFinished', { locale }),
                      } as Record<string, string>
                    )[currentGame.status] || currentGame.status}
                  </ThemedText>
                </View>
              </View>
              {/* Admin settings (show only before game starts and only for admin) */}
              {currentGame.status === 'waiting' && isAdmin && (
                <View style={styles.toggleContainer}>
                  <View style={styles.toggleInfo}>
                    <ThemedText style={styles.toggleLabel}>
                      {t('game.ui.adminWritesCommentsTitle', { locale })}
                    </ThemedText>
                    <ThemedText style={styles.toggleDescription}>
                      {t('game.ui.adminWritesCommentsDescription', { locale })}
                    </ThemedText>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      currentGame.adminWritesComments && styles.toggleButtonActive
                    ]}
                    onPress={handleToggleAdminComments}
                    activeOpacity={0.8}
                  >
                    <Animated.View style={[
                      styles.toggleThumb,
                      currentGame.adminWritesComments ? styles.toggleThumbActive : {},
                      {
                        transform: [{
                          translateX: toggleAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 20] // Move thumb 20px to the right when active
                          })
                        }]
                      }
                    ] as any} />
                  </TouchableOpacity>
                </View>
              )}
              {/* Participants (show only before game starts) */}
              {currentGame.status === 'waiting' && (
                <View style={styles.participantsContainer}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <ThemedText type="subtitle" style={styles.participantsTitle}>
                      {t('game.ui.participants', { locale })} ({currentGame.participants?.length || 0})
                    </ThemedText>
                    {currentGame.status === 'guessing_phase' && (
                      <ThemedText style={{ fontSize: 12, opacity: 0.8 }}>
                        {t('game.ui.submitted', { locale })}: {currentGame.guessingData?.playersWhoSubmittedGuesses?.length || 0}/{totalTargets}
                      </ThemedText>
                    )}
                  </View>
                  <ScrollView style={styles.participantsScroll} nestedScrollEnabled>
                    {participantsByJoin.map((participant: Participant, idx: number) => (
                      <View
                        key={participant.userId}
                        style={[
                          styles.participantItem,
                          participant.userId === currentGame.adminId && styles.adminParticipant,
                        ]}
                      >
                        <View style={styles.participantInfo}>
                          <ThemedText style={styles.participantName}>
                            {`${idx + 1}. `}{participant.userName}
                            {participant.userId === currentGame.adminId && ' 👑'}
                            {currentGame.status === 'guessing_phase' && participant.userId !== currentGame.adminId && (
                              (currentGame.guessingData?.playersWhoSubmittedGuesses?.includes(participant.userId)) ? ' ✅' : ' ⏳'
                            )}
                          </ThemedText>
                          <ThemedText style={styles.participantEmail}>
                            {participant.userEmail}
                          </ThemedText>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
              {/* Scores/Leaderboard - FIXED */}
              {currentGame.status === 'waiting' && currentGame.scores && (
                <View style={styles.scoresContainer}>
                  <ThemedText type="subtitle" style={styles.scoresTitle}>
                    {t('game.ui.leaderboardTitle', { locale })}
                  </ThemedText>
                  {(() => {
                    // Calculate game points (from rounds) and guess points separately
                    // scores contains only game points (from comments and target points)
                    // guessResults contains guess points
                    // total = game points + guess points
                    const participantsWithScores = currentGame.participants
                      .map(p => {
                        // Game points from Firestore (only from comments and target points)
                        const gamePoints = currentGame.scores?.[p.userId] || 0;
                        
                        // Guess points (only available after finalization)
                        const guessPoints = currentGame.guessResults?.[p.userId]?.correctGuesses || 0;
                        
                        // Total = game points + guess points
                        const totalPoints = gamePoints + guessPoints;
                        
                        return {
                          ...p,
                          gamePoints,
                          guessPoints,
                          totalPoints
                        };
                      })
                      .sort((a, b) => b.totalPoints - a.totalPoints);
                    
                    return (
                      <ScrollView style={styles.leaderboardScroll} nestedScrollEnabled>
                        <View style={styles.leaderboard}>
                          {participantsWithScores.map((participant, index) => (
                          <View
                            key={participant.userId}
                            style={[
                              styles.leaderboardItem,
                              index === 0 && styles.leaderboardFirst,
                              participant.userId === user?.uid && styles.leaderboardCurrentUser,
                            ]}
                          >
                            <View style={styles.leaderboardRank}>
                              {index === 0 && <ThemedText style={styles.rankEmoji}>🥇</ThemedText>}
                              {index === 1 && <ThemedText style={styles.rankEmoji}>🥈</ThemedText>}
                              {index === 2 && <ThemedText style={styles.rankEmoji}>🥉</ThemedText>}
                              {index > 2 && (
                                <ThemedText style={styles.rankNumber}>#{index + 1}</ThemedText>
                              )}
                            </View>
                            <View style={styles.leaderboardInfo}>
                              <ThemedText style={styles.leaderboardName}>
                                {joinIndexById[participant.userId] ? `${joinIndexById[participant.userId]}. ` : ''}
                                {participant.userName}
                                {participant.userId === currentGame.adminId && ' 👑'}
                                {participant.userId === user?.uid && ` ${t('game.ui.youLabel', { locale })}`}
                              </ThemedText>
                              <View style={styles.pointsRow}>
                                <ThemedText style={styles.pointsDetail}>
                                  {t('game.ui.pointsGame', { locale })}: {participant.gamePoints}
                                </ThemedText>
                                {currentGame.guessResults && participant.guessPoints > 0 && (
                                  <ThemedText style={styles.pointsDetail}>
                                    • {t('game.ui.pointsGuessing', { locale })}: {participant.guessPoints}
                                  </ThemedText>
                                )}
                              </View>
                            </View>
                            <View style={styles.leaderboardPoints}>
                              <ThemedText style={styles.pointsValue}>
                                {participant.totalPoints}
                              </ThemedText>
                              <ThemedText style={styles.pointsLabel}>{t('game.ui.pointsTotal', { locale })}</ThemedText>
                            </View>
                          </View>
                        ))}
                      </View>
                      </ScrollView>
                    );
                  })()}
                </View>
              )}
              {/* Game Flow UI */}
              {currentGame.status === 'waiting' && (
                <View style={styles.gameFlowContainer}>
                  {isAdmin && (
                    <TouchableOpacity
                      style={[
                        styles.startGameButton,
                        {
                          backgroundColor: '#4CAF50',
                          shadowColor: '#000',
                        },
                        (loading || currentGame.participants.length < 2) && styles.buttonDisabled,
                      ]}
                      onPress={handleStartGame}
                      disabled={loading || currentGame.participants.length < 2}
                      activeOpacity={0.8}
                    >
                      <IconSymbol name="arrow.right.circle.fill" size={16} color="#fff" />
                    </TouchableOpacity>
                  )}
                  {!isAdmin && (
                    <ThemedText style={styles.waitingText}>
                      {t('game.ui.waitingForAdminStart', { locale })}
                    </ThemedText>
                  )}
                </View>
              )}
              {currentGame.status === 'active' && currentGame.currentRound && (
                <View style={styles.gameFlowContainer}>
                  <View style={styles.roundInfo}>
                    <ThemedText type="subtitle" style={styles.roundTitle}>
                      {t('game.ui.round', { locale })} {currentGame.currentRound.roundNumber}
                    </ThemedText>
                    <ThemedText style={styles.targetText}>
                      {t('game.ui.target', { locale })}: {currentGame.currentRound && joinIndexById[currentGame.currentRound.targetUserId] ? `${joinIndexById[currentGame.currentRound.targetUserId]}. ` : ''}{currentGame.currentRound.targetUserName}
                    </ThemedText>
                  </View>
                  {/* User is the target */}
                  {user?.uid === currentGame.currentRound.targetUserId && (
                    <View style={styles.targetView}>
                      {!currentGame.currentRound.commentsVisible ? (
                        <ThemedText style={styles.waitingText}>
                          {t('game.ui.waitingForCommentsAboutYou', { locale })}
                        </ThemedText>
                      ) : (
                        <View style={styles.commentsView}>
                          <ThemedText type="subtitle" style={styles.commentsTitle}>
                            {t('game.ui.commentsAboutYou', { locale })}
                          </ThemedText>
                          {currentGame.currentRound.comments?.map((comment: Comment) => (
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
                          {!currentGame.currentRound.pointsGiven && (
                            <TouchableOpacity
                              style={[
                                styles.submitCommentButton,
                                {
                                  backgroundColor: '#9C27B0',
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
                          {currentGame.currentRound.pointsGiven && (
                            <ThemedText style={styles.waitingText}>
                              {t('game.ui.finishedAwardingPointsWaitAdmin', { locale })}
                            </ThemedText>
                          )}
                        </View>
                      )}
                    </View>
                  )}
                  {/* User is not the target */}
                  {user?.uid !== currentGame.currentRound.targetUserId && (
                    <View style={styles.commentView}>
                      {(() => {
                        // Check if user should write comments (exclude admin if adminWritesComments is false and target is not admin)
                        const shouldUserWriteComments = !(
                          user?.uid === currentGame.adminId && 
                          !currentGame.adminWritesComments &&
                          currentGame.currentRound.targetUserId !== currentGame.adminId
                        );
                        
                        const userComment = currentGame.currentRound.comments?.find(
                          (c: Comment) => c.authorId === user?.uid
                        );
                        
                        if (!userComment && shouldUserWriteComments) {
                          return (
                            <View>
                              <ThemedText style={styles.commentPrompt}>
                                {t('game.ui.writeAnonymousCommentAbout', { locale, name: `${currentGame.currentRound && joinIndexById[currentGame.currentRound.targetUserId] ? `${joinIndexById[currentGame.currentRound.targetUserId]}. ` : ''}${currentGame.currentRound.targetUserName}` })}
                              </ThemedText>
                              <TextInput
                                style={[
                                  styles.commentInput,
                                  {
                                    backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
                                    color: isDark ? Colors.dark.text : Colors.light.text,
                                    borderColor: isDark ? '#444' : '#ddd',
                                  },
                                ]}
                                placeholder={t('game.ui.commentPlaceholder', { locale })}
                                placeholderTextColor={isDark ? '#888' : '#999'}
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
                                    backgroundColor: '#4285F4',
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
                        } else if (!currentGame.currentRound.commentsVisible) {
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
                              {currentGame.currentRound.comments?.map((comment: Comment) => (
                                <View key={comment.id} style={styles.commentCard}>
                                  <ThemedText style={styles.commentText}>{comment.text}</ThemedText>
                                  {comment.points !== undefined && (
                                    <ThemedText style={styles.pointsGivenText}>
                                      {t('game.ui.points', { locale })} {comment.points}
                                    </ThemedText>
                                  )}
                                </View>
                              ))}
                              {currentGame.currentRound.pointsGiven && (
                                (() => {
                                  const alreadyGaveTargetPoints = 
                                    currentGame.currentRound.targetPointsGivenBy?.includes(user?.uid ?? '') ?? false;
                                  return (
                                    <View style={{ marginTop: 16 }}>
                                        <ThemedText style={{ textAlign: 'center', marginBottom: 8 }}>
                                        Тепер ви можете нарахувати бали для {currentGame.currentRound && joinIndexById[currentGame.currentRound.targetUserId] ? `${joinIndexById[currentGame.currentRound.targetUserId]}. ` : ''}{currentGame.currentRound.targetUserName}
                                      </ThemedText>
                                      <TouchableOpacity
                                        style={[
                                          styles.submitCommentButton,
                                          {
                                            backgroundColor: '#4CAF50',
                                            shadowColor: '#000',
                                          },
                                          alreadyGaveTargetPoints && styles.buttonDisabled,
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
                  {/* Admin controls */}
                  {isAdmin && (
                    <View style={styles.adminControls}>
                      {!currentGame.currentRound.commentsVisible && (
                        <TouchableOpacity
                          style={[
                            styles.adminButton,
                            {
                              backgroundColor: '#FF9800',
                              shadowColor: '#000',
                            },
                            (currentGame.currentRound.comments?.length || 0) < 
                              getRequiredComments() && styles.buttonDisabled,
                          ]}
                          onPress={handleShowComments}
                          disabled={(currentGame.currentRound.comments?.length || 0) < 
                            getRequiredComments()}
                          activeOpacity={0.8}
                        >
                          <IconSymbol name="eye.fill" size={16} color="#fff" />
                        </TouchableOpacity>
                      )}
                      {currentGame.currentRound.commentsVisible && 
                        currentGame.currentRound.pointsGiven && (
                        <TouchableOpacity
                          style={[
                            styles.adminButton,
                            {
                              backgroundColor: '#9C27B0',
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
                  )}
                </View>
              )}
              {/* Guessing Phase UI */}
              {currentGame.status === 'guessing_phase' && currentGame.guessingData && (
                <View style={styles.gameFlowContainer}>
                  <View style={styles.roundInfo}>
                    <ThemedText type="subtitle" style={styles.roundTitle}>
                      Вгадай авторів
                    </ThemedText>
                    <ThemedText style={styles.targetText}>
                      Спробуйте вгадати, хто написав кожен коментар про вас
                    </ThemedText>
                  </View>
                  
                  {currentGame.guessingData.playersWhoSubmittedGuesses?.includes(user?.uid || '') ? (
                    (() => {
                      const playerResult = currentGame.guessResults?.[user?.uid ?? ''];
                      if (playerResult) {
                        return (
                          <View style={styles.guessResultsContainer}>
                            <ThemedText type="subtitle" style={styles.guessResultsTitle}>
                              Результати вгадування
                            </ThemedText>
                            <View style={styles.guessResultCard}>
                              <ThemedText style={styles.guessResultText}>
                                Ви правильно вгадали {playerResult.correctGuesses || 0} з {commentsForPlayer.length} коментарів!
                              </ThemedText>
                              <ThemedText style={styles.guessResultDetail}>
                                Ви отримали {playerResult.correctGuesses || 0} балів за правильні відповіді.
                              </ThemedText>
                            </View>
                          </View>
                        );
                      }

                      return (
                        <View style={styles.guessResultsContainer}>
                          <ThemedText type="subtitle" style={styles.guessResultsTitle}>
                            Дякуємо — відповіді відправлено
                          </ThemedText>
                          <ThemedText style={styles.waitingText}>
                            Чекаємо, поки адміністратор завершить фазу вгадування. Ви побачите результати після завершення.
                          </ThemedText>
                          {isAdmin && !currentGame.guessingData.allPlayersSubmitted && (
                            <ThemedText style={styles.waitingText}>
                              Чекаємо, поки всі гравці надішлють відповіді...
                            </ThemedText>
                          )}
                        </View>
                      );
                    })()
                  ) : (
                    // Only show guessing UI if there are comments for this player (i.e., they are the target)
                    commentsForPlayer.length > 0 ? (
                      <View style={styles.guessingContainer}>
                        <ThemedText style={styles.guessingInstructions}>
                            Нижче — всі коментарі, написані про вас під час гри.
                            Спробуйте вгадати, хто написав кожен коментар. Після відправки ви побачите, скільки вгадали правильно.
                          </ThemedText>

                        {commentsForPlayer.map((comment) => (
                          <View key={comment.id} style={styles.guessCard}>
                            <ThemedText style={styles.commentText}>"{comment.text}"</ThemedText>

                            <ThemedText style={styles.guessPrompt}>
                              Хто, на вашу думку, написав цей коментар?
                            </ThemedText>

                            <View style={styles.authorOptionsContainer}>
                              {(currentGame.guessingData?.possibleAuthors || []).map((author) => (
                                <TouchableOpacity
                                  key={author.userId}
                                  style={[
                                    styles.authorOption,
                                    selectedGuesses[comment.id] === author.userId && styles.selectedAuthorOption
                                  ]}
                                  onPress={() => handleGuessSelect(comment.id, author.userId)}
                                >
                                      <ThemedText style={[
                                        styles.authorName,
                                        selectedGuesses[comment.id] === author.userId && styles.selectedAuthorName
                                      ]}>
                                        {joinIndexById[author.userId] ? `${joinIndexById[author.userId]}. ` : ''}{author.userName}
                                      </ThemedText>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        ))}

                          {(commentsForPlayer.length > 0 && !allCommentsHaveGuesses) && (
                          <ThemedText style={{ textAlign: 'center', color: '#999', marginBottom: 8 }}>
                            {t('game.alerts.selectAuthorForEachCommentToEnableSubmit', { locale })}
                          </ThemedText>
                        )}
                        {commentsForPlayer.length > 0 && (
                          <TouchableOpacity
                            style={[
                              styles.submitGuessButton,
                              {
                                backgroundColor: '#9C27B0',
                                shadowColor: '#000',
                              },
                              (isSubmittingGuesses || !allCommentsHaveGuesses) && styles.buttonDisabled,
                            ]}
                            onPress={handleSubmitGuesses}
                            disabled={isSubmittingGuesses || !allCommentsHaveGuesses}
                            activeOpacity={0.8}
                          >
                            {isSubmittingGuesses ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <IconSymbol name="arrow.up.circle.fill" size={16} color="#fff" />
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : (
                      <ThemedText style={styles.waitingText}>
                        Очікування, поки адміністратор розпочне фазу вгадування для вашого раунду.
                      </ThemedText>
                    )
                  )}
                  
                  {isAdmin && (
                    (() => {
                      const singleTargetId = currentGame.guessingData?.singleRoundTargetId;
                      const targetSubmitted = singleTargetId ? currentGame.guessingData?.playersWhoSubmittedGuesses?.includes(singleTargetId) : false;

                      if (singleTargetId && targetSubmitted) {
                        return (
                          <View style={styles.adminControls}>
                            <TouchableOpacity
                              style={[
                                styles.adminButton,
                                {
                                  backgroundColor: '#4CAF50',
                                  shadowColor: '#000',
                                },
                                isFinalizingGuesses && styles.buttonDisabled,
                              ]}
                              onPress={handleFinalizeAndNextRound}
                              disabled={isFinalizingGuesses}
                              activeOpacity={0.8}
                            >
                              {isFinalizingGuesses ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <IconSymbol name="forward.end.fill" size={16} color="#fff" />
                              )}
                            </TouchableOpacity>
                          </View>
                        );
                      }

                      if (currentGame.guessingData.allPlayersSubmitted) {
                        return (
                          <View style={styles.adminControls}>
                            <TouchableOpacity
                              style={[
                                styles.adminButton,
                                {
                                  backgroundColor: '#4CAF50',
                                  shadowColor: '#000',
                                },
                                isFinalizingGuesses && styles.buttonDisabled,
                              ]}
                              onPress={handleFinalizeGuessingPhase}
                              disabled={isFinalizingGuesses}
                              activeOpacity={0.8}
                            >
                              {isFinalizingGuesses ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <IconSymbol name="flag.checkered" size={16} color="#fff" />
                              )}
                            </TouchableOpacity>
                          </View>
                        );
                      }

                      return null;
                    })()
                  )}
                </View>
              )}
              {currentGame.status === 'finished' && (
                <View style={styles.gameFlowContainer}>
                  {currentGame.adminLeft ? (
                    <>
                      <ThemedText type="title" style={styles.finishedTitle}>
                        Адміністратор покинув гру
                      </ThemedText>
                      <ThemedText style={styles.finishedText}>
                        Гру неможливо продовжувати без адміністратора. Будь ласка, вийдіть з кімнати або створіть нову гру.
                      </ThemedText>
                    </>
                  ) : (
                    <>
                      <ThemedText type="title" style={styles.finishedTitle}>
                        Гра завершена! 🎉
                      </ThemedText>
                      <ThemedText style={styles.finishedText}>
                        Усі раунди завершені. Перегляньте фінальні результати нижче!
                      </ThemedText>
                      
                      {/* Final Leaderboard */}
                      <View style={styles.scoresContainer}>
                        <ThemedText type="subtitle" style={styles.scoresTitle}>
                          Фінальна таблиця лідерів
                        </ThemedText>
                        {(() => {
                          // Calculate game points (from rounds) and guess points separately
                          // scores contains only game points (from comments and target points)
                          // guessResults contains guess points
                          // total = game points + guess points
                          const participantsWithScores = currentGame.participants
                            .map(p => {
                              // Game points from Firestore (only from comments and target points)
                              const gamePoints = currentGame.scores?.[p.userId] || 0;
                              
                              // Guess points (only available after finalization)
                              const guessPoints = currentGame.guessResults?.[p.userId]?.correctGuesses || 0;
                              
                              // Total = game points + guess points
                              const totalPoints = gamePoints + guessPoints;
                              
                              return {
                                ...p,
                                gamePoints,
                                guessPoints,
                                totalPoints
                              };
                            })
                            .sort((a, b) => b.totalPoints - a.totalPoints);
                          
                          return (
                            <ScrollView style={styles.leaderboardScroll} nestedScrollEnabled>
                              <View style={styles.leaderboard}>
                                {participantsWithScores.map((participant, index) => (
                                <View
                                  key={participant.userId}
                                  style={[
                                    styles.leaderboardItem,
                                    index === 0 && styles.leaderboardFirst,
                                    participant.userId === user?.uid && styles.leaderboardCurrentUser,
                                  ]}
                                >
                                  <View style={styles.leaderboardRank}>
                                    {index === 0 && <ThemedText style={styles.rankEmoji}>🥇</ThemedText>}
                                    {index === 1 && <ThemedText style={styles.rankEmoji}>🥈</ThemedText>}
                                    {index === 2 && <ThemedText style={styles.rankEmoji}>🥉</ThemedText>}
                                    {index > 2 && (
                                      <ThemedText style={styles.rankNumber}>#{index + 1}</ThemedText>
                                    )}
                                  </View>
                                  <View style={styles.leaderboardInfo}>
                                    <ThemedText style={styles.leaderboardName}>
                                      {joinIndexById[participant.userId] ? `${joinIndexById[participant.userId]}. ` : ''}
                                      {participant.userName}
                                      {participant.userId === currentGame.adminId && ' 👑'}
                                      {participant.userId === user?.uid && ' (Ви)'}
                                    </ThemedText>
                                    <View style={styles.pointsRow}>
                                      <ThemedText style={styles.pointsDetail}>
                                        Гра: {participant.gamePoints}
                                      </ThemedText>
                                      {currentGame.guessResults && participant.guessPoints > 0 && (
                                        <ThemedText style={styles.pointsDetail}>
                                          • Вгадування: {participant.guessPoints}
                                        </ThemedText>
                                      )}
                                    </View>
                                  </View>
                                  <View style={styles.leaderboardPoints}>
                                    <ThemedText style={styles.pointsValue}>
                                      {participant.totalPoints}
                                    </ThemedText>
                                    <ThemedText style={styles.pointsLabel}>всього</ThemedText>
                                  </View>
                                </View>
                              ))}
                            </View>
                            </ScrollView>
                          );
                        })()}
                      </View>
                    </>
                  )}
                </View>
              )}
              <TouchableOpacity
                style={[
                  styles.leaveButton,
                  {
                    backgroundColor: '#ff3b30',
                    shadowColor: '#000',
                  },
                ]}
                onPress={handleLeaveGame}
                activeOpacity={0.8}
              >
                <IconSymbol name="door.left.hand.open" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.actionContainer}>
            <View style={styles.inlineLanguageToggle}>
              <HeaderLogo/>
              <View style={{marginTop: 12, display: 'flex', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', gap: 12}}>
                <LanguageSelector />
                <SoundToggle />
              </View>
            </View>
            <View style={styles.section}>
              <ThemedText type="title" style={styles.sectionTitle}>
                {t('game.ui.createOrJoin.title', { locale })}
              </ThemedText>
              <ThemedText style={styles.sectionDescription}>
                {t('game.ui.createOrJoin.description', { locale })}
              </ThemedText>

              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5',
                    color: isDark ? Colors.dark.text : Colors.light.text,
                    borderColor: isDark ? '#444' : '#ddd',
                  },
                ]}
                placeholder={t('game.ui.createOrJoin.inputPlaceholder', { locale })}
                placeholderTextColor={isDark ? '#888' : '#999'}
                value={gameIdInput}
                onChangeText={setGameIdInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[
                  styles.joinButton,
                  {
                    backgroundColor: '#4CAF50',
                    shadowColor: '#000',
                  },
                  (isProcessingEnter || loading || !gameIdInput.trim()) && styles.buttonDisabled,
                ]}
                onPress={handleEnterGame}
                disabled={isProcessingEnter || loading || !gameIdInput.trim()}
                activeOpacity={0.8}
              >
                {isProcessingEnter ? (
                  <View style={styles.buttonLoading}>
                    <ActivityIndicator size="small" color="#fff" />
                  </View>
                ) : (
                  <IconSymbol name="arrow.right.circle.fill" size={16} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

      </ScrollView>

      {/* Fancy Alert Modal - Web Compatible */}
      {fancyVisible && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>{fancyTitle}</ThemedText>
            {fancyMessage && (
              <ThemedText style={styles.modalMessage}>{fancyMessage}</ThemedText>
            )}
            <View style={styles.modalButtons}>
              {fancyButtons.map((button, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.modalButton,
                    button.style === 'destructive' && styles.modalButtonDestructive,
                    button.style === 'cancel' && styles.modalButtonCancel,
                  ]}
                  onPress={() => {
                    if (button.onPress) {
                      button.onPress();
                    }
                    closeFancyAlert();
                  }}
                >
                  <ThemedText style={[
                    styles.modalButtonText,
                    button.style === 'destructive' && styles.modalButtonTextDestructive,
                  ]}>
                    {button.text}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, position: 'relative' as const },
  inlineLanguageToggle: {
    // flex: 1, 
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 60,
    marginBottom: 82,
  },
  scrollContent: { padding: 20, paddingBottom: 40 },
  notSignedInContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  notSignedInText: { textAlign: 'center', opacity: 0.7 },
  actionContainer: { flex: 1, justifyContent: 'center' },
  section: { marginBottom: 32 },
  sectionTitle: { marginBottom: 8 },
  sectionDescription: { opacity: 0.7, marginBottom: 16, fontSize: 14, lineHeight: 20, fontFamily: Fonts.sans },
  input: { height: 50, borderRadius: 8, paddingHorizontal: 16, fontSize: 16, marginBottom: 16, borderWidth: 1, fontFamily: Fonts.sans, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }, android: { elevation: 2 } }) },
  toggleContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: 16, backgroundColor: 'rgba(0, 0, 0, 0.05)', borderRadius: 8 },
  toggleInfo: { flex: 1, marginRight: 16 },
  toggleLabel: { fontSize: 16, fontWeight: '600', marginBottom: 4, fontFamily: Fonts.sans },
  toggleDescription: { fontSize: 14, opacity: 0.7, lineHeight: 20, fontFamily: Fonts.sans },
  toggleButton: { width: 51, height: 31, borderRadius: 15.5, backgroundColor: '#767577', padding: 2, position: 'relative' },
  toggleButtonActive: { backgroundColor: '#4CAF50' },
  toggleThumb: { width: 27, height: 27, borderRadius: 13.5, backgroundColor: '#f4f3f4', position: 'absolute', top: 2, left: 2 },
  toggleThumbActive: { backgroundColor: '#fff' },
  createButton: { borderRadius: 999, paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  joinButton: { borderRadius: 999, paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center', alignSelf: 'center', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  buttonDisabled: { opacity: 0.6 },
  buttonLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  qrButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  qrButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    flex: 1,
    backgroundColor: '#2196F3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  scanButton: {
    backgroundColor: '#FF9800',
  },
  generateButton: {
    backgroundColor: '#4CAF50',
  },
  qrButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  qrCodeContainer: {
    alignItems: 'center',
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
  },
  qrCodeLabel: {
    marginBottom: 12,
    textAlign: 'center',
  },
  qrCodeBox: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  qrCodeBoxDark: {
    backgroundColor: '#333',
  },
  qrCodeGameId: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  iconButton: { borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', paddingVertical: 16, paddingHorizontal: 16, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  gameContainer: { flex: 1 },
  gameInfoCard: { backgroundColor: 'transparent' },
  gameHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  gameTitle: { flex: 1 },
  gameHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  languageSelectorHeader: { marginRight: 10 },
  adminBadge: { height: 'max-content', backgroundColor: '#FFA500', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, marginLeft: 12 },
  adminBadgeText: { color: '#fff', fontSize: 8, fontWeight: '700' },
  gameIdContainer: { marginBottom: 20 },
  gameIdLabel: { marginBottom: 8, opacity: 0.7 },
  gameIdBox: { backgroundColor: 'rgba(76, 175, 80, 0.1)', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(76, 175, 80, 0.3)' },
  gameIdText: { fontSize: 14, fontWeight: '700', fontFamily: 'monospace', marginBottom: 4 },
  copyHint: { fontSize: 10, opacity: 0.6 },
  gameStatusContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  statusLabel: { marginRight: 12, fontSize: 16, fontFamily: Fonts.sans },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  participantsContainer: { marginBottom: 24 },
  participantsTitle: { marginBottom: 12, fontFamily: Fonts.sans },
  participantItem: { padding: 12, borderRadius: 8, marginBottom: 8, backgroundColor: 'rgba(0, 0, 0, 0.05)' },
  adminParticipant: { backgroundColor: 'rgba(255, 165, 0, 0.1)', borderWidth: 1, borderColor: 'rgba(255, 165, 0, 0.3)' },
  participantInfo: { flex: 1 },
  participantName: { fontSize: 16, fontWeight: '600', marginBottom: 4, fontFamily: Fonts.sans },
  participantEmail: { fontSize: 14, opacity: 0.7, fontFamily: Fonts.sans },
  leaveButton: { borderRadius: 999, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  leaveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', fontFamily: Fonts.sans },
  gameFlowContainer: { marginTop: 24, marginBottom: 24 },
  startGameButton: { borderRadius: 999, paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  waitingText: { textAlign: 'center', opacity: 0.7, fontSize: 16, marginVertical: 16, fontFamily: Fonts.sans },
  roundInfo: { marginBottom: 20, padding: 16, borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, 0.05)' },
  roundTitle: { marginBottom: 8, textAlign: 'center', fontFamily: Fonts.sans },
  targetText: { textAlign: 'center', fontSize: 18, fontWeight: '600', fontFamily: Fonts.sans },
  targetView: { marginBottom: 20 },
  commentView: { marginBottom: 20 },
  commentPrompt: { marginBottom: 12, fontSize: 16, fontFamily: Fonts.sans },
  commentInput: { minHeight: 100, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16, borderWidth: 1, textAlignVertical: 'top', fontFamily: Fonts.sans, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }, android: { elevation: 2 } }) },
  submitCommentButton: { borderRadius: 999, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', paddingVertical: 16, paddingHorizontal: 16, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  commentsView: { marginTop: 16 },
  commentsTitle: { marginBottom: 16, textAlign: 'center', fontFamily: Fonts.sans },
  commentCard: { padding: 16, borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, 0.05)', marginBottom: 12 },
  commentText: { fontSize: 16, marginBottom: 12, lineHeight: 22, fontFamily: Fonts.sans },
  pointsButton: { borderRadius: 999, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', backgroundColor: '#4CAF50', paddingVertical: 8, paddingHorizontal: 12 },
  pointsButtonText: { color: '#fff', fontSize: 14, fontWeight: '600', fontFamily: Fonts.sans },
  pointsGivenText: { fontSize: 14, fontWeight: '600', color: '#4CAF50', marginTop: 8, fontFamily: Fonts.sans },
  adminControls: { marginTop: 24 },
  adminButton: { borderRadius: 999, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12, paddingVertical: 16, paddingHorizontal: 16, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  finishedTitle: { textAlign: 'center', marginBottom: 12, fontFamily: Fonts.sans },
  finishedText: { textAlign: 'center', opacity: 0.7, fontSize: 16, fontFamily: Fonts.sans },
  scoresContainer: { marginBottom: 24, marginTop: 8 },
  scoresTitle: { marginBottom: 16, textAlign: 'center', fontFamily: Fonts.sans },
  leaderboard: { borderRadius: 8, overflow: 'hidden' },
  leaderboardItem: { flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 8, borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, 0.05)' },
  leaderboardFirst: { backgroundColor: 'rgba(255, 215, 0, 0.2)', borderWidth: 2, borderColor: 'rgba(255, 215, 0, 0.5)' },
  leaderboardCurrentUser: { backgroundColor: 'rgba(66, 133, 244, 0.15)', borderWidth: 1, borderColor: 'rgba(66, 133, 244, 0.3)' },
  leaderboardRank: { width: 40, alignItems: 'center', justifyContent: 'center' },
  rankEmoji: { fontSize: 24 },
  rankNumber: { fontSize: 14, fontWeight: '600', opacity: 0.6 },
  leaderboardInfo: { flex: 1, marginLeft: 12 },
  leaderboardName: { fontSize: 16, fontWeight: '600' },
  pointsRow: { marginTop: 4, flexDirection: 'row', flexWrap: 'wrap' },
  pointsDetail: { fontSize: 12, opacity: 0.8, marginRight: 8 },
  leaderboardPoints: { alignItems: 'flex-end' },
  pointsValue: { fontSize: 20, fontWeight: '700', color: '#4CAF50' },
  pointsLabel: { fontSize: 12, opacity: 0.6, marginTop: 2 },
  roundHistoryContainer: { marginBottom: 24, marginTop: 8 },
  roundHistoryTitle: { marginBottom: 16, textAlign: 'center' },
  roundHistoryItem: { marginBottom: 20, padding: 16, borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, 0.05)', borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.1)' },
  roundHistoryHeader: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0, 0, 0, 0.1)' },
  roundHistoryRoundNumber: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  roundHistoryTarget: { fontSize: 16, opacity: 0.7 },
  roundHistoryTargetPoints: { marginTop: 6, fontSize: 14, fontWeight: '700', color: '#4CAF50' },
  roundHistoryComments: { marginTop: 8 },
  roundHistoryCommentsTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8, opacity: 0.8 },
  roundHistoryComment: { padding: 12, marginBottom: 8, borderRadius: 6, backgroundColor: 'rgba(255, 255, 255, 0.5)' },
  roundHistoryCommentText: { fontSize: 14, lineHeight: 20, marginBottom: 8, fontStyle: 'italic' },
  roundHistoryCommentPoints: { alignSelf: 'flex-end' },
  roundHistoryPointsValue: { fontSize: 14, fontWeight: '600', color: '#4CAF50' },
  noCommentsText: { textAlign: 'center', opacity: 0.5, fontSize: 14, fontStyle: 'italic', padding: 8 },
  guessingContainer: { marginTop: 16 },
  guessingInstructions: { fontSize: 16, marginBottom: 20, lineHeight: 24, fontFamily: Fonts.sans },
  guessCard: { padding: 16, borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, 0.05)', marginBottom: 20 },
  guessPrompt: { fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 8, color: '#555', fontFamily: Fonts.sans },
  authorOptionsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  authorOption: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: 'rgba(0, 0, 0, 0.05)', borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.1)' },
  selectedAuthorOption: { backgroundColor: '#4285F4', borderColor: '#4285F4' },
  authorName: { fontSize: 14, fontWeight: '500' },
  selectedAuthorName: { color: '#fff' },
  submitGuessButton: { borderRadius: 999, paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center', alignSelf: 'center', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  guessResultsContainer: { marginTop: 16, alignItems: 'center' },
  guessResultsTitle: { marginBottom: 16, textAlign: 'center' },
  guessResultCard: { padding: 20, borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, 0.05)', alignItems: 'center', width: '100%' },
  guessResultText: { fontSize: 18, fontWeight: '600', textAlign: 'center', color: '#4CAF50', marginBottom: 8 },
  guessResultDetail: { fontSize: 14, textAlign: 'center', opacity: 0.8 },
  participantsScroll: { maxHeight: 160, marginTop: 8 },
  leaderboardScroll: { maxHeight: 200, marginTop: 8 },
  // Fancy alert styles
  fancyModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  fancyModal: { width: '85%', backgroundColor: '#fff', borderRadius: 12, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 10 },
  fancyTitle: { marginBottom: 8, textAlign: 'center' },
  fancyMessage: { fontSize: 15, opacity: 0.9, marginBottom: 16, textAlign: 'center' },
  fancyButtonsRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  // Modal styles for fancy alert
  modalOverlay: { 
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 20,
    zIndex: 1000
  },
  modalContent: { width: '85%', backgroundColor: '#fff', borderRadius: 12, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 10 },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  modalMessage: { fontSize: 15, opacity: 0.9, marginBottom: 16, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  modalButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, minWidth: 80, alignItems: 'center' },
  modalButtonDestructive: { backgroundColor: '#ff3b30' },
  modalButtonCancel: { backgroundColor: '#8e8e93' },
  modalButtonText: { fontSize: 16, fontWeight: '600' },
  modalButtonTextDestructive: { color: '#fff' },
  fancyButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, marginLeft: 8 },
  fancyButtonText: { fontSize: 15, color: '#007AFF', fontWeight: '700' },
  fancyDestructiveButton: {},
  fancyDestructiveButtonText: { color: '#D9534F' },
  // Header logo styles
  headerLogoContainer: { 
    justifyContent: 'center', 
    alignItems: 'flex-start', 
    backgroundColor: 'transparent',
    marginTop: -60,
  },
  headerLogo: {
    width: 80,
    height: 80,
  },
});