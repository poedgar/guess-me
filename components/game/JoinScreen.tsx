import { LanguageSelector } from "@/components/LanguageSelector";
import { SoundToggle } from "@/components/SoundToggle";
import { ThemedText } from "@/components/themed-text";
import { HeaderLogo } from "@/components/ui/HeaderLogo";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { SuccessAnimation } from "@/components/ui/SuccessAnimation";
import { Colors, Fonts, GameColors } from "@/constants/theme";
import { useGame } from "@/contexts/GameContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { t } from "@/i18n";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Clipboard,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ShowFancyAlertFn } from "./GameHeader";

interface Props {
  isSignedIn: boolean;
  isDark: boolean;
  showFancyAlert: ShowFancyAlertFn;
  showFaceMessage: (message: string, face?: string) => void;
}

export const JoinScreen: React.FC<Props> = ({
  isSignedIn,
  isDark,
  showFancyAlert,
  showFaceMessage,
}) => {
  const { locale } = useLanguage();
  const { playSound } = useSound();
  const { enterGame, loading } = useGame();
  const [gameIdInput, setGameIdInput] = useState("");
  const [isProcessingEnter, setIsProcessingEnter] = useState(false);

  const handleEnterGame = async () => {
    if (!isSignedIn) {
      showFancyAlert(
        t("game.alerts.loginRequiredTitle", { locale }),
        t("game.alerts.loginRequiredMessage", { locale }),
      );
      return;
    }

    const input = gameIdInput.trim();
    if (!input) {
      showFancyAlert(
        t("game.alerts.invalidInputTitle", { locale }),
        t("game.alerts.invalidInputMessage", { locale }),
      );
      return;
    }

    try {
      setIsProcessingEnter(true);
      await playSound("click");
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const result = await enterGame(input, false);

      await playSound("success");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (typeof result === "string") {
        const gameId = result;
        setGameIdInput("");
        showFancyAlert(
          t("game.alerts.gameCreatedTitle", { locale }),
          t("game.alerts.gameCreatedMessage", { locale, gameId }),
          [
            {
              text: t("game.alerts.copyId", { locale }),
              onPress: async () => {
                await playSound("copy");
                Clipboard.setString(gameId);
                showFancyAlert(
                  t("game.alerts.copiedTitle", { locale }),
                  t("game.alerts.copiedMessage", { locale }),
                );
              },
            },
            { text: t("common.ok", { locale }) },
          ],
          <View style={{ padding: 16 }}>
            <SuccessAnimation />
          </View>,
        );
      } else {
        setGameIdInput("");
        //showFancyAlert(t('common.success', { locale }), t('game.alerts.joinedGameMessage', { locale }));
        showFaceMessage(
          t("game.alerts.joinedGameMessage", { locale }),
          <View style={{ padding: 16 }}>
            <SuccessAnimation />
          </View>,
        );
      }
    } catch (error: any) {
      await playSound("error");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      // showFancyAlert(t('common.error', { locale }), error.message || t('game.alerts.enterGameFailed', { locale }));
      // setFaceMessage({
      //     visible: true,
      //     message: t('common.error', { locale }), error.message || t('game.alerts.enterGameFailed', { locale }),
      //     face: '🎉',
      //   });
    } finally {
      setIsProcessingEnter(false);
    }
  };

  if (!isSignedIn) {
    return (
      <View style={styles.notSignedInContainer}>
        <View style={styles.logoBlock}>
          <HeaderLogo />
          <View style={styles.controls}>
            <LanguageSelector />
          </View>
        </View>
        <ThemedText type="title" style={styles.notSignedInText}>
          {t("game.ui.pleaseSignIn", { locale })}
        </ThemedText>
      </View>
    );
  }

  return (
    <>
      <View style={styles.logoBlock}>
        <HeaderLogo />
        <View style={styles.controls}>
          <LanguageSelector />
          <SoundToggle />
        </View>
      </View>
      <View style={styles.actionContainer}>
        <View style={styles.section}>
          <ThemedText type="title" style={styles.sectionTitle}>
            {t("game.ui.createOrJoin.title", { locale })}
          </ThemedText>
          <ThemedText style={styles.sectionDescription}>
            {t("game.ui.createOrJoin.description", { locale })}
          </ThemedText>

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: isDark
                  ? GameColors.inputDark
                  : GameColors.inputLight,
                color: isDark ? Colors.dark.text : Colors.light.text,
                borderColor: isDark
                  ? GameColors.inputBorderDark
                  : GameColors.inputBorderLight,
              },
            ]}
            placeholder={t("game.ui.createOrJoin.inputPlaceholder", { locale })}
            placeholderTextColor={
              isDark ? GameColors.placeholderDark : GameColors.placeholderLight
            }
            value={gameIdInput}
            onChangeText={setGameIdInput}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[
              styles.joinButton,
              {
                backgroundColor: GameColors.green,
                shadowColor: GameColors.shadow,
              },
              (isProcessingEnter || loading || !gameIdInput.trim()) &&
                styles.buttonDisabled,
            ]}
            onPress={handleEnterGame}
            disabled={isProcessingEnter || loading || !gameIdInput.trim()}
            activeOpacity={0.8}
          >
            {isProcessingEnter ? (
              <View style={styles.buttonLoading}>
                <ActivityIndicator size="small" color={GameColors.white} />
              </View>
            ) : (
              <IconSymbol
                name="arrow.right.circle.fill"
                size={16}
                color={GameColors.white}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  notSignedInContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  notSignedInText: { textAlign: "center", opacity: 0.7 },
  actionContainer: { marginTop: 16 },
  logoBlock: {
    alignItems: "center",
    marginBottom: 8,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: -50,
    marginBottom: 30,
  },
  section: { marginBottom: 32 },
  sectionTitle: { marginBottom: 8 },
  sectionDescription: {
    opacity: 0.7,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Fonts.sans,
  },
  input: {
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    fontFamily: Fonts.sans,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  joinButton: {
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: "center",
    alignSelf: "center",
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  buttonDisabled: { opacity: 0.6 },
  buttonLoading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
});
