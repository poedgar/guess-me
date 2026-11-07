import { LanguageSelector } from "@/components/LanguageSelector";
import { SoundToggle } from "@/components/SoundToggle";
import { ThemedText } from "@/components/themed-text";
import { FancyAlertButton } from "@/components/ui/FancyAlert";
import { HeaderLogo } from "@/components/ui/HeaderLogo";
import { GameColors } from "@/constants/theme";
import { Game } from "@/contexts/GameContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { t } from "@/i18n";
import React from "react";
import { StyleSheet, View } from "react-native";

export type ShowFancyAlertFn = (
  title: string,
  message?: string | null,
  buttons?: FancyAlertButton[],
  customContent?: React.ReactNode,
) => void;

interface Props {
  game: Game;
  isAdmin: boolean;
  onCopyGameId: () => void;
}

export const GameHeader: React.FC<Props> = ({
  game,
  isAdmin,
  onCopyGameId,
}) => {
  const { locale } = useLanguage();

  return (
    <View style={styles.gameHeader}>
      <HeaderLogo variant="icon" />
      <View style={styles.gameHeaderRight}>
        <LanguageSelector />
        <SoundToggle />
        {isAdmin && (
          <View style={styles.adminBadge}>
            <ThemedText style={styles.adminBadgeText}>
              {t("game.ui.adminBadge", { locale })}
            </ThemedText>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  gameHeader: {
    alignItems: "center",
    marginBottom: 24,
  },
  gameHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    marginBottom: 30,
  },
  adminBadge: {
    height: "max-content",
    backgroundColor: GameColors.waiting,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 12,
  },
  adminBadgeText: { color: GameColors.white, fontSize: 8, fontWeight: "700" },
});
