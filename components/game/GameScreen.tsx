import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { Comment, Participant, Round, useGame } from '@/contexts/GameContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  Platform,
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

  const handleEnterGame = async () => {
    if (!isSignedIn) {
      Alert.alert('Потрібно ввійти', 'Ви повинні увійти, щоб створити або приєднатися до гри.');
      return;
    }

    const input = gameIdInput.trim();
    if (!input) {
      Alert.alert('Невірне введення', 'Введіть ідентифікатор гри або пароль адміністратора.');
      return;
    }

    try {
      setIsProcessingEnter(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const result = await enterGame(input);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // If enterGame returned a string, it is the new game id (created as admin)
      if (typeof result === 'string') {
        const gameId = result;
        setGameIdInput('');
        Alert.alert(
          'Гру створено!',
          `Ідентифікатор вашої гри: ${gameId}\nПоділіться цим ID, щоб інші могли приєднатися.`,
          [
            {
              text: 'Скопіювати ID',
              onPress: () => {
                Clipboard.setString(gameId);
                Alert.alert('Скопійовано!', 'ID гри скопійовано в буфер обміну');
              },
            },
            { text: 'ОК' },
          ]
        );
      } else {
        setGameIdInput('');
        Alert.alert('Успішно!', 'Ви успішно приєдналися до гри!');
      }
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Помилка', error.message || 'Не вдалося створити або приєднатися до гри. Перевірте код і спробуйте ще раз.');
    } finally {
      setIsProcessingEnter(false);
    }
  }; 

  const handleLeaveGame = async () => {
    Alert.alert(
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
              Alert.alert('Ви вийшли з гри');
            } catch (error: any) {
              console.error('handleLeaveGame error', error);
              Alert.alert('Помилка', error.message || 'Не вдалося вийти з гри.');
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
      Alert.alert('Ви вийшли з гри');
    } catch (error: any) {
      console.error('handleLeaveNow error', error);
      Alert.alert('Помилка', error.message || 'Не вдалося вийти з гри.');
    }
  };

  const handleStartGame = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await startGame();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Помилка', error.message || 'Не вдалося почати гру.');
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim()) {
      Alert.alert('Помилка', 'Введіть, будь ласка, коментар.');
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
      Alert.alert('Помилка', error.message || 'Не вдалося відправити коментар.');
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
      Alert.alert('Помилка', error.message || 'Не вдалося показати коментарі.');
    }
  };

  const handleGivePoints = async (commentId: string, points: number) => {
    if (!givePoints) {
      Alert.alert('Не реалізовано', 'givePoints недоступний у GameContext');
      return;
    }
    try {
      setGivingPoints(prev => ({ ...prev, [commentId]: true }));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await givePoints(commentId, points);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Успішно', 'Бали нараховано.');
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Помилка', error?.message || 'Не вдалося нарахувати бали.');
    } finally {
      setGivingPoints(prev => ({ ...prev, [commentId]: false }));
    }
  };

  const handleFinishGivingPoints = async () => {
    if (!finishGivingPoints) {
      Alert.alert('Не реалізовано', 'finishGivingPoints недоступний у GameContext');
      return;
    }
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await finishGivingPoints();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Успішно', 'Ви завершили нарахування балів. Адміністратор може продовжити.');
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Помилка', error?.message || 'Не вдалося завершити нарахування балів.');
    }
  };

  const handleStartNextRound = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await startNextRound();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Помилка', error.message || 'Не вдалося почати наступний раунд.');
    }
  };

  const handleCopyGameId = () => {
    if (currentGame) {
      Clipboard.setString(currentGame.id);
      Alert.alert('Скопійовано!', 'ID гри скопійовано в буфер обміну');
    }
  };

  const isAdmin = currentGame?.adminId === user?.uid;
  const commentsForPlayer = currentGame?.guessingData?.commentsByTarget?.[user?.uid || ''] || []; 
  const allCommentsHaveGuesses = commentsForPlayer.length === 0 || commentsForPlayer.every(c => !!selectedGuesses[c.id]);
  const totalTargets = currentGame?.participants?.filter(p => p.userId !== currentGame?.adminId).length ?? 0;
  const isFinalRound = !!currentGame?.currentRound && currentGame.currentRound.roundNumber === totalTargets;
  
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
      Alert.alert('Не реалізовано', 'givePointsToTarget недоступний у GameContext');
      return;
    }
    try {
      setGivingPointsToTarget(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await givePointsToTarget(currentGame.currentRound.targetUserId, points);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Успішно', 'Бали нараховано цільовому гравцю.');
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Помилка', error?.message || 'Не вдалося нарахувати бали цільовому гравцю.');
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
      Alert.alert('Помилка', error.message || 'Не вдалося почати фазу вгадування.');
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
        Alert.alert('Неповно', 'Будь ласка, оберіть автора для кожного коментаря перед відправкою.');
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
        Alert.alert('Часткова помилка', `Не вдалося відправити відповіді для коментарів: ${failedIds}`);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Успішно', 'Ваші відповіді відправлено!');
        setSelectedGuesses({});
      }
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Помилка', error?.message || 'Не вдалося відправити ваші відповіді.');
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
      Alert.alert('Успішно', 'Фазу вгадування завершено. Гра закінчена!');
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Помилка', error?.message || 'Не вдалося завершити фазу вгадування.');
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
      Alert.alert('Error', error?.message || 'Failed to finalize and start next round.');
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
              {/* Participants */}
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
              </View>
              {/* Scores/Leaderboard - FIXED */}
              {(currentGame.status === 'active' || 
                currentGame.status === 'guessing_phase' || 
                currentGame.status === 'finished') && 
                currentGame.scores && (
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
                      <ThemedText style={styles.buttonText}>Почати гру</ThemedText>
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
                      Round {currentGame.currentRound.roundNumber}
                    </ThemedText>
                    <ThemedText style={styles.targetText}>
                      Target: {currentGame.currentRound && joinIndexById[currentGame.currentRound.targetUserId] ? `${joinIndexById[currentGame.currentRound.targetUserId]}. ` : ''}{currentGame.currentRound.targetUserName}
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
                                    <ThemedText style={styles.pointsButtonText}>+1 бал</ThemedText>
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
                              <ThemedText style={styles.buttonText}>
                                {loading ? 'Обробка...' : 'Завершити нарахування балів'}
                              </ThemedText>
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
                        const userComment = currentGame.currentRound.comments?.find(
                          (c: Comment) => c.authorId === user?.uid
                        );
                        if (!userComment) {
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
                                  <ThemedText style={styles.buttonText}>Відправити коментар</ThemedText>
                                )}
                              </TouchableOpacity>
                            </View>
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
                              (currentGame.participants.length - 1) && styles.buttonDisabled,
                          ]}
                          onPress={handleShowComments}
                          disabled={(currentGame.currentRound.comments?.length || 0) < 
                            (currentGame.participants.length - 1)}
                          activeOpacity={0.8}
                        >
                          <ThemedText style={styles.buttonText}>Показати коментарі</ThemedText>
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
                          <ThemedText style={styles.buttonText}>
                            {loading ? 'Starting...' : 'Start Guessing Phase'}
                          </ThemedText>
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
                              <ThemedText style={styles.buttonText}>Відправити мої відповіді</ThemedText>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : (
                      <ThemedText style={styles.waitingText}>
                        Waiting for the admin to start guessing for your round.
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
                                <ThemedText style={styles.buttonText}>Завершити та почати наступний раунд</ThemedText>
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
                                <ThemedText style={styles.buttonText}>Завершити гру</ThemedText>
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
                        Усі раунди завершені. Перегляньте фінальні результати вище!
                      </ThemedText>
                    </>
                  )}
                </View>
              )}
              {/* Round History */}
              {(() => {
                const allRounds = currentGame.rounds || [];
                const sortedRounds = [...allRounds].sort((a, b) => a.roundNumber - b.roundNumber);
                const completedRounds = sortedRounds.filter(
                  (round) => round.commentsVisible && round.pointsGiven
                );
                return completedRounds.length > 0 ? (
                  <View style={styles.roundHistoryContainer}>
                    <ThemedText type="subtitle" style={styles.roundHistoryTitle}>
                      📜 Історія раундів ({completedRounds.length} {completedRounds.length === 1 ? 'раунд' : 'раунди'})
                    </ThemedText>
                    {completedRounds.map((round: Round) => (
                      <View key={round.roundNumber} style={styles.roundHistoryItem}>
                        <View style={styles.roundHistoryHeader}>
                          <ThemedText style={styles.roundHistoryRoundNumber}>
                            Round {round.roundNumber}
                          </ThemedText>
                          <ThemedText style={styles.roundHistoryTarget}>
                            Target: {round && joinIndexById[round.targetUserId] ? `${joinIndexById[round.targetUserId]}. ` : ''}{round.targetUserName}
                          </ThemedText>
                          {(() => {
                            const targetPoints = round.targetPointsGivenBy?.length ?? 0;
                            return (
                              <ThemedText style={styles.roundHistoryTargetPoints}>
                                    Бали цілі: +{targetPoints} балів
                                  </ThemedText>
                            );
                          })()}
                        </View>
                        <View style={styles.roundHistoryComments}>
                          <ThemedText style={styles.roundHistoryCommentsTitle}>
                            Коментарі ({round.comments?.length || 0}):
                          </ThemedText>
                          {round.comments && round.comments.length > 0 ? (
                            round.comments.map((comment: Comment) => (
                              <View key={comment.id} style={styles.roundHistoryComment}>
                                <ThemedText style={styles.roundHistoryCommentText}>
                                  "{comment.text}"
                                </ThemedText>
                                {comment.points !== undefined && (
                                  <View style={styles.roundHistoryCommentPoints}>
                                    <ThemedText style={styles.roundHistoryPointsValue}>
                                      +{comment.points} pts
                                    </ThemedText>
                                  </View>
                                )}
                              </View>
                            ))
                          ) : (
                            <ThemedText style={styles.noCommentsText}>Коментарів немає</ThemedText>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                ) : null;
              })()}
              <TouchableOpacity
                style={[
                  styles.leaveButton,
                  {
                    backgroundColor: '#ff3b30',
                    shadowColor: '#000',
                  },
                ]}
                onPress={handleLeaveNow}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.leaveButtonText}>Вийти з гри</ThemedText>
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
                    <ThemedText style={styles.buttonText}>Обробка...</ThemedText>
                  </View>
                ) : (
                  <ThemedText style={styles.buttonText}>Продовжити</ThemedText>
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
  sectionDescription: { opacity: 0.7, marginBottom: 16, fontSize: 14, lineHeight: 20 },
  input: { height: 50, borderRadius: 8, paddingHorizontal: 16, fontSize: 16, marginBottom: 16, borderWidth: 1, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }, android: { elevation: 2 } }) },
  createButton: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 8, alignItems: 'center', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  joinButton: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 8, alignItems: 'center', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  buttonDisabled: { opacity: 0.6 },
  buttonLoading: { flexDirection: 'row', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 8 },
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
  statusLabel: { marginRight: 12, fontSize: 16 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  participantsContainer: { marginBottom: 24 },
  participantsTitle: { marginBottom: 12 },
  participantItem: { padding: 12, borderRadius: 8, marginBottom: 8, backgroundColor: 'rgba(0, 0, 0, 0.05)' },
  adminParticipant: { backgroundColor: 'rgba(255, 165, 0, 0.1)', borderWidth: 1, borderColor: 'rgba(255, 165, 0, 0.3)' },
  participantInfo: { flex: 1 },
  participantName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  participantEmail: { fontSize: 14, opacity: 0.7 },
  leaveButton: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: 8, alignItems: 'center', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 }, android: { elevation: 4 } }) },
  leaveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  gameFlowContainer: { marginTop: 24, marginBottom: 24 },
  startGameButton: { paddingVertical: 16, paddingHorizontal: 32, borderRadius: 8, alignItems: 'center', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  waitingText: { textAlign: 'center', opacity: 0.7, fontSize: 16, marginVertical: 16 },
  roundInfo: { marginBottom: 20, padding: 16, borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, 0.05)' },
  roundTitle: { marginBottom: 8, textAlign: 'center' },
  targetText: { textAlign: 'center', fontSize: 18, fontWeight: '600' },
  targetView: { marginBottom: 20 },
  commentView: { marginBottom: 20 },
  commentPrompt: { marginBottom: 12, fontSize: 16 },
  commentInput: { minHeight: 100, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16, borderWidth: 1, textAlignVertical: 'top', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }, android: { elevation: 2 } }) },
  submitCommentButton: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: 8, alignItems: 'center', ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 }, android: { elevation: 4 } }) },
  commentsView: { marginTop: 16 },
  commentsTitle: { marginBottom: 16, textAlign: 'center' },
  commentCard: { padding: 16, borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, 0.05)', marginBottom: 12 },
  commentText: { fontSize: 16, marginBottom: 12, lineHeight: 22 },
  pointsButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, backgroundColor: '#4CAF50', alignSelf: 'flex-start' },
  pointsButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  pointsGivenText: { fontSize: 14, fontWeight: '600', color: '#4CAF50', marginTop: 8 },
  adminControls: { marginTop: 24 },
  adminButton: { paddingVertical: 14, paddingHorizontal: 32, borderRadius: 8, alignItems: 'center', marginBottom: 12, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 }, android: { elevation: 4 } }) },
  finishedTitle: { textAlign: 'center', marginBottom: 12 },
  finishedText: { textAlign: 'center', opacity: 0.7, fontSize: 16 },
  scoresContainer: { marginBottom: 24, marginTop: 8 },
  scoresTitle: { marginBottom: 16, textAlign: 'center' },
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
  guessingInstructions: { fontSize: 16, marginBottom: 20, lineHeight: 24 },
  guessCard: { padding: 16, borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, 0.05)', marginBottom: 20 },
  guessPrompt: { fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 8, color: '#555' },
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
});