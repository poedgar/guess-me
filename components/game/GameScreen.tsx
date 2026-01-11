import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { Comment, Participant, useGame } from '@/contexts/GameContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Clipboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export const GameScreen: React.FC = () => {
  const { user, isSignedIn } = useAuth();
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

  // Fancy alert state
  const [fancyVisible, setFancyVisible] = useState(false);
  const [fancyTitle, setFancyTitle] = useState<string | null>(null);
  const [fancyMessage, setFancyMessage] = useState<string | null>(null);
  const [fancyButtons, setFancyButtons] = useState<{ text: string; onPress?: () => void; style?: any }[]>([]);

  const showFancyAlert = (title: string, message?: string | null, buttons?: { text: string; onPress?: () => void; style?: any }[]) => {
    setFancyTitle(title);
    setFancyMessage(message ?? null);
    setFancyButtons(buttons && buttons.length > 0 ? buttons : [{ text: 'OK' }]);
    setFancyVisible(true);
  };

  const closeFancyAlert = () => {
    setFancyVisible(false);
  };

  const handleToggleAdminComments = async () => {
    if (!currentGame) return;
    
    try {
      const newValue = !currentGame.adminWritesComments;
      await updateAdminWritesComments(newValue);
    } catch (error: any) {
      showFancyAlert('Помилка', error.message || 'Не вдалося оновити налаштування.');
    }
  };

  const handleEnterGame = async () => {
    if (!isSignedIn) {
      showFancyAlert('Потрібно ввійти', 'Ви повинні увійти, щоб створити або приєднатися до гри.');
      return;
    }

    const input = gameIdInput.trim();
    if (!input) {
      showFancyAlert('Невірне введення', 'Введіть ідентифікатор гри або пароль адміністратора.');
      return;
    }

    try {
      setIsProcessingEnter(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const result = await enterGame(input, false); // Default to false for game creation

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // If enterGame returned a string, it is the new game id (created as admin)
      if (typeof result === 'string') {
        const gameId = result;
        setGameIdInput('');
        showFancyAlert(
          'Гру створено!',
          `Ідентифікатор вашої гри: ${gameId}\nПоділіться цим ID, щоб інші могли приєднатися.`,
          [
            {
              text: 'Скопіювати ID',
              onPress: () => {
                Clipboard.setString(gameId);
                showFancyAlert('Скопійовано!', 'ID гри скопійовано в буфер обміну');
              },
            },
            { text: 'ОК' },
          ]
        );
      } else {
        setGameIdInput('');
        showFancyAlert('Успішно!', 'Ви успішно приєдналися до гри!');
      }
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert('Помилка', error.message || 'Не вдалося створити або приєднатися до гри. Перевірте код і спробуйте ще раз.');
    } finally {
      setIsProcessingEnter(false);
    }
  }; 

  const handleLeaveGame = async () => {
    showFancyAlert(
      'Вийти з гри',
      'Ви впевнені, що хочете вийти з цієї гри?',
      [
        { text: 'Скасувати', style: 'cancel' },
        {
          text: 'Вийти',
          style: 'destructive',
          onPress: async () => {
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await leaveGame();
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              showFancyAlert('Ви вийшли з гри');
            } catch (error: any) {
              console.error('handleLeaveGame error', error);
              showFancyAlert('Помилка', error.message || 'Не вдалося вийти з гри.');
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
      showFancyAlert('Ви вийшли з гри');
    } catch (error: any) {
      console.error('handleLeaveNow error', error);
      showFancyAlert('Помилка', error.message || 'Не вдалося вийти з гри.');
    }
  };

  const handleStartGame = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await startGame();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert('Помилка', error.message || 'Не вдалося почати гру.');
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim()) {
      showFancyAlert('Помилка', 'Введіть, будь ласка, коментар.');
      return;
    }
    try {
      setIsSubmittingComment(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await submitComment(commentText.trim());
      setCommentText('');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert('Помилка', error.message || 'Не вдалося відправити коментар.');
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
      showFancyAlert('Помилка', error.message || 'Не вдалося показати коментарі.');
    }
  };

  const handleGivePoints = async (commentId: string, points: number) => {
    if (!givePoints) {
      showFancyAlert('Не реалізовано', 'givePoints недоступний у GameContext');
      return;
    }
    try {
      setGivingPoints(prev => ({ ...prev, [commentId]: true }));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await givePoints(commentId, points);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFancyAlert('Успішно', 'Бали нараховано.');
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert('Помилка', error?.message || 'Не вдалося нарахувати бали.');
    } finally {
      setGivingPoints(prev => ({ ...prev, [commentId]: false }));
    }
  };

  const handleFinishGivingPoints = async () => {
    if (!finishGivingPoints) {
      showFancyAlert('Не реалізовано', 'finishGivingPoints недоступний у GameContext');
      return;
    }
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await finishGivingPoints();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFancyAlert('Успішно', 'Ви завершили нарахування балів. Адміністратор може продовжити.');
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert('Помилка', error?.message || 'Не вдалося завершити нарахування балів.');
    }
  };

  const handleStartNextRound = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await startNextRound();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert('Помилка', error.message || 'Не вдалося почати наступний раунд.');
    }
  };

  const handleCopyGameId = () => {
    if (currentGame) {
      Clipboard.setString(currentGame.id);
      showFancyAlert('Скопійовано!', 'ID гри скопійовано в буфер обміну');
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
      showFancyAlert('Не реалізовано', 'givePointsToTarget недоступний у GameContext');
      return;
    }
    try {
      setGivingPointsToTarget(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await givePointsToTarget(currentGame.currentRound.targetUserId, points);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFancyAlert('Успішно', 'Бали нараховано цільовому гравцю.');
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert('Помилка', error?.message || 'Не вдалося нарахувати бали цільовому гравцю.');
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
      showFancyAlert('Помилка', error.message || 'Не вдалося почати фазу вгадування.');
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
        showFancyAlert('Неповно', 'Будь ласка, оберіть автора для кожного коментаря перед відправкою.');
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
        showFancyAlert('Часткова помилка', `Не вдалося відправити відповіді для коментарів: ${failedIds}`);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showFancyAlert('Успішно', 'Ваші відповіді відправлено!');
        setSelectedGuesses({});
      }
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert('Помилка', error?.message || 'Не вдалося відправити ваші відповіді.');
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
      showFancyAlert('Успішно', 'Фазу вгадування завершено. Гра закінчена!');
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert('Помилка', error?.message || 'Не вдалося завершити фазу вгадування.');
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
      showFancyAlert('Помилка', error?.message || 'Не вдалося завершити та почати наступний раунд.');
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
      {/* Fancy alert modal */}
      {fancyVisible && (
        <Modal transparent animationType="fade" visible={fancyVisible} onRequestClose={closeFancyAlert}>
          <View style={styles.fancyModalOverlay}>
            <View style={styles.fancyModal}>
              {fancyTitle ? <ThemedText type="title" style={styles.fancyTitle}>{fancyTitle}</ThemedText> : null}
              {fancyMessage ? <ThemedText style={styles.fancyMessage}>{fancyMessage}</ThemedText> : null}
              <View style={styles.fancyButtonsRow}>
                {fancyButtons.map((b, i) => (
                  <Pressable
                    key={i}
                    style={[styles.fancyButton, b.style === 'destructive' ? styles.fancyDestructiveButton : null]}
                    onPress={async () => {
                      try {
                        if (b.onPress) await b.onPress();
                      } catch (e) {
                        console.error('fancy button onPress error', e);
                      }
                      closeFancyAlert();
                    }}
                  >
                    <ThemedText style={[styles.fancyButtonText, b.style === 'destructive' ? styles.fancyDestructiveButtonText : null]}>{b.text}</ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </Modal>
      )}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {!isSignedIn ? (
          <View style={styles.notSignedInContainer}>
            <ThemedText type="title" style={styles.notSignedInText}>
              Будь ласка, увійдіть, щоб створювати або приєднуватися до ігор
            </ThemedText>
          </View>
        ) : currentGame ? (
          <View style={styles.gameContainer}>
            {/* Game Info */}
            <View style={styles.gameInfoCard}>
              <View style={styles.gameHeader}>
                <ThemedText type="title" style={styles.gameTitle}>
                  Ігрова кімната
                </ThemedText>
                {isAdmin && (
                  <View style={styles.adminBadge}>
                    <ThemedText style={styles.adminBadgeText}>АДМІН</ThemedText>
                  </View>
                )}
              </View>
              {currentGame.status === 'waiting' && (
                <View style={styles.gameIdContainer}>
                  <ThemedText type="subtitle" style={styles.gameIdLabel}>
                    ID гри:
                  </ThemedText>
                  <TouchableOpacity
                    onPress={handleCopyGameId}
                    style={styles.gameIdBox}
                  >
                    <ThemedText style={styles.gameIdText}>{currentGame.id}</ThemedText>
                    <ThemedText style={styles.copyHint}>Натисніть, щоб скопіювати</ThemedText>
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.gameStatusContainer}>
                <ThemedText style={styles.statusLabel}>Статус:</ThemedText>
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
                        waiting: 'Очікування',
                        active: 'Активна',
                        guessing_phase: 'Фаза вгадування',
                        finished: 'Завершено',
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
                      Адміністратор також пише коментарі
                    </ThemedText>
                    <ThemedText style={styles.toggleDescription}>
                      Якщо увімкнено, адміністратор буде брати участь у написанні коментарів про інших гравців
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
                    <View style={[
                      styles.toggleThumb,
                      currentGame.adminWritesComments && styles.toggleThumbActive
                    ]} />
                  </TouchableOpacity>
                </View>
              )}
              {/* Participants (show only before game starts) */}
              {currentGame.status === 'waiting' && (
                <View style={styles.participantsContainer}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <ThemedText type="subtitle" style={styles.participantsTitle}>
                      Учасники ({currentGame.participants?.length || 0})
                    </ThemedText>
                    {currentGame.status === 'guessing_phase' && (
                      <ThemedText style={{ fontSize: 12, opacity: 0.8 }}>
                        Відправлено: {currentGame.guessingData?.playersWhoSubmittedGuesses?.length || 0}/{totalTargets}
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
                    🏆 Таблиця лідерів
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
                      <IconSymbol name="play.fill" size={16} color="#fff" />
                    </TouchableOpacity>
                  )}
                  {!isAdmin && (
                    <ThemedText style={styles.waitingText}>
                      Чекаємо, поки адміністратор почне гру...
                    </ThemedText>
                  )}
                </View>
              )}
              {currentGame.status === 'active' && currentGame.currentRound && (
                <View style={styles.gameFlowContainer}>
                  <View style={styles.roundInfo}>
                    <ThemedText type="subtitle" style={styles.roundTitle}>
                      Раунд {currentGame.currentRound.roundNumber}
                    </ThemedText>
                    <ThemedText style={styles.targetText}>
                      Ціль: {currentGame.currentRound && joinIndexById[currentGame.currentRound.targetUserId] ? `${joinIndexById[currentGame.currentRound.targetUserId]}. ` : ''}{currentGame.currentRound.targetUserName}
                    </ThemedText>
                  </View>
                  {/* User is the target */}
                  {user?.uid === currentGame.currentRound.targetUserId && (
                    <View style={styles.targetView}>
                      {!currentGame.currentRound.commentsVisible ? (
                        <ThemedText style={styles.waitingText}>
                          Чекаємо, поки інші напишуть коментарі про вас...
                        </ThemedText>
                      ) : (
                        <View style={styles.commentsView}>
                          <ThemedText type="subtitle" style={styles.commentsTitle}>
                            Коментарі про вас:
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
                                  Нараховано балів: {comment.points}
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
                              Ви завершили нарахування балів. Чекаємо рішення адміністратора...
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
                                Напишіть анонімний коментар про {currentGame.currentRound && joinIndexById[currentGame.currentRound.targetUserId] ? `${joinIndexById[currentGame.currentRound.targetUserId]}. ` : ''}{currentGame.currentRound.targetUserName}:
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
                                placeholder="Ваш анонімний коментар..."
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
                              Ви адміністратор і не берете участь у написанні коментарів у цій грі.
                            </ThemedText>
                          );
                        } else if (!currentGame.currentRound.commentsVisible) {
                          return (
                            <ThemedText style={styles.waitingText}>
                              Коментар відправлено! Чекаємо, коли адміністратор покаже всі коментарі...
                            </ThemedText>
                          );
                        } else {
                          return (
                            <View style={styles.commentsView}>
                              <ThemedText type="subtitle" style={styles.commentsTitle}>
                                Усі коментарі:
                              </ThemedText>
                              {currentGame.currentRound.comments?.map((comment: Comment) => (
                                <View key={comment.id} style={styles.commentCard}>
                                  <ThemedText style={styles.commentText}>{comment.text}</ThemedText>
                                  {comment.points !== undefined && (
                                    <ThemedText style={styles.pointsGivenText}>
                                      Бали: {comment.points}
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
                              {loading ? 'Завантаження...' : 'Розпочати фазу вгадування'}
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
                            Будь ласка, оберіть автора для кожного коментаря, щоб активувати кнопку відправки
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
                          🏆 Фінальна таблиця лідерів
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
                <>
                  <IconSymbol name="door.left.hand.open" size={16} color="#fff" />
                </>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.actionContainer}>
            <View style={styles.section}>
              <ThemedText type="title" style={styles.sectionTitle}>
                Створити або приєднатися до гри
              </ThemedText>
              <ThemedText style={styles.sectionDescription}>
                Введіть пароль адміністратора, щоб створити нову гру, або існуючий ID гри, щоб приєднатися.
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
                placeholder="Введіть пароль адміністратора або ID гри"
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
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: 20 },
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
  toggleButton: { width: 51, height: 31, borderRadius: 15.5, backgroundColor: '#767577', justifyContent: 'center', padding: 2 },
  toggleButtonActive: { backgroundColor: '#4CAF50' },
  toggleThumb: { width: 27, height: 27, borderRadius: 13.5, backgroundColor: '#f4f3f4' },
  toggleThumbActive: { backgroundColor: '#fff' },
  createButton: { width: 24, height: 24, borderRadius: 999, paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  joinButton: { borderRadius: 999, paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center', alignSelf: 'center', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  buttonDisabled: { opacity: 0.6 },
  buttonLoading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
  iconButton: { width: 24, height: 24, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  gameContainer: { flex: 1 },
  gameInfoCard: { backgroundColor: 'transparent' },
  gameHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  gameTitle: { flex: 1 },
  adminBadge: { backgroundColor: '#FFA500', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, marginLeft: 12 },
  adminBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  gameIdContainer: { marginBottom: 20 },
  gameIdLabel: { marginBottom: 8 },
  gameIdBox: { padding: 16, borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, 0.05)', borderWidth: 2, borderColor: 'rgba(0, 0, 0, 0.1)', borderStyle: 'dashed' },
  gameIdText: { fontSize: 18, fontWeight: '700', fontFamily: 'monospace', marginBottom: 4 },
  copyHint: { fontSize: 12, opacity: 0.6 },
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
  leaveButton: { width: 24, height: 24, borderRadius: 999, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 }, android: { elevation: 4 } }) },
  leaveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', fontFamily: Fonts.sans },
  gameFlowContainer: { marginTop: 24, marginBottom: 24 },
  startGameButton: { width: 24, height: 24, borderRadius: 999, paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  waitingText: { textAlign: 'center', opacity: 0.7, fontSize: 16, marginVertical: 16, fontFamily: Fonts.sans },
  roundInfo: { marginBottom: 20, padding: 16, borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, 0.05)' },
  roundTitle: { marginBottom: 8, textAlign: 'center', fontFamily: Fonts.sans },
  targetText: { textAlign: 'center', fontSize: 18, fontWeight: '600', fontFamily: Fonts.sans },
  targetView: { marginBottom: 20 },
  commentView: { marginBottom: 20 },
  commentPrompt: { marginBottom: 12, fontSize: 16, fontFamily: Fonts.sans },
  commentInput: { minHeight: 100, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16, borderWidth: 1, textAlignVertical: 'top', fontFamily: Fonts.sans, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }, android: { elevation: 2 } }) },
  submitCommentButton: { width: 24, height: 24, borderRadius: 999, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 }, android: { elevation: 4 } }) },
  commentsView: { marginTop: 16 },
  commentsTitle: { marginBottom: 16, textAlign: 'center', fontFamily: Fonts.sans },
  commentCard: { padding: 16, borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, 0.05)', marginBottom: 12 },
  commentText: { fontSize: 16, marginBottom: 12, lineHeight: 22, fontFamily: Fonts.sans },
  pointsButton: { width: 24, height: 24, borderRadius: 999, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', backgroundColor: '#4CAF50' },
  pointsButtonText: { color: '#fff', fontSize: 14, fontWeight: '600', fontFamily: Fonts.sans },
  pointsGivenText: { fontSize: 14, fontWeight: '600', color: '#4CAF50', marginTop: 8, fontFamily: Fonts.sans },
  adminControls: { marginTop: 24 },
  adminButton: { width: 24, height: 24, borderRadius: 999, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 12, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 }, android: { elevation: 4 } }) },
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
  submitGuessButton: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: 8, alignItems: 'center', marginTop: 16, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 }, android: { elevation: 4 } }) },
  guessResultsContainer: { marginTop: 16, alignItems: 'center' },
  guessResultsTitle: { marginBottom: 16, textAlign: 'center' },
  guessResultCard: { padding: 20, borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, 0.05)', alignItems: 'center', width: '100%' },
  guessResultText: { fontSize: 18, fontWeight: '600', textAlign: 'center', color: '#4CAF50', marginBottom: 8 },
  guessResultDetail: { fontSize: 14, textAlign: 'center', opacity: 0.8 },
  participantsScroll: { maxHeight: 160, marginTop: 8 },
  leaderboardScroll: { maxHeight: 200, marginTop: 8 },
  // Fancy alert styles
  fancyModalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  fancyModal: { width: '85%', backgroundColor: '#fff', borderRadius: 12, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 10 },
  fancyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' },
  fancyMessage: { fontSize: 15, opacity: 0.9, marginBottom: 16, textAlign: 'center' },
  fancyButtonsRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  fancyButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, marginLeft: 8 },
  fancyButtonText: { fontSize: 15, color: '#007AFF', fontWeight: '700' },
  fancyDestructiveButton: {},
  fancyDestructiveButtonText: { color: '#D9534F' },
});