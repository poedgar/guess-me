import { LanguageSelector } from '@/components/LanguageSelector';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { FancyAlert, FancyAlertButton } from '@/components/ui/FancyAlert';
import { HeaderLogo } from '@/components/ui/HeaderLogo';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { Comment, Participant, useGame } from '@/contexts/GameContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSound } from '@/contexts/SoundContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/i18n';
import * as Haptics from 'expo-haptics';
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
    updateShowSurnames,
    updateTargetSelectionMode,
    updateShowGuessResults,
    startPostGuessingPointPhase,
    awardPointsToPlayers,
    skipPostCommentPhase,
  } = useGame();
  const [gameIdInput, setGameIdInput] = useState('');
  const [isProcessingEnter, setIsProcessingEnter] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [givingPoints, setGivingPoints] = useState<Record<string, boolean>>({});
  const [givingPointsToTarget, setGivingPointsToTarget] = useState(false);
  const [selectedGuesses, setSelectedGuesses] = useState<{ [commentId: string]: string }>({});
  const [hasSubmittedGuesses, setHasSubmittedGuesses] = useState(false);
  const hasSubmittedGuessesRef = useRef(false);
  const [guessResultModal, setGuessResultModal] = useState<{ correct: boolean; message: string; details: string; commentText: string; actualAuthorName: string; guessedAuthorName: string; guessPoints: number; commentPoints: number; totalPoints: number }[] | null>(null);
  const [isSubmittingGuesses, setIsSubmittingGuesses] = useState(false);
  const [isFinalizingGuesses, setIsFinalizingGuesses] = useState(false);
  // State for post-guessing point awards
  const [selectedPlayersForPoints, setSelectedPlayersForPoints] = useState<Record<string, number>>({});
  const [isAwardingPoints, setIsAwardingPoints] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Helper function to get display name based on showSurnames setting
  const getDisplayName = (fullName: string) => {
    if (currentGame?.showSurnames) {
      return fullName; // Show full name
    }
    // Show only first name (split by space and take first part)
    return fullName.split(' ')[0];
  };

  // Animation for admin toggle
  const toggleAnimation = useRef(new Animated.Value(0)).current;
  const surnamesToggleAnimation = useRef(new Animated.Value(0)).current;
  const targetSelectionModeAnimation = useRef(new Animated.Value(0)).current;
  const showGuessResultsAnimation = useRef(new Animated.Value(0)).current;

  // Update toggle animation when adminWritesComments changes
  useEffect(() => {
    Animated.timing(toggleAnimation, {
      toValue: currentGame?.adminWritesComments ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [currentGame?.adminWritesComments]);

  // Update surnames toggle animation when showSurnames changes
  useEffect(() => {
    Animated.timing(surnamesToggleAnimation, {
      toValue: currentGame?.showSurnames ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [currentGame?.showSurnames]);

  // Update target selection mode animation when targetSelectionMode changes
  useEffect(() => {
    Animated.timing(targetSelectionModeAnimation, {
      toValue: currentGame?.targetSelectionMode === 'chronological' ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [currentGame?.targetSelectionMode]);

  // Update show guess results animation when showGuessResults changes
  useEffect(() => {
    Animated.timing(showGuessResultsAnimation, {
      toValue: currentGame?.showGuessResults ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [currentGame?.showGuessResults]);

  // Reset submission state when entering guessing phase
  useEffect(() => {
    if (currentGame?.status === 'guessing_phase') {
      setHasSubmittedGuesses(false);
      hasSubmittedGuessesRef.current = false; // Reset ref too
      setGuessResultModal(null); // Reset modal too
    }
  }, [currentGame?.status]);

  // Fancy alert state
  const [fancyVisible, setFancyVisible] = useState(false);
  const [fancyTitle, setFancyTitle] = useState<string | null>(null);
  const [fancyMessage, setFancyMessage] = useState<string | null>(null);
  const [fancyButtons, setFancyButtons] = useState<FancyAlertButton[]>([]);

  const showFancyAlert = (title: string, message?: string | null, buttons?: FancyAlertButton[]) => {
    setFancyTitle(title);
    setFancyMessage(message ?? null);
    setFancyButtons(buttons && buttons.length > 0 ? buttons : [{ text: t('common.ok', { locale }) }]);
    setFancyVisible(true);
  };

  const closeFancyAlert = () => setFancyVisible(false);

  // Factory for the four boolean/enum setting toggles.
  // Each toggle: haptic + sound on attempt, success, or error.
  const makeSettingToggler = <T,>(
    getNewValue: () => T,
    updater: (v: T) => Promise<void>,
    getSuccessMessage?: (newValue: T) => string | undefined
  ) => async () => {
    if (!currentGame) return;
    try {
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newValue = getNewValue();
      await updater(newValue);
      await playSound('success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const msg = getSuccessMessage?.(newValue);
      if (msg) showFancyAlert(t('common.success', { locale }), msg);
    } catch (error: any) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error.message || t('game.alerts.updateSettingsFailed', { locale }));
    }
  };

  const handleToggleAdminComments = makeSettingToggler(
    () => !currentGame?.adminWritesComments,
    updateAdminWritesComments
  );

  const handleToggleShowSurnames = makeSettingToggler(
    () => !currentGame?.showSurnames,
    updateShowSurnames
  );

  const handleToggleTargetSelectionMode = makeSettingToggler(
    () => (currentGame?.targetSelectionMode === 'random' ? 'chronological' : 'random') as 'random' | 'chronological',
    updateTargetSelectionMode
  );

  const handleToggleShowGuessResults = makeSettingToggler(
    () => !currentGame?.showGuessResults,
    updateShowGuessResults,
    (newValue) =>
      newValue
        ? t('game.alerts.showGuessResultsEnabled', { locale })
        : t('game.alerts.showGuessResultsDisabled', { locale })
  );

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

  // Trigger modal when first guess result is available after submission
  useEffect(() => {
    if (hasSubmittedGuessesRef.current && commentsForPlayer.length > 0) {
      // Find all comments with guesses and show results for all
      const commentsWithGuesses = commentsForPlayer.filter(comment => selectedGuesses[comment.id]);
      if (commentsWithGuesses.length > 0 && !guessResultModal) {
        const allResults = commentsWithGuesses.map(comment => {
          const result = getGuessResultDisplay(comment.id);
          return result;
        }).filter((result): result is NonNullable<typeof result> => result !== null); // Remove null results with proper type guard
        
        if (allResults.length > 0) {
          setGuessResultModal(allResults);
        }
      }
    }
  }, [hasSubmittedGuessesRef.current, selectedGuesses, commentsForPlayer, guessResultModal]);
  
  // Calculate required number of comments for current round
  const getRequiredComments = () => {
    if (!currentGame?.currentRound) return 0;
    const targetUserId = currentGame.currentRound.targetUserId;
    const isTargetAdmin = targetUserId === currentGame.adminId;
    
    // If admin doesn't write comments, exclude admin from comment writers
    if (!currentGame.adminWritesComments) {
      // Also exclude the target since they don't write comments about themselves
      return currentGame.participants.length - 2;
    }

    // If target is admin and admin doesn't write comments, exclude admin from comment writers
    if (isTargetAdmin && !currentGame.adminWritesComments) {
      return currentGame.participants.length - 1;
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
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await givePointsToTarget(currentGame.currentRound.targetUserId, points);
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

  const handleStartPostGuessingPointPhase = async () => {
    if (!isAdmin) return;
    
    try {
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await startPostGuessingPointPhase();
      await playSound('success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFancyAlert(t('common.success', { locale }), 'Post-guessing point phase started!');
    } catch (error: any) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error.message || 'Failed to start point phase');
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

  const handleSubmitGuesses = async () => {
    if (!currentGame || !user) return;

    try {
      setIsSubmittingGuesses(true);
      await playSound('click');
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
        hasSubmittedGuessesRef.current = true; // Set ref immediately
        setHasSubmittedGuesses(true); // Update state too
        await markPlayerGuessesSubmitted();
      } catch (err) {
        console.warn('Failed to mark player as submitted', err);
      }

      if (failures.length > 0) {
        const failedIds = failures.map(f => f.commentId).join(', ');
        showFancyAlert(t('game.alerts.partialError', { locale }), `${t('game.alerts.failedToSubmitGuessesForComments', { locale })}: ${failedIds}`);
      } else {
        await playSound('correctGuess');
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await finalizeGuessingPhase();
      await playSound('gameOver');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFancyAlert(t('common.success', { locale }), t('game.alerts.guessingPhaseCompleteGameFinished', { locale }));
    } catch (error: any) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error.message || t('game.alerts.finalizeGuessingFailed', { locale }));
    } finally {
      setIsFinalizingGuesses(false);
    }
  };

  const handleFinalizeAndNextRound = async () => {
    if (!isAdmin || !currentGame) return;
    try {
      setIsFinalizingGuesses(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await finalizeGuessingPhase();
      await playSound('roundComplete');
      // Try to start the next round (may finish the game if no participants left)
      try {
        await startNextRound();
      } catch (e) {
        // startNextRound may throw if game finished; that's fine
        console.warn('startNextRound after finalize failed or game finished', e);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error.message || t('game.alerts.finishAndStartNextRoundFailed', { locale }));
    } finally {
      setIsFinalizingGuesses(false);
    }
  };

  const handleAwardPointsToPlayers = async () => {
    if (!currentGame || !user) return;

    try {
      setIsAwardingPoints(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Convert selected players to awards array
      const awards = Object.entries(selectedPlayersForPoints).map(([playerId, points]) => ({
        recipientId: playerId,
        points
      }));

      if (awards.length === 0) {
        showFancyAlert(t('common.error', { locale }), 'Please select at least one player to award points to');
        return;
      }

      await awardPointsToPlayers(awards);
      await playSound('points');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFancyAlert(t('common.success', { locale }), 'Points awarded successfully!');
      setSelectedPlayersForPoints({});
    } catch (error: any) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t('common.error', { locale }), error?.message || 'Failed to award points');
    } finally {
      setIsAwardingPoints(false);
    }
  };

  const handlePlayerSelectForPoints = (playerId: string, points: number) => {
    setSelectedPlayersForPoints(prev => {
      if (prev[playerId] === points) {
        // Remove player if same points clicked again
        const newSelection = { ...prev };
        delete newSelection[playerId];
        return newSelection;
      } else {
        // Add or update player points
        return { ...prev, [playerId]: points };
      }
    });
  };

  const handleGuessSelect = (commentId: string, authorId: string) => {
    playSound('click');
    setSelectedGuesses(prev => ({
      ...prev,
      [commentId]: authorId
    }));
  };

  // Helper function to check if a guess was correct
  const isGuessCorrect = (commentId: string, guessedAuthorId: string): boolean => {
    // Find the comment and check if the guessed author matches the actual author
    const comment = commentsForPlayer.find(c => c.id === commentId);

    return comment ? comment.authorId === guessedAuthorId : false;
  };

  // Helper function to get guess result for display
  const getGuessResultDisplay = (commentId: string) => {
    // Use ref for immediate synchronous check
    if (!hasSubmittedGuessesRef.current) return null;

    const guessedAuthorId = selectedGuesses[commentId];
    if (!guessedAuthorId) return null;
    
    const comment = commentsForPlayer.find(c => c.id === commentId);
    if (!comment) return null;
    
    const correct = isGuessCorrect(commentId, guessedAuthorId);
    
    // Get participant names for display
    const actualAuthor = currentGame.participants.find(p => p.userId === comment.authorId);
    const guessedAuthor = currentGame.participants.find(p => p.userId === guessedAuthorId);
    
    const actualAuthorName = getDisplayName(actualAuthor?.userName || 'Unknown');
    const guessedAuthorName = getDisplayName(guessedAuthor?.userName || 'Unknown');
    
    // Calculate points for this guess - show immediate feedback for correct guesses
    const guessPoints = correct ? 1 : 0; // +1 point for correct guess
    const commentPoints = comment.points || 0; // Points this comment received
    
    // Create detailed message showing the comparison
    const message = correct 
      ? t('game.ui.guessCorrect', { locale })
      : t('game.ui.guessIncorrect', { locale });
    
    const details = correct
      ? t('game.ui.guessCorrectDetails', { locale, actual: actualAuthorName, guessed: guessedAuthorName })
      : t('game.ui.guessIncorrectDetails', { locale, actual: actualAuthorName, guessed: guessedAuthorName });
    
    // Return result object with comment text, author comparison, and scoring info
    return { 
      correct, 
      message, 
      details,
      commentText: comment?.text || '',
      actualAuthorName,
      guessedAuthorName,
      guessPoints,
      commentPoints,
      totalPoints: guessPoints + commentPoints
    };
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
                {/* <SoundToggle /> */}
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
                    {/* <SoundToggle /> */}
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
                    onPress={async () => { await playSound('click'); handleCopyGameId(); }}
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
              {/* Show Surnames toggle (show only before game starts and only for admin) */}
              {currentGame.status === 'waiting' && isAdmin && (
                <View style={styles.toggleContainer}>
                  <View style={styles.toggleInfo}>
                    <ThemedText style={styles.toggleLabel}>
                      {t('game.ui.showSurnamesTitle', { locale })}
                    </ThemedText>
                    <ThemedText style={styles.toggleDescription}>
                      {t('game.ui.showSurnamesDescription', { locale })}
                    </ThemedText>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      currentGame.showSurnames && styles.toggleButtonActive
                    ]}
                    onPress={handleToggleShowSurnames}
                    activeOpacity={0.8}
                  >
                    <Animated.View style={[
                      styles.toggleThumb,
                      currentGame.showSurnames ? styles.toggleThumbActive : {},
                      {
                        transform: [{
                          translateX: surnamesToggleAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 20] // Move thumb 20px to the right when active
                          })
                        }]
                      }
                    ] as any} />
                  </TouchableOpacity>
                </View>
              )}
              {/* Target Selection Mode toggle (show only before game starts and only for admin) */}
              {currentGame.status === 'waiting' && isAdmin && (
                <View style={styles.toggleContainer}>
                  <View style={styles.toggleInfo}>
                    <ThemedText style={styles.toggleLabel}>
                      {t('game.ui.targetSelectionModeTitle', { locale })}
                    </ThemedText>
                    <ThemedText style={styles.toggleDescription}>
                      {t('game.ui.targetSelectionModeDescription', { locale })}
                    </ThemedText>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      currentGame.targetSelectionMode === 'chronological' && styles.toggleButtonActive
                    ]}
                    onPress={handleToggleTargetSelectionMode}
                    activeOpacity={0.8}
                  >
                    <Animated.View style={[
                      styles.toggleThumb,
                      currentGame.targetSelectionMode === 'chronological' ? styles.toggleThumbActive : {},
                      {
                        transform: [{
                          translateX: targetSelectionModeAnimation.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0, 20] // Move thumb 20px to the right when active
                          })
                        }]
                      }
                    ] as any} />
                  </TouchableOpacity>
                </View>
              )}
              {/* Show Guess Results toggle (show only before game starts and only for admin) */}
              {currentGame.status === 'waiting' && isAdmin && (
                <View style={styles.toggleContainer}>
                  <View style={styles.toggleInfo}>
                    <ThemedText style={styles.toggleLabel}>
                      {t('game.ui.showGuessResultsTitle', { locale })}
                    </ThemedText>
                    <ThemedText style={styles.toggleDescription}>
                      {t('game.ui.showGuessResultsDescription', { locale })}
                    </ThemedText>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.toggleButton,
                      currentGame.showGuessResults && styles.toggleButtonActive
                    ]}
                    onPress={handleToggleShowGuessResults}
                    activeOpacity={0.8}
                  >
                    <Animated.View style={[
                      styles.toggleThumb,
                      currentGame.showGuessResults ? styles.toggleThumbActive : {},
                      {
                        transform: [{
                          translateX: showGuessResultsAnimation.interpolate({
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
                            {`${idx + 1}. `}{getDisplayName(participant.userName)}
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
                                {joinIndexById[participant.userId] ? `${joinIndexById[participant.userId]}. ` : `${getDisplayName(participant.userName)}`}
                                {participant.userId === currentGame.adminId && ' 👑'}
                                {participant.userId === user?.uid && ` ${t('game.ui.youLabel', { locale })}`}
                              </ThemedText>
                              <View style={styles.pointsRow}>
                                <ThemedText style={styles.pointsDetail}>
                                  {t('game.ui.pointsGame', { locale })}: {participant.gamePoints}
                                </ThemedText>
                                <ThemedText style={styles.pointsDetail}>
                                  {t('game.ui.pointsGuessing', { locale })}: {participant.guessPoints}
                                </ThemedText>
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
                      {t('game.ui.target', { locale })}: {currentGame.currentRound && joinIndexById[currentGame.currentRound.targetUserId] ? `${joinIndexById[currentGame.currentRound.targetUserId]}. ` : ''}{getDisplayName(currentGame.currentRound.targetUserName)}
                    </ThemedText>
                  </View>
                  {/* Admin controls - moved outside target view */}
                  {isAdmin && (
                    <View style={styles.adminControls}>
                      <View style={styles.adminButtonsRow}>
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
                    </View>
                  )}
                  {/* User is the target */}
                  {user?.uid === currentGame.currentRound.targetUserId && (
                    <View style={styles.targetView}>
                      {!currentGame.currentRound.commentsVisible ? (
                        <ThemedText style={styles.waitingText}>
                          {t('game.ui.waitingForCommentsAboutYou', { locale })}
                        </ThemedText>
                      ) : !currentGame.currentRound.pointsGiven ? (
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
                      ) : (
                        <ThemedText style={styles.waitingText}>
                          {t('game.ui.finishedAwardingPointsWaitAdmin', { locale })}
                        </ThemedText>
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
                                {t('game.ui.writeAnonymousCommentAbout', { locale, name: `${currentGame.currentRound && joinIndexById[currentGame.currentRound.targetUserId] ? `${joinIndexById[currentGame.currentRound.targetUserId]}. ` : ''}${getDisplayName(currentGame.currentRound.targetUserName)}` })}
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
                                  const hasCompletedPhase = currentGame.playersWhoCompletedPostCommentPhase?.includes(user?.uid || '') ?? false;
                                  return (
                                    <View style={{ marginTop: 16 }}>
                                      <ThemedText style={{ width: 'fit-content', alignSelf: 'center', color: 'white', textAlign: 'center', marginBottom: 8, backgroundColor: '#4CAF50', padding: 8, borderRadius: 8 }}>
                                      Готово
                                      </ThemedText>
                                      {/* Give points to target button */}
                                      {currentGame.currentRound.pointsGiven && !hasCompletedPhase && !alreadyGaveTargetPoints && (
                                        <TouchableOpacity
                                          style={[
                                            styles.submitCommentButton,
                                            {
                                              backgroundColor: '#4CAF50',
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
                                      {/* Skip button */}
                                      {currentGame.currentRound.pointsGiven && !hasCompletedPhase && !alreadyGaveTargetPoints && (
                                        <TouchableOpacity
                                          style={[
                                            styles.submitCommentButton,
                                            {
                                              backgroundColor: '#9E9E9E',
                                              shadowColor: '#000',
                                              marginTop: 8,
                                            },
                                          ]}
                                          onPress={handleSkipPostCommentPhase}
                                          activeOpacity={0.8}
                                        >
                                          <ThemedText style={styles.buttonText}>
                                            {currentGame.playersWhoCompletedPostCommentPhase?.includes(user?.uid || '') 
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
              )}
              {/* Guessing Phase UI */}
              {currentGame.status === 'guessing_phase' && currentGame.guessingData && (
                <View style={styles.gameFlowContainer}>
                  <View style={styles.roundInfo}>
                    <ThemedText type="subtitle" style={styles.roundTitle}>
                      {t('game.ui.guessAuthorsTitle', { locale })}
                    </ThemedText>
                    <ThemedText style={styles.targetText}>
                      {t('game.ui.guessAuthorsSubtitle', { locale })}
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
                            {t('game.ui.guessResultsTitle', { locale })}
                          </ThemedText>
                          <ThemedText style={styles.waitingText}>
                            {t('game.ui.waitingForAdminToComplete', { locale })}
                          </ThemedText>
                          {isAdmin && !currentGame.guessingData.allPlayersSubmitted && (
                            <ThemedText style={styles.waitingText}>
                              {t('game.ui.waitingForAllPlayers', { locale })}
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
                            {t('game.ui.guessingInstructions', { locale })}
                          </ThemedText>

                        {commentsForPlayer.map((comment) => {
                          const guessResult = getGuessResultDisplay(comment.id);
                          return (
                            <View key={comment.id} style={styles.guessCard}>
                              <ThemedText style={styles.commentText}>"{comment.text}"</ThemedText>

                              <ThemedText style={styles.guessPrompt}>
                                {t('game.ui.guessPrompt', { locale })}
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
                                        {joinIndexById[author.userId] ? `${joinIndexById[author.userId]}. ` : ''}{getDisplayName(author.userName)}
                                      </ThemedText>
                                  </TouchableOpacity>
                                ))}
                              </View>

                              {/* Show guess result feedback when enabled */}
                              {guessResult && (
                                <View style={styles.guessResultContainer}>
                                  <ThemedText style={[
                                    styles.guessResultText,
                                    guessResult.correct ? styles.guessResultCorrect : styles.guessResultIncorrect
                                  ]}>
                                    {guessResult.message}
                                  </ThemedText>
                                </View>
                              )}
                            </View>
                          );
                        })}

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
                        {t('game.ui.waitingForAdminToStartGuessing', { locale })}
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
              
              {/* Admin Fallback: Manual Post-Guessing Point Phase Start */}
              {isAdmin && (currentGame.status === 'guessing_phase' || currentGame.status === 'active') && currentGame.guessingData?.allPlayersSubmitted && !currentGame.postGuessingPointPhase && (
                <View style={styles.gameFlowContainer}>
                  <View style={styles.roundInfo}>
                    <ThemedText type="subtitle" style={styles.roundTitle}>
                      Admin: Start Point Awards
                    </ThemedText>
                    <ThemedText style={styles.targetText}>
                      All players have submitted guesses. Start the point awarding phase manually.
                    </ThemedText>
                  </View>
                  <View style={styles.adminControls}>
                    <TouchableOpacity
                      style={[
                        styles.adminButton,
                        {
                          backgroundColor: '#FF9800',
                          shadowColor: '#000',
                        },
                      ]}
                      onPress={handleStartPostGuessingPointPhase}
                      activeOpacity={0.8}
                    >
                      <IconSymbol name="star.fill" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              
              {/* Post-Guessing Point Awards Phase */}
              {((currentGame.status === 'guessing_phase' || currentGame.status === 'active') && currentGame.postGuessingPointPhase) && (
                <View style={styles.gameFlowContainer}>
                  <View style={styles.roundInfo}>
                    <ThemedText type="subtitle" style={styles.roundTitle}>
                      Award Points to Players
                    </ThemedText>
                    <ThemedText style={styles.targetText}>
                      Select players and award points for their performance
                    </ThemedText>
                  </View>
                  
                  {/* Check if user has already awarded points */}
                  {currentGame.playersWhoAwardedPostGuessPoints?.includes(user?.uid || '') ? (
                    <View style={styles.guessResultsContainer}>
                      <ThemedText type="subtitle" style={styles.guessResultsTitle}>
                        Points Already Awarded
                      </ThemedText>
                      <View style={styles.guessResultCard}>
                        <ThemedText style={styles.guessResultText}>
                          You have already awarded points in this phase.
                        </ThemedText>
                        <ThemedText style={styles.guessResultDetail}>
                          Wait for the next round to award points again.
                        </ThemedText>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.postGuessingPointsContainer}>
                      <ThemedText style={styles.guessingInstructions}>
                        Select any number of players and award them points. You can do this only once per round.
                      </ThemedText>

                      {/* Player selection list */}
                      <ScrollView style={styles.playersSelectionScroll} nestedScrollEnabled>
                        <View style={styles.playersSelectionList}>
                          {currentGame.participants
                            .filter(p => p.userId !== user?.uid) // Exclude self
                            .map((participant) => {
                              const isSelected = selectedPlayersForPoints[participant.userId] !== undefined;
                              const selectedPoints = selectedPlayersForPoints[participant.userId] || 0;
                              
                              return (
                                <View key={participant.userId} style={styles.playerSelectionItem}>
                                  <View style={styles.playerSelectionInfo}>
                                    <ThemedText style={styles.playerSelectionName}>
                                      {joinIndexById[participant.userId] ? `${joinIndexById[participant.userId]}. ` : ''}
                                      {getDisplayName(participant.userName)}
                                      {participant.userId === currentGame.adminId && ' 👑'}
                                    </ThemedText>
                                    <ThemedText style={styles.playerSelectionEmail}>
                                      {participant.userEmail}
                                    </ThemedText>
                                  </View>
                                  
                                  {/* Point selection buttons */}
                                  <View style={styles.pointButtonsContainer}>
                                    {[1, 2, 3].map(points => (
                                      <TouchableOpacity
                                        key={points}
                                        style={[
                                          styles.pointButton,
                                          isSelected && selectedPoints === points && styles.pointButtonSelected,
                                        ]}
                                        onPress={() => handlePlayerSelectForPoints(participant.userId, points)}
                                        activeOpacity={0.8}
                                      >
                                        <ThemedText style={[
                                          styles.pointButtonText,
                                          isSelected && selectedPoints === points && styles.pointButtonTextSelected,
                                        ]}>
                                          {points}
                                        </ThemedText>
                                      </TouchableOpacity>
                                    ))}
                                  </View>
                                </View>
                              );
                            })}
                        </View>
                      </ScrollView>

                      {/* Submit button */}
                      {Object.keys(selectedPlayersForPoints).length > 0 && (
                        <TouchableOpacity
                          style={[
                            styles.submitGuessButton,
                            {
                              backgroundColor: '#4CAF50',
                              shadowColor: '#000',
                            },
                            isAwardingPoints && styles.buttonDisabled,
                          ]}
                          onPress={handleAwardPointsToPlayers}
                          disabled={isAwardingPoints}
                          activeOpacity={0.8}
                        >
                          {isAwardingPoints ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <IconSymbol name="star.fill" size={16} color="#fff" />
                              <ThemedText style={styles.buttonText}>
                                Award Points ({Object.values(selectedPlayersForPoints).reduce((sum, points) => sum + points, 0)} total)
                              </ThemedText>
                            </>
                          )}
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              )}
              {currentGame.status === 'finished' && (
                <View style={styles.gameFlowContainer}>
                  {currentGame.adminLeft ? (
                    <>
                      <ThemedText type="title" style={styles.finishedTitle}>
                        {t('game.ui.adminLeftTitle', { locale })}
                      </ThemedText>
                      <ThemedText style={styles.finishedText}>
                        {t('game.ui.adminLeftMessage', { locale })}
                      </ThemedText>
                    </>
                  ) : (
                    <>
                      <ThemedText type="title" style={styles.finishedTitle}>
                        {t('game.ui.gameFinishedTitle', { locale })}
                      </ThemedText>
                      <ThemedText style={styles.finishedText}>
                        {t('game.ui.gameFinishedMessage', { locale })}
                      </ThemedText>
                      
                      {/* Final Leaderboard */}
                      <View style={styles.scoresContainer}>
                        <ThemedText type="subtitle" style={styles.scoresTitle}>
                          {t('game.ui.finalLeaderboardTitle', { locale })}
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
                                      {getDisplayName(participant.userName)}
                                      {participant.userId === currentGame.adminId && ' 👑'}
                                      {participant.userId === user?.uid && ' (Ви)'}
                                    </ThemedText>
                                    <View style={styles.pointsRow}>
                                      <ThemedText style={styles.pointsDetail}>
                                        Гра: {participant.gamePoints}
                                      </ThemedText>
                                      <ThemedText style={styles.pointsDetail}>
                                        Вгадування: {participant.guessPoints}
                                      </ThemedText>
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
                {/* <SoundToggle /> */}
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

      <FancyAlert
        visible={fancyVisible}
        title={fancyTitle}
        message={fancyMessage}
        buttons={fancyButtons}
        onClose={closeFancyAlert}
      />
      
      {/* Guess Result Modal */}
      {guessResultModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>
              {t('game.ui.guessResultsTitle', { locale })}
            </ThemedText>
            
            <ScrollView style={{ maxHeight: 400, width: '100%' }}>
              {guessResultModal.map((result, index) => (
                <View key={index} style={{ 
                  backgroundColor: result.correct ? '#E8F5E8' : '#FFEBEE', 
                  borderColor: result.correct ? '#34C759' : '#FF3B30',
                  borderWidth: 1,
                  borderRadius: 8,
                  padding: 16,
                  marginBottom: 12 
                }}>
                  <ThemedText style={{ 
                    fontSize: 16, 
                    fontWeight: '600', 
                    marginBottom: 8, 
                    textAlign: 'center',
                    color: result.correct ? '#34C759' : '#FF3B30'
                  }}>
                    {result.correct ? t('game.ui.correct', { locale }) : t('game.ui.incorrect', { locale })}
                  </ThemedText>
                  
                  <ThemedText style={{ 
                    fontSize: 14, 
                    fontStyle: 'italic', 
                    marginBottom: 12, 
                    textAlign: 'center' 
                  }}>
                    "{result.commentText}"
                  </ThemedText>
                  
                  <View style={{ 
                    flexDirection: 'row', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginBottom: 6 
                  }}>
                    <ThemedText style={{ 
                      fontSize: 14, 
                      opacity: 0.7 
                    }}>
                      {t('game.ui.actualAuthor', { locale })}:
                    </ThemedText>
                    <ThemedText style={{ 
                      fontSize: 14, 
                      fontWeight: '600', 
                      color: result.correct ? '#34C759' : '#FF3B30' 
                    }}>
                      {result.actualAuthorName}
                    </ThemedText>
                  </View>
                  
                  <View style={{ 
                    flexDirection: 'row', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    marginBottom: 8 
                  }}>
                    <ThemedText style={{ 
                      fontSize: 14, 
                      opacity: 0.7 
                    }}>
                      {t('game.ui.yourGuess', { locale })}:
                    </ThemedText>
                    <ThemedText style={{ 
                      fontSize: 14, 
                      fontWeight: '600' 
                    }}>
                      {result.guessedAuthorName}
                    </ThemedText>
                  </View>
                  
                  {/* Points Breakdown */}
                  {/* <View style={{ 
                    backgroundColor: 'rgba(0,0,0,0.05)', 
                    borderRadius: 6, 
                    padding: 12, 
                    marginTop: 8 
                  }}>
                    <ThemedText style={{ 
                      fontSize: 12, 
                      fontWeight: '600', 
                      marginBottom: 6, 
                      textAlign: 'center',
                      color: '#666'
                    }}>
                      {t('game.ui.pointsBreakdown', { locale })}
                    </ThemedText>
                    
                    <View style={{ 
                      flexDirection: 'row', 
                      justifyContent: 'space-between', 
                      marginBottom: 4 
                    }}>
                      <ThemedText style={{ fontSize: 12, opacity: 0.8 }}>
                        {t('game.ui.commentPoints', { locale })}:
                      </ThemedText>
                      <ThemedText style={{ fontSize: 12, fontWeight: '500' }}>
                        +{result.commentPoints}
                      </ThemedText>
                    </View>
                    
                    <View style={{ 
                      flexDirection: 'row', 
                      justifyContent: 'space-between', 
                      marginBottom: 4 
                    }}>
                      <ThemedText style={{ fontSize: 12, opacity: 0.8 }}>
                        {t('game.ui.guessPoints', { locale })}:
                      </ThemedText>
                      <ThemedText style={{ 
                        fontSize: 12, 
                        fontWeight: '500', 
                        color: result.guessPoints > 0 ? '#34C759' : '#FF3B30' 
                      }}>
                        {result.guessPoints > 0 ? `+${result.guessPoints}` : '0'}
                      </ThemedText>
                    </View>
                    
                    <View style={{ 
                      flexDirection: 'row', 
                      justifyContent: 'space-between', 
                      borderTopWidth: 1, 
                      borderTopColor: 'rgba(0,0,0,0.1)', 
                      paddingTop: 6 
                    }}>
                      <ThemedText style={{ fontSize: 12, fontWeight: '600', opacity: 0.8 }}>
                        {t('game.ui.totalForThisComment', { locale })}:
                      </ThemedText>
                      <ThemedText style={{ fontSize: 12, fontWeight: '700', color: '#4CAF50' }}>
                        +{result.totalPoints}
                      </ThemedText>
                    </View>
                  </View> */}
                </View>
              ))}
            </ScrollView>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#34C759' }]}
                onPress={() => setGuessResultModal(null)}
              >
                <ThemedText style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>OK</ThemedText>
              </TouchableOpacity>
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
  guessResultContainer: { marginTop: 16, alignItems: 'center' },
  guessResultText: { fontSize: 18, fontWeight: '600', textAlign: 'center', color: '#4CAF50', marginBottom: 8 },
  guessResultCorrect: { color: '#4CAF50' },
  guessResultIncorrect: { color: '#F44336' },
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
  modalMessage: { fontSize: 15, marginBottom: 16, textAlign: 'center' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  modalButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8, minWidth: 80, alignItems: 'center' },
  modalButtonDestructive: { backgroundColor: '#ff3b30' },
  modalButtonCancel: { backgroundColor: '#8e8e93' },
  modalButtonText: { fontSize: 16, fontWeight: '600' },
  modalButtonTextDestructive: { color: '#fff' },
  // Post-guessing point awards styles
  postGuessingPointsContainer: { marginTop: 16 },
  playersSelectionScroll: { maxHeight: 300, marginTop: 8 },
  playersSelectionList: { gap: 12 },
  playerSelectionItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginBottom: 8
  },
  playerSelectionInfo: { flex: 1, marginRight: 16 },
  playerSelectionName: { 
    fontSize: 16, 
    fontWeight: '600',
    marginBottom: 4
  },
  playerSelectionEmail: { 
    fontSize: 14, 
    opacity: 0.7
  },
  pointButtonsContainer: { 
    flexDirection: 'row', 
    gap: 8,
    alignItems: 'center'
  },
  pointButton: { 
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center'
  },
  pointButtonSelected: { 
    backgroundColor: '#4CAF50',
    borderColor: '#4CAF50'
  },
  pointButtonText: { 
    fontSize: 14, 
    fontWeight: '600',
    color: '#666'
  },
  pointButtonTextSelected: { 
    color: '#fff'
  },
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