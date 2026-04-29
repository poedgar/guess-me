import { LanguageSelector } from "@/components/LanguageSelector";
import { SoundToggle } from "@/components/SoundToggle";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { FancyAlert, FancyAlertButton } from "@/components/ui/FancyAlert";
import { HeaderLogo } from "@/components/ui/HeaderLogo";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { LoginAnimation } from "@/components/ui/LoginAnimation";
import { Colors, Fonts, GameColors } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { t } from "@/i18n";
import { GoogleSigninButton } from "@react-native-google-signin/google-signin";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const AuthScreen: React.FC = () => {
  const { signIn, signOut, user, loading, isSignedIn } = useAuth();
  const { locale } = useLanguage();
  const { playSound } = useSound();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();

  // Fancy alert state
  const [fancyVisible, setFancyVisible] = useState(false);
  const [fancyTitle, setFancyTitle] = useState<string | null>(null);
  const [fancyMessage, setFancyMessage] = useState<string | null>(null);
  const [fancyButtons, setFancyButtons] = useState<FancyAlertButton[]>([]);

  const showFancyAlert = (
    title: string,
    message?: string | null,
    buttons?: FancyAlertButton[],
  ) => {
    setFancyTitle(title);
    setFancyMessage(message ?? null);
    setFancyButtons(
      buttons && buttons.length > 0
        ? buttons
        : [{ text: t("common.ok", { locale }) }],
    );
    setFancyVisible(true);
  };

  const closeFancyAlert = () => setFancyVisible(false);

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      await playSound("click");
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await signIn();
      await playSound("success");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: unknown) {
      await playSound("error");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(
        t("auth.signInErrorTitle", { locale }),
        (error instanceof Error && error.message) || t("auth.signInErrorMessage", { locale }),
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      showFancyAlert(
        t("auth.signOutConfirmTitle", { locale }),
        t("auth.signOutConfirmMessage", { locale }),
        [
          { text: t("common.cancel", { locale }), style: "cancel" },
          {
            text: t("auth.signOut", { locale }),
            style: "destructive",
            onPress: async () => {
              await playSound("click");
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await signOut();
              await playSound("success");
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success,
              );
            },
          },
        ],
      );
    } catch (error: unknown) {
      showFancyAlert(
        t("auth.signOutErrorTitle", { locale }),
        (error instanceof Error && error.message) || t("auth.signOutErrorMessage", { locale }),
      );
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.logoBlock, { top: insets.top + 12 }]}>
          <HeaderLogo />
          <View style={styles.controls}>
            <LanguageSelector />
            <SoundToggle />
          </View>
        </View>
        <FancyAlert
          visible={fancyVisible}
          title={fancyTitle}
          message={fancyMessage}
          buttons={fancyButtons}
          onClose={closeFancyAlert}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            testID="loading-indicator"
            size="large"
            color={isDark ? Colors.dark.tint : Colors.light.tint}
          />
          <ThemedText type="subtitle" style={styles.loadingText}>
            {t("common.loading", { locale })}
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (isSignedIn && user) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.logoBlock, { top: insets.top + 12 }]}>
          <HeaderLogo />
          <View style={styles.controls}>
            <LanguageSelector />
            <SoundToggle />
          </View>
        </View>
        <FancyAlert
          visible={fancyVisible}
          title={fancyTitle}
          message={fancyMessage}
          buttons={fancyButtons}
          onClose={closeFancyAlert}
        />
        <View style={styles.profileContainer}>
          {/* Profile Picture */}
          <View
            style={[styles.avatarContainer, { shadowColor: GameColors.shadow }]}
          >
            {user.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatar} />
            ) : (
              <View
                style={[
                  styles.avatarPlaceholder,
                  { backgroundColor: Colors.light.tint },
                ]}
              >
                <ThemedText type="title" style={styles.avatarText}>
                  {user.displayName?.charAt(0).toUpperCase() ||
                    user.email?.charAt(0).toUpperCase() ||
                    "U"}
                </ThemedText>
              </View>
            )}
          </View>

          {/* User Info */}
          <ThemedText type="title" style={styles.userName}>
            {user.displayName || t("auth.userFallback", { locale })}
          </ThemedText>
          <ThemedText type="subtitle" style={styles.userEmail}>
            {user.email}
          </ThemedText>

          {/* Sign Out Button */}
          <TouchableOpacity
            style={[
              styles.signOutButton,
              {
                backgroundColor: GameColors.danger,
                shadowColor: GameColors.shadow,
              },
            ]}
            onPress={handleSignOut}
            activeOpacity={0.8}
          >
            <IconSymbol
              name="door.left.hand.open"
              size={16}
              color={GameColors.white}
            />
            <ThemedText style={styles.signOutButtonText}>
              {t("auth.signOut", { locale })}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.logoBlock, { top: insets.top + 12 }]}>
        <HeaderLogo />
        <View style={styles.controls}>
          <LanguageSelector />
        </View>
      </View>
      <FancyAlert
        visible={fancyVisible}
        title={fancyTitle}
        message={fancyMessage}
        buttons={fancyButtons}
        onClose={closeFancyAlert}
      />
      <View style={styles.signInContainer}>
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <LoginAnimation />
          <ThemedText type="title" style={styles.welcomeTitle}>
            {t("auth.welcome", { locale })}!
          </ThemedText>
          <ThemedText type="subtitle" style={styles.welcomeSubtitle}>
            {t("auth.continue", { locale })}
          </ThemedText>
        </View>

        {/* Google Sign-In Button */}
        <View style={styles.buttonContainer}>
          {isSigningIn ? (
            <View style={styles.loadingButton}>
              <ActivityIndicator size="small" color={GameColors.white} />
              <IconSymbol
                name="hourglass"
                size={16}
                color={GameColors.white}
                style={{ marginLeft: 8 }}
              />
            </View>
          ) : Platform.OS === "web" ? (
            <TouchableOpacity
              style={[
                styles.webGoogleButton,
                {
                  backgroundColor: GameColors.blue,
                  shadowColor: GameColors.shadow,
                },
              ]}
              onPress={handleSignIn}
              disabled={isSigningIn}
              activeOpacity={0.8}
            >
              <View style={styles.webGoogleButtonContent}>
                <View style={styles.webGoogleIcon}>
                  <IconSymbol
                    name="lock.shield"
                    size={16}
                    color={GameColors.blue}
                  />
                </View>
                <ThemedText style={styles.webGoogleButtonText}>
                  {t("auth.signInWithGoogle", { locale })}
                </ThemedText>
              </View>
            </TouchableOpacity>
          ) : (
            <GoogleSigninButton
              style={styles.googleButton}
              size={GoogleSigninButton.Size.Wide}
              color={GoogleSigninButton.Color.Dark}
              onPress={handleSignIn}
              disabled={isSigningIn}
            />
          )}
        </View>
      </View>
    </ThemedView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  logoBlock: {
    position: "absolute",
    width: "100%",
    alignItems: "center",
    zIndex: 50,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: -70,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 16,
  },
  signInContainer: {
    flex: 1,
    justifyContent: "center",
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    marginTop: 80,
  },
  welcomeSection: {
    alignItems: "center",
    marginBottom: 48,
  },
  welcomeTitle: {
    marginBottom: 8,
    textAlign: "center",
  },
  welcomeSubtitle: {
    opacity: 0.7,
    textAlign: "center",
  },
  buttonContainer: {
    width: "100%",
    alignItems: "center",
  },
  googleButton: {
    width: "100%",
    height: 50,
  },
  webGoogleButton: {
    width: "100%",
    height: 50,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
      web: {
        cursor: "pointer",
        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
      },
    }),
  },
  webGoogleButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  webGoogleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
    backgroundColor: GameColors.white,
    borderRadius: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  webGoogleButtonText: {
    color: GameColors.white,
    fontSize: 16,
    fontWeight: "500",
    fontFamily: Fonts.sans,
  },
  loadingButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GameColors.blue,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: "100%",
    height: 50,
  },
  profileContainer: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
  },
  avatarContainer: {
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: GameColors.white,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 4,
    borderColor: GameColors.white,
  },
  avatarText: {
    color: GameColors.white,
    fontSize: 48,
    fontFamily: Fonts.sans,
  },
  userName: {
    marginBottom: 8,
    fontFamily: Fonts.sans,
    textAlign: "center",
  },
  userEmail: {
    opacity: 0.7,
    marginBottom: 32,
    textAlign: "center",
    fontFamily: Fonts.sans,
  },
  signOutButton: {
    flexDirection: "row",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    minWidth: 200,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  signOutButtonText: {
    color: GameColors.white,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
});
