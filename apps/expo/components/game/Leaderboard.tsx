import { ThemedText } from "@/components/themed-text";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { Fonts, GameColors } from "@/constants/theme";
import { Game } from "@/contexts/GameContext";
import { t } from "@/i18n";
import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";

interface Props {
  game: Game;
  user: { uid: string } | null;
  joinIndexById: Record<string, number>;
  getDisplayName: (name: string) => string;
  locale: string;
  title: string;
  scrollHeight?: number;
}

export const Leaderboard: React.FC<Props> = ({
  game,
  user,
  joinIndexById,
  getDisplayName,
  locale,
  title,
  scrollHeight = 200,
}) => {
  const participantsWithScores = game.participants
    .filter((p) => (game.adminWritesComments ?? false) || p.userId !== game.adminId)
    .map((p) => {
      const gamePoints = game.scores?.[p.userId] || 0;
      const guessPoints = game.guessResults?.[p.userId]?.correctGuesses || 0;
      return {
        ...p,
        gamePoints,
        guessPoints,
        totalPoints: gamePoints + guessPoints,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <View style={styles.container}>
      <ThemedText type="subtitle" style={styles.title}>
        {title}
      </ThemedText>
      <ScrollView
        style={[styles.scroll, { maxHeight: scrollHeight }]}
        nestedScrollEnabled
      >
        <View style={styles.list} accessibilityRole="list">
          {participantsWithScores.map((participant, index) => (
            <View
              key={participant.userId}
              style={[
                styles.item,
                index === 0 && styles.itemFirst,
                participant.userId === user?.uid && styles.itemCurrentUser,
              ]}
            >
              <View style={styles.rank}>
                {index === 0 && (
                  <ThemedText style={styles.rankEmoji}>🥇</ThemedText>
                )}
                {index === 1 && (
                  <ThemedText style={styles.rankEmoji}>🥈</ThemedText>
                )}
                {index === 2 && (
                  <ThemedText style={styles.rankEmoji}>🥉</ThemedText>
                )}
                {index > 2 && (
                  <ThemedText style={styles.rankNumber}>
                    #{index + 1}
                  </ThemedText>
                )}
              </View>
              <PlayerAvatar
                name={participant.userName}
                photoURL={participant.photoURL}
                size={28}
              />
              <View style={styles.info}>
                <ThemedText style={styles.name}>
                  {joinIndexById[participant.userId]
                    ? `${joinIndexById[participant.userId]}. `
                    : ""}
                  {getDisplayName(participant.userName)}
                  {participant.userId === game.adminId && " 👑"}
                  {participant.userId === user?.uid &&
                    ` ${t("game.ui.youLabel", { locale })}`}
                </ThemedText>
                <View style={styles.pointsRow}>
                  <ThemedText style={styles.pointsDetail}>
                    {t("game.ui.pointsGame", { locale })}:{" "}
                    {participant.gamePoints}
                  </ThemedText>
                  <ThemedText style={styles.pointsDetail}>
                    {t("game.ui.pointsGuessing", { locale })}:{" "}
                    {participant.guessPoints}
                  </ThemedText>
                </View>
              </View>
              <View
                style={styles.points}
                accessibilityLabel={`${participant.totalPoints} ${t("game.ui.pointsTotal", { locale })}`}
              >
                <ThemedText
                  style={styles.pointsValue}
                  accessibilityElementsHidden
                >
                  {participant.totalPoints}
                </ThemedText>
                <ThemedText
                  style={styles.pointsLabel}
                  accessibilityElementsHidden
                >
                  {t("game.ui.pointsTotal", { locale })}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

export const leaderboardStyles = StyleSheet.create({
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: GameColors.cardBg,
  },
  itemFirst: {
    backgroundColor: GameColors.goldTint,
    borderWidth: 2,
    borderColor: GameColors.goldTintBorder,
  },
  itemCurrentUser: {
    backgroundColor: GameColors.blueTint,
    borderWidth: 1,
    borderColor: GameColors.blueTintBorder,
  },
});

const styles = StyleSheet.create({
  container: { marginBottom: 24, marginTop: 8 },
  title: { marginBottom: 16, textAlign: "center", fontFamily: Fonts.sans },
  scroll: { marginTop: 8 },
  list: { borderRadius: 8, overflow: "hidden" },
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: GameColors.cardBg,
  },
  itemFirst: {
    backgroundColor: GameColors.goldTint,
    borderWidth: 2,
    borderColor: GameColors.goldTintBorder,
  },
  itemCurrentUser: {
    backgroundColor: GameColors.blueTint,
    borderWidth: 1,
    borderColor: GameColors.blueTintBorder,
  },
  rank: { width: 40, alignItems: "center", justifyContent: "center" },
  rankEmoji: { fontSize: 24 },
  rankNumber: { fontSize: 14, fontWeight: "600", opacity: 0.6 },
  info: { flex: 1, marginLeft: 12 },
  name: { fontSize: 16, fontWeight: "600" },
  pointsRow: { marginTop: 4, flexDirection: "row", flexWrap: "wrap" },
  pointsDetail: { fontSize: 12, opacity: 0.8, marginRight: 8 },
  points: { alignItems: "flex-end" },
  pointsValue: { fontSize: 20, fontWeight: "700", color: GameColors.green },
  pointsLabel: { fontSize: 12, opacity: 0.6, marginTop: 2 },
});
