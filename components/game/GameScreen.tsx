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
      Alert.alert('Sign In Required', 'You must be signed in to create or join a game.');
      return;
    }

    const input = gameIdInput.trim();
    if (!input) {
      Alert.alert('Invalid Input', 'Please enter a game ID or admin password.');
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
          'Game Created!',
          `Your game ID is: ${gameId}\nShare this ID with others to let them join your game.`,
          [
            {
              text: 'Copy ID',
              onPress: () => {
                Clipboard.setString(gameId);
                Alert.alert('Copied!', 'Game ID copied to clipboard');
              },
            },
            { text: 'OK' },
          ]
        );
      } else {
        setGameIdInput('');
        Alert.alert('Success!', 'You have joined the game successfully!');
      }
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to create or join game. Please check the code and try again.');
    } finally {
      setIsProcessingEnter(false);
    }
  }; 

  const handleLeaveGame = async () => {
    Alert.alert(
      'Leave Game',
      'Are you sure you want to leave this game?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await leaveGame();
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to leave game.');
            }
          },
        },
      ]
    );
  };

  const handleStartGame = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await startGame();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to start game.');
    }
  };

  const handleSubmitComment = async () => {
    if (!commentText.trim()) {
      Alert.alert('Error', 'Please enter a comment.');
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
      Alert.alert('Error', error.message || 'Failed to submit comment.');
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
      Alert.alert('Error', error.message || 'Failed to show comments.');
    }
  };

  const handleGivePoints = async (commentId: string, points: number) => {
    if (!givePoints) {
      Alert.alert('Not implemented', 'givePoints is not available on GameContext');
      return;
    }
    try {
      setGivingPoints(prev => ({ ...prev, [commentId]: true }));
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await givePoints(commentId, points);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Point given.');
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error?.message || 'Failed to give points.');
    } finally {
      setGivingPoints(prev => ({ ...prev, [commentId]: false }));
    }
  };

  const handleStartNextRound = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await startNextRound();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to start next round.');
    }
  };

  const handleCopyGameId = () => {
    if (currentGame) {
      Clipboard.setString(currentGame.id);
      Alert.alert('Copied!', 'Game ID copied to clipboard');
    }
  };

  const isAdmin = currentGame?.adminId === user?.uid;
  const commentsForPlayer = currentGame?.guessingData?.commentsByTarget?.[user?.uid || ''] || []; 
  const allCommentsHaveGuesses = commentsForPlayer.length === 0 || commentsForPlayer.every(c => !!selectedGuesses[c.id]);
  const totalTargets = currentGame?.participants?.filter(p => p.userId !== currentGame?.adminId).length ?? 0;
  const isFinalRound = !!currentGame?.currentRound && currentGame.currentRound.roundNumber === totalTargets;

  const handleGivePointsToTarget = async (points: number = 1) => {
    if (!currentGame?.currentRound) return;
    if (!givePointsToTarget) {
      Alert.alert('Not implemented', 'givePointsToTarget is not available on GameContext');
      return;
    }
    try {
      setGivingPointsToTarget(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await givePointsToTarget(currentGame.currentRound.targetUserId, points);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Point given to target.');
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error?.message || 'Failed to give points to target.');
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
      Alert.alert('Error', error.message || 'Failed to start guessing phase.');
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
        Alert.alert('Incomplete', 'Please select an author for each comment before submitting.');
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
        Alert.alert('Partial failure', `Failed to submit guesses for comments: ${failedIds}`);
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Success', 'Your guesses have been submitted!');
        setSelectedGuesses({});
      }
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error?.message || 'Failed to submit your guesses.');
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
      Alert.alert('Success', 'Guessing phase finalized. Game is now finished!');
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error?.message || 'Failed to finalize guessing phase.');
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
              Please sign in to create or join games
            </ThemedText>
          </View>
        ) : currentGame ? (
          <View style={styles.gameContainer}>
            {/* Game Info */}
            <View style={styles.gameInfoCard}>
              <View style={styles.gameHeader}>
                <ThemedText type="title" style={styles.gameTitle}>
                  Game Room
                </ThemedText>
                {isAdmin && (
                  <View style={styles.adminBadge}>
                    <ThemedText style={styles.adminBadgeText}>ADMIN</ThemedText>
                  </View>
                )}
              </View>
              <View style={styles.gameIdContainer}>
                <ThemedText type="subtitle" style={styles.gameIdLabel}>
                  Game ID:
                </ThemedText>
                <TouchableOpacity
                  onPress={handleCopyGameId}
                  style={styles.gameIdBox}
                >
                  <ThemedText style={styles.gameIdText}>{currentGame.id}</ThemedText>
                  <ThemedText style={styles.copyHint}>Tap to copy</ThemedText>
                </TouchableOpacity>
              </View>
              <View style={styles.gameStatusContainer}>
                <ThemedText style={styles.statusLabel}>Status:</ThemedText>
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
                    {currentGame.status.replace('_', ' ').toUpperCase()}
                  </ThemedText>
                </View>
              </View>
              {/* Participants */}
              <View style={styles.participantsContainer}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <ThemedText type="subtitle" style={styles.participantsTitle}>
                    Participants ({currentGame.participants?.length || 0})
                  </ThemedText>
                  {currentGame.status === 'guessing_phase' && (
                    <ThemedText style={{ fontSize: 12, opacity: 0.8 }}>
                      Submitted: {currentGame.guessingData?.playersWhoSubmittedGuesses?.length || 0}/{totalTargets}
                    </ThemedText>
                  )}
                </View>
                {currentGame.participants?.map((participant: Participant) => (
                  <View
                    key={participant.userId}
                    style={[
                      styles.participantItem,
                      participant.userId === currentGame.adminId && styles.adminParticipant,
                    ]}
                  >
                    <View style={styles.participantInfo}>
                      <ThemedText style={styles.participantName}>
                        {participant.userName}
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
                    🏆 Leaderboard
                  </ThemedText>
                  {(() => {
                    // Calculate game points (from rounds) and guess points separately
                    const participantsWithScores = currentGame.participants
                      .map(p => {
                        // Total points from Firestore (includes both game and guess points after finalization)
                        const totalPoints = currentGame.scores?.[p.userId] || 0;
                        
                        // Guess points (only available after finalization)
                        const guessPoints = currentGame.guessResults?.[p.userId]?.correctGuesses || 0;
                        
                        // Game points = total - guess points (during active/guessing phase, total doesn't include guesses yet)
                        // After finalization, we need to subtract to get original game points
                        const gamePoints = currentGame.status === 'finished' && currentGame.guessResults
                          ? totalPoints - guessPoints
                          : totalPoints;
                        
                        return {
                          ...p,
                          gamePoints,
                          guessPoints,
                          totalPoints: currentGame.status === 'finished' && currentGame.guessResults
                            ? totalPoints  // Use the final total from Firestore
                            : gamePoints   // During game, only show game points
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
                                {participant.userName}
                                {participant.userId === currentGame.adminId && ' 👑'}
                                {participant.userId === user?.uid && ' (You)'}
                              </ThemedText>
                              <View style={styles.pointsRow}>
                                <ThemedText style={styles.pointsDetail}>
                                  Game: {participant.gamePoints}
                                </ThemedText>
                                {currentGame.status === 'finished' && currentGame.guessResults && (
                                  <ThemedText style={styles.pointsDetail}>
                                    • Guessing: {participant.guessPoints}
                                  </ThemedText>
                                )}
                              </View>
                            </View>
                            <View style={styles.leaderboardPoints}>
                              <ThemedText style={styles.pointsValue}>
                                {participant.totalPoints}
                              </ThemedText>
                              <ThemedText style={styles.pointsLabel}>total</ThemedText>
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
                      <ThemedText style={styles.buttonText}>Start Game</ThemedText>
                    </TouchableOpacity>
                  )}
                  {!isAdmin && (
                    <ThemedText style={styles.waitingText}>
                      Waiting for admin to start the game...
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
                      Target: {currentGame.currentRound.targetUserName}
                    </ThemedText>
                  </View>
                  {/* User is the target */}
                  {user?.uid === currentGame.currentRound.targetUserId && (
                    <View style={styles.targetView}>
                      {!currentGame.currentRound.commentsVisible ? (
                        <ThemedText style={styles.waitingText}>
                          Waiting for others to write comments about you...
                        </ThemedText>
                      ) : (
                        <View style={styles.commentsView}>
                          <ThemedText type="subtitle" style={styles.commentsTitle}>
                            Comments About You:
                          </ThemedText>
                          {currentGame.currentRound.comments?.map((comment: Comment) => (
                            <View key={comment.id} style={styles.commentCard}>
                              <ThemedText style={styles.commentText}>{comment.text}</ThemedText>
                              {!currentGame.currentRound?.pointsGiven && (
                                <TouchableOpacity
                                  style={styles.pointsButton}
                                  onPress={() => handleGivePoints(comment.id, 1)}
                                  disabled={!!givingPoints[comment.id]}
                                >
                                  {givingPoints[comment.id] ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                  ) : (
                                    <ThemedText style={styles.pointsButtonText}>+1 Point</ThemedText>
                                  )}
                                </TouchableOpacity>
                              )}
                              {comment.points !== undefined && (
                                <ThemedText style={styles.pointsGivenText}>
                                  Points given: {comment.points}
                                </ThemedText>
                              )}
                            </View>
                          ))}
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
                                Write an anonymous comment about {currentGame.currentRound.targetUserName}:
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
                                placeholder="Your anonymous comment..."
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
                                  <ThemedText style={styles.buttonText}>Submit Comment</ThemedText>
                                )}
                              </TouchableOpacity>
                            </View>
                          );
                        } else if (!currentGame.currentRound.commentsVisible) {
                          return (
                            <ThemedText style={styles.waitingText}>
                              Comment submitted! Waiting for admin to show all comments...
                            </ThemedText>
                          );
                        } else {
                          return (
                            <View style={styles.commentsView}>
                              <ThemedText type="subtitle" style={styles.commentsTitle}>
                                All Comments:
                              </ThemedText>
                              {currentGame.currentRound.comments?.map((comment: Comment) => (
                                <View key={comment.id} style={styles.commentCard}>
                                  <ThemedText style={styles.commentText}>{comment.text}</ThemedText>
                                  {comment.points !== undefined && (
                                    <ThemedText style={styles.pointsGivenText}>
                                      Points: {comment.points}
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
                                        You can now give points to {currentGame.currentRound.targetUserName}
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
                                              ? 'Points Given' 
                                              : 'Give 1 Point to Target'}
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
                          <ThemedText style={styles.buttonText}>Show Comments</ThemedText>
                        </TouchableOpacity>
                      )}
                      {currentGame.currentRound.commentsVisible && 
                        currentGame.currentRound.pointsGiven && (
                        <TouchableOpacity
                          style={[
                            styles.adminButton,
                            {
                              backgroundColor: '#4CAF50',
                              shadowColor: '#000',
                            },
                          ]}
                          onPress={handleStartNextRound}
                          activeOpacity={0.8}
                        >
                          <ThemedText style={styles.buttonText}>Start Next Round</ThemedText>
                        </TouchableOpacity>
                      )}
                      
                      {isFinalRound && currentGame.currentRound.pointsGiven && (
                        <TouchableOpacity
                          style={[
                            styles.adminButton,
                            {
                              backgroundColor: '#9C27B0',
                              shadowColor: '#000',
                            },
                          ]}
                          onPress={handleStartGuessingPhase}
                          activeOpacity={0.8}
                        >
                          <ThemedText style={styles.buttonText}>Start Guessing Phase</ThemedText>
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
                      Final Round: Guess the Authors
                    </ThemedText>
                    <ThemedText style={styles.targetText}>
                      Try to guess who wrote each comment about you
                    </ThemedText>
                  </View>
                  
                  {currentGame.guessingData.playersWhoSubmittedGuesses?.includes(user?.uid || '') ? (
                    (() => {
                      const playerResult = currentGame.guessResults?.[user?.uid ?? ''];
                      if (playerResult) {
                        return (
                          <View style={styles.guessResultsContainer}>
                            <ThemedText type="subtitle" style={styles.guessResultsTitle}>
                              Your Guessing Results
                            </ThemedText>
                            <View style={styles.guessResultCard}>
                              <ThemedText style={styles.guessResultText}>
                                You correctly guessed {playerResult.correctGuesses || 0} out of {commentsForPlayer.length} comments!
                              </ThemedText>
                              <ThemedText style={styles.guessResultDetail}>
                                You have earned {playerResult.correctGuesses || 0} points for your correct guesses.
                              </ThemedText>
                            </View>
                          </View>
                        );
                      }

                      return (
                        <View style={styles.guessResultsContainer}>
                          <ThemedText type="subtitle" style={styles.guessResultsTitle}>
                            Thanks — guesses submitted
                          </ThemedText>
                          <ThemedText style={styles.waitingText}>
                            Waiting for the admin to finalize the guessing phase. You will see your results after finalization.
                          </ThemedText>
                          {isAdmin && !currentGame.guessingData.allPlayersSubmitted && (
                            <ThemedText style={styles.waitingText}>
                              Waiting for all players to submit their guesses...
                            </ThemedText>
                          )}
                        </View>
                      );
                    })()
                  ) : (
                    <View style={styles.guessingContainer}>
                      <ThemedText style={styles.guessingInstructions}>
                        Below are all the comments written about you during the game.
                        Try to guess who wrote each comment. After submitting, you will see
                        how many you guessed correctly.
                      </ThemedText>
                      
                      {commentsForPlayer.map((comment) => (
                        <View key={comment.id} style={styles.guessCard}>
                          <ThemedText style={styles.commentText}>"{comment.text}"</ThemedText>
                          
                          <ThemedText style={styles.guessPrompt}>
                            Who do you think wrote this comment?
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
                                  {author.userName}
                                </ThemedText>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                      ))}
                      
                      {(commentsForPlayer.length > 0 && !allCommentsHaveGuesses) && (
                        <ThemedText style={{ textAlign: 'center', color: '#999', marginBottom: 8 }}>
                          Please select an author for each comment to enable Submit
                        </ThemedText>
                      )}
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
                          <ThemedText style={styles.buttonText}>Submit My Guesses</ThemedText>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                  
                  {isAdmin && currentGame.guessingData.allPlayersSubmitted && (
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
                          <ThemedText style={styles.buttonText}>Finalize Game</ThemedText>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
              {currentGame.status === 'finished' && (
                <View style={styles.gameFlowContainer}>
                  <ThemedText type="title" style={styles.finishedTitle}>
                    Game Finished! 🎉
                  </ThemedText>
                  <ThemedText style={styles.finishedText}>
                    All rounds completed. Check the final scores above!
                  </ThemedText>
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
                      📜 Round History ({completedRounds.length} {completedRounds.length === 1 ? 'round' : 'rounds'})
                    </ThemedText>
                    {completedRounds.map((round: Round) => (
                      <View key={round.roundNumber} style={styles.roundHistoryItem}>
                        <View style={styles.roundHistoryHeader}>
                          <ThemedText style={styles.roundHistoryRoundNumber}>
                            Round {round.roundNumber}
                          </ThemedText>
                          <ThemedText style={styles.roundHistoryTarget}>
                            Target: {round.targetUserName}
                          </ThemedText>
                          {(() => {
                            const targetPoints = round.targetPointsGivenBy?.length ?? 0;
                            return (
                              <ThemedText style={styles.roundHistoryTargetPoints}>
                                Target points: +{targetPoints} pts
                              </ThemedText>
                            );
                          })()}
                        </View>
                        <View style={styles.roundHistoryComments}>
                          <ThemedText style={styles.roundHistoryCommentsTitle}>
                            Comments ({round.comments?.length || 0}):
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
                            <ThemedText style={styles.noCommentsText}>No comments</ThemedText>
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
                onPress={handleLeaveGame}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.leaveButtonText}>Leave Game</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.actionContainer}>
            <View style={styles.section}>
              <ThemedText type="title" style={styles.sectionTitle}>
                Create or Join Game
              </ThemedText>
              <ThemedText style={styles.sectionDescription}>
                Enter the admin password to create a new game, or enter an existing game ID to join one.
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
                placeholder="Enter admin password or game ID"
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
                    <ThemedText style={styles.buttonText}>Processing...</ThemedText>
                  </View>
                ) : (
                  <ThemedText style={styles.buttonText}>Proceed</ThemedText>
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