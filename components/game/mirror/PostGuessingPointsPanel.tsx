import { ThemedText } from "@/components/themed-text";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { SuccessAnimation } from "@/components/ui/SuccessAnimation";
import { TargetControlPanel } from "@/components/ui/TargetControlPanel";
import { Fonts, GameColors } from "@/constants/theme";
import { gameStyles } from '../gameStyles';
import { Game, Participant, useGame } from "@/contexts/GameContext";
import { useSound } from "@/contexts/SoundContext";
import { t } from "@/i18n";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { ShowFancyAlertFn } from "../GameHeader";

interface Props {
  game: Game;
  isAdmin: boolean;
  user: { uid: string } | null;
  participantsByJoin: Participant[];
  joinIndexById: Record<string, number>;
  getDisplayName: (name: string) => string;
  showFancyAlert: ShowFancyAlertFn;
  showFaceMessage?: (message: string, face?: React.ReactNode) => void;
  locale: string;
}

const PostGuessingPointsPanel: React.FC<Props> = ({
  game,
  isAdmin,
  user,
  participantsByJoin,
  joinIndexById,
  getDisplayName,
  showFancyAlert,
  showFaceMessage,
  locale,
}) => {
  const { playSound } = useSound();
  const { startPostGuessingPointPhase, awardPointsToPlayers } = useGame();

  const [selectedPlayersForPoints, setSelectedPlayersForPoints] = useState<
    Record<string, number>
  >({});
  const [isAwardingPoints, setIsAwardingPoints] = useState(false);
  const [isStartingPhase, setIsStartingPhase] = useState(false);

  const handleStartPostGuessingPointPhase = async () => {
    if (!isAdmin) return;
    try {
      setIsStartingPhase(true);
      await playSound("click");
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await startPostGuessingPointPhase();
      await playSound("success");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFaceMessage?.(
        t("game.alerts.postGuessingStarted", { locale }),
        <View style={{ padding: 16 }}>
          <SuccessAnimation />
        </View>,
      );
    } catch (error: unknown) {
      await playSound("error");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(
        t("common.error", { locale }),
        (error instanceof Error && error.message) || t("game.alerts.postGuessingStartFailed", { locale }),
      );
    } finally {
      setIsStartingPhase(false);
    }
  };

  const handlePlayerSelectForPoints = (playerId: string, points: number) => {
    setSelectedPlayersForPoints((prev) => {
      if (prev[playerId] === points) {
        const newSelection = { ...prev };
        delete newSelection[playerId];
        return newSelection;
      } else {
        return { ...prev, [playerId]: points };
      }
    });
  };

  const handleAwardPointsToPlayers = async () => {
    if (!game || !user || !isAdmin) return;
    try {
      setIsAwardingPoints(true);
      await playSound("click");
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const awards = Object.entries(selectedPlayersForPoints).map(
        ([playerId, points]) => ({
          recipientId: playerId,
          points,
        }),
      );

      if (awards.length === 0) {
        showFancyAlert(
          t("common.error", { locale }),
          t("game.alerts.selectAtLeastOnePlayer", { locale }),
        );
        return;
      }

      await awardPointsToPlayers(awards);
      await playSound("points");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFaceMessage?.(
        t("game.alerts.pointsAwardedSuccessfully", { locale }),
        <View style={{ padding: 16 }}>
          <SuccessAnimation />
        </View>,
      );
      setSelectedPlayersForPoints({});
    } catch (error: unknown) {
      await playSound("error");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(
        t("common.error", { locale }),
        (error instanceof Error && error.message) || t("game.alerts.awardPointsFailed", { locale }),
      );
    } finally {
      setIsAwardingPoints(false);
    }
  };

  // Admin fallback: show "Start Point Awards" button when target submitted guesses but phase not started
  if (
    isAdmin &&
    game.currentRound?.targetUserId &&
    game.guessingData?.playersWhoSubmittedGuesses?.includes(
      game.currentRound.targetUserId,
    ) &&
    !game.postGuessingPointPhase
  ) {
    return (
      <View style={gameStyles.gameFlowContainer}>
        {/* Admin Target Control */}
        <TargetControlPanel locale={locale} showFancyAlert={showFancyAlert} />

        <View style={styles.roundInfo}>
          <ThemedText type="subtitle" style={styles.roundTitle}>
            {t("game.ui.postGuessing.startPhaseTitle", { locale })}
          </ThemedText>
          <ThemedText style={styles.targetText}>
            {t("game.ui.postGuessing.startPhaseDesc", { locale })}
          </ThemedText>
        </View>
        <View style={styles.adminControls}>
          <TouchableOpacity
            style={[
              styles.adminButton,
              {
                backgroundColor: GameColors.admin,
                shadowColor: GameColors.shadow,
              },
              isStartingPhase && gameStyles.buttonDisabled,
            ]}
            onPress={handleStartPostGuessingPointPhase}
            disabled={isStartingPhase}
            activeOpacity={0.8}
            accessibilityLabel={t("game.ui.postGuessing.startPhaseTitle", { locale })}
            accessibilityRole="button"
          >
            {isStartingPhase
              ? <ActivityIndicator size="small" color={GameColors.white} />
              : <IconSymbol name="star.fill" size={16} color={GameColors.white} />}
            <ThemedText style={styles.buttonText}>{t("game.ui.postGuessing.startPhaseTitle", { locale })}</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Post-Guessing Point Awards Phase
  if (!game.postGuessingPointPhase) return null;

  if (!isAdmin) return null;

  return (
    <View style={gameStyles.gameFlowContainer}>
      <View style={styles.roundInfo}>
        <ThemedText type="subtitle" style={styles.roundTitle}>
          {t("game.ui.postGuessing.awardTitle", { locale })}
        </ThemedText>
        <ThemedText style={styles.targetText}>
          {t("game.ui.postGuessing.awardDesc", { locale })}
        </ThemedText>
      </View>

      {game.playersWhoAwardedPostGuessPoints?.includes(user?.uid || "") ? (
        <View style={styles.guessResultsContainer}>
          <ThemedText type="subtitle" style={styles.guessResultsTitle}>
            {t("game.ui.postGuessing.alreadyAwardedTitle", { locale })}
          </ThemedText>
          <View style={styles.guessResultCard}>
            <ThemedText style={styles.guessResultText}>
              {t("game.ui.postGuessing.alreadyAwardedText", { locale })}
            </ThemedText>
            <ThemedText style={styles.guessResultDetail}>
              {t("game.ui.postGuessing.waitNextRound", { locale })}
            </ThemedText>
          </View>
        </View>
      ) : (
        <View style={styles.postGuessingPointsContainer}>
          <ThemedText style={styles.guessingInstructions}>
            {t("game.ui.postGuessing.instructions", { locale })}
          </ThemedText>

          <ScrollView style={styles.playersSelectionScroll} nestedScrollEnabled>
            <View style={styles.playersSelectionList}>
              {game.participants
                .filter((p) => p.userId !== user?.uid)
                .map((participant) => {
                  const isSelected =
                    selectedPlayersForPoints[participant.userId] !== undefined;
                  const selectedPoints =
                    selectedPlayersForPoints[participant.userId] || 0;

                  return (
                    <View
                      key={participant.userId}
                      style={styles.playerSelectionItem}
                    >
                      <PlayerAvatar name={participant.userName} photoURL={participant.photoURL} size={32} />
                      <View style={styles.playerSelectionInfo}>
                        <ThemedText style={styles.playerSelectionName}>
                          {joinIndexById[participant.userId]
                            ? `${joinIndexById[participant.userId]}. `
                            : ""}
                          {getDisplayName(participant.userName)}
                          {participant.userId === game.adminId && " 👑"}
                        </ThemedText>
                        <ThemedText style={styles.playerSelectionEmail}>
                          {participant.userEmail}
                        </ThemedText>
                      </View>

                      <View style={styles.pointButtonsContainer}>
                        {[-3, -2, -1, 1, 2, 3].map((points) => (
                          <TouchableOpacity
                            key={points}
                            style={[
                              styles.pointButton,
                              points < 0 && styles.pointButtonNegative,
                              isSelected &&
                                selectedPoints === points &&
                                (points < 0
                                  ? styles.pointButtonNegativeSelected
                                  : styles.pointButtonSelected),
                            ]}
                            onPress={() =>
                              handlePlayerSelectForPoints(
                                participant.userId,
                                points,
                              )
                            }
                            activeOpacity={0.8}
                          >
                            <ThemedText
                              style={[
                                styles.pointButtonText,
                                points < 0 && { color: GameColors.negative },
                                isSelected &&
                                  selectedPoints === points &&
                                  styles.pointButtonTextSelected,
                              ]}
                            >
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

          {Object.keys(selectedPlayersForPoints).length > 0 && (
            <TouchableOpacity
              style={[
                styles.submitGuessButton,
                {
                  backgroundColor: GameColors.green,
                  shadowColor: GameColors.shadow,
                },
                isAwardingPoints && gameStyles.buttonDisabled,
              ]}
              onPress={handleAwardPointsToPlayers}
              disabled={isAwardingPoints}
              activeOpacity={0.8}
            >
              {isAwardingPoints ? (
                <ActivityIndicator size="small" color={GameColors.white} />
              ) : (
                <>
                  <IconSymbol
                    name="star.fill"
                    size={16}
                    color={GameColors.white}
                  />
                  <ThemedText style={styles.buttonText}>
                    {t("game.ui.postGuessing.awardButton", { locale, total: (Object.values(selectedPlayersForPoints) as number[]).reduce((sum, points) => sum + points, 0) })}
                  </ThemedText>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
};

export default PostGuessingPointsPanel;

const styles = StyleSheet.create({
  roundInfo: {
    marginBottom: 20,
    padding: 16,
    borderRadius: 8,
    backgroundColor: GameColors.cardBg,
  },
  roundTitle: { marginBottom: 8, textAlign: "center", fontFamily: Fonts.sans },
  targetText: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  adminControls: { marginTop: 24 },
  adminButton: {
    flexDirection: 'row',
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  buttonText: {
    color: GameColors.white,
    fontSize: 15,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  guessResultsContainer: { marginTop: 16, alignItems: "center" },
  guessResultsTitle: { marginBottom: 16, textAlign: "center" },
  guessResultCard: {
    padding: 20,
    borderRadius: 8,
    backgroundColor: GameColors.cardBg,
    alignItems: "center",
    width: "100%",
  },
  guessResultText: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    color: GameColors.green,
    marginBottom: 8,
  },
  guessResultDetail: { fontSize: 14, textAlign: "center", opacity: 0.8 },
  postGuessingPointsContainer: { marginTop: 16 },
  guessingInstructions: {
    fontSize: 16,
    marginBottom: 20,
    lineHeight: 24,
    fontFamily: Fonts.sans,
  },
  playersSelectionScroll: { maxHeight: 300, marginTop: 8 },
  playersSelectionList: { gap: 12 },
  playerSelectionItem: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 16,
    borderRadius: 8,
    backgroundColor: GameColors.cardBg,
    marginBottom: 8,
  },
  playerSelectionInfo: { flex: 1, marginRight: 16 },
  playerSelectionName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  playerSelectionEmail: {
    fontSize: 14,
    opacity: 0.7,
  },
  pointButtonsContainer: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  pointButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: GameColors.cardBg,
    borderWidth: 1,
    borderColor: GameColors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  pointButtonSelected: {
    backgroundColor: GameColors.green,
    borderColor: GameColors.green,
  },
  pointButtonNegative: {
    backgroundColor: "rgba(255, 0, 0, 0.1)",
    borderColor: "rgba(255, 0, 0, 0.3)",
  },
  pointButtonNegativeSelected: {
    backgroundColor: GameColors.negative,
    borderColor: GameColors.negative,
  },
  pointButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: GameColors.textMedium,
  },
  pointButtonTextSelected: {
    color: GameColors.white,
  },
  submitGuessButton: {
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: "center",
    alignSelf: "center",
    flexDirection: "row",
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
});
