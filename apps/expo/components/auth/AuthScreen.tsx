import { LanguageSelector } from "@/components/LanguageSelector";
import { SoundToggle } from "@/components/SoundToggle";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { FancyAlert, FancyAlertButton } from "@/components/ui/FancyAlert";
import { HeaderLogo } from "@/components/ui/HeaderLogo";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Colors, Fonts, GameColors, themedInput } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useSound } from "@/contexts/SoundContext";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { t } from "@/i18n";
import { mapFirebaseAuthErrorToKey } from "@mirror/shared";
import { GoogleSigninButton } from "@react-native-google-signin/google-signin";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const AuthScreen: React.FC = () => {
  const { signIn, signOut, user, loading, isSignedIn, registerWithEmail, signInWithEmail, resetPassword } = useAuth();
  const { locale } = useLanguage();
  const { playSound } = useSound();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
  const inputTheme = themedInput(isDark);

  const [authMode, setAuthMode] = useState<'signin' | 'register' | 'forgot'>('signin');
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [resetEmailInput, setResetEmailInput] = useState('');
  const [isSubmittingEmailForm, setIsSubmittingEmailForm] = useState(false);

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

  const handleEmailSignIn = async () => {
    if (!emailInput.trim() || !passwordInput) {
      showFancyAlert(t("auth.signInErrorTitle", { locale }), t("auth.errorFieldsRequired", { locale }));
      return;
    }
    try {
      setIsSubmittingEmailForm(true);
      await playSound("click");
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await signInWithEmail(emailInput.trim(), passwordInput);
      await playSound("success");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: unknown) {
      await playSound("error");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t("auth.signInErrorTitle", { locale }), t(mapFirebaseAuthErrorToKey(error), { locale }));
    } finally {
      setIsSubmittingEmailForm(false);
    }
  };

  const handleRegister = async () => {
    if (!displayNameInput.trim()) {
      showFancyAlert(t("auth.signInErrorTitle", { locale }), t("auth.errorDisplayNameRequired", { locale }));
      return;
    }
    if (!emailInput.trim() || !passwordInput) {
      showFancyAlert(t("auth.signInErrorTitle", { locale }), t("auth.errorFieldsRequired", { locale }));
      return;
    }
    if (passwordInput.length < 6) {
      showFancyAlert(t("auth.signInErrorTitle", { locale }), t("auth.errorWeakPassword", { locale }));
      return;
    }
    if (passwordInput !== confirmPasswordInput) {
      showFancyAlert(t("auth.signInErrorTitle", { locale }), t("auth.errorPasswordMismatch", { locale }));
      return;
    }
    try {
      setIsSubmittingEmailForm(true);
      await playSound("click");
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await registerWithEmail(emailInput.trim(), passwordInput, displayNameInput.trim());
      await playSound("success");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: unknown) {
      await playSound("error");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert(t("auth.signInErrorTitle", { locale }), t(mapFirebaseAuthErrorToKey(error), { locale }));
    } finally {
      setIsSubmittingEmailForm(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmailInput.trim()) {
      showFancyAlert(t("auth.signInErrorTitle", { locale }), t("auth.errorInvalidEmail", { locale }));
      return;
    }
    try {
      setIsSubmittingEmailForm(true);
      await resetPassword(resetEmailInput.trim());
      showFancyAlert(
        t("auth.resetPasswordSentTitle", { locale }),
        t("auth.resetPasswordSent", { locale }),
        [{ text: t("common.ok", { locale }), onPress: () => setAuthMode("signin") }],
      );
    } catch (error: unknown) {
      showFancyAlert(t("auth.signInErrorTitle", { locale }), t(mapFirebaseAuthErrorToKey(error), { locale }));
    } finally {
      setIsSubmittingEmailForm(false);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.signInScreen}>
        <View style={[styles.headerBlock, { paddingTop: insets.top + 12 }]}>
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
        <ScrollView
          style={styles.signInScroll}
          contentContainerStyle={styles.signInScrollContent}
        >
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
        </ScrollView>
      </ThemedView>
    );
  }

  if (isSignedIn && user) {
    return (
      <ThemedView style={styles.signInScreen}>
        <View style={[styles.headerBlock, { paddingTop: insets.top + 12 }]}>
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
        <ScrollView
          style={styles.signInScroll}
          contentContainerStyle={styles.signInScrollContent}
        >
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
        </ScrollView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.signInScreen}>
      <View style={[styles.signInTopBar, { paddingTop: insets.top + 12 }]}>
        <LanguageSelector />
      </View>
      <FancyAlert
        visible={fancyVisible}
        title={fancyTitle}
        message={fancyMessage}
        buttons={fancyButtons}
        onClose={closeFancyAlert}
      />
      <ScrollView
        style={styles.signInScroll}
        contentContainerStyle={styles.signInScrollContent}
        keyboardShouldPersistTaps="handled"
      >
      <View style={styles.signInContainer}>
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <HeaderLogo />
          <ThemedText type="title" style={styles.welcomeTitle}>
            {t("auth.welcome", { locale })}!
          </ThemedText>
          <ThemedText type="subtitle" style={styles.welcomeSubtitle}>
            {t("auth.continue", { locale })}
          </ThemedText>
        </View>

        {authMode === "forgot" ? (
          <View style={styles.emailFormContainer}>
            <TextInput
              style={[styles.input, inputTheme.style]}
              value={resetEmailInput}
              onChangeText={setResetEmailInput}
              placeholder={t("auth.email", { locale })}
              placeholderTextColor={inputTheme.placeholderTextColor}
              autoCapitalize="none"
              keyboardType="email-address"
              testID="reset-email-input"
            />
            <TouchableOpacity
              style={[styles.emailSubmitButton, { backgroundColor: GameColors.blue, shadowColor: GameColors.shadow }]}
              onPress={handleResetPassword}
              disabled={isSubmittingEmailForm}
              activeOpacity={0.8}
              testID="send-reset-button"
            >
              {isSubmittingEmailForm ? (
                <ActivityIndicator size="small" color={GameColors.white} />
              ) : (
                <ThemedText style={styles.emailSubmitButtonText}>{t("auth.sendResetEmail", { locale })}</ThemedText>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setAuthMode("signin")} testID="back-to-signin-link">
              <ThemedText style={styles.modeLinkText}>{t("auth.backToSignIn", { locale })}</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.modeToggleRow}>
              <TouchableOpacity onPress={() => setAuthMode("signin")} testID="signin-tab">
                <ThemedText
                  style={[styles.modeToggleText, authMode === "signin" && styles.modeToggleTextActive]}
                >
                  {t("auth.signIn", { locale })}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAuthMode("register")} testID="register-tab">
                <ThemedText
                  style={[styles.modeToggleText, authMode === "register" && styles.modeToggleTextActive]}
                >
                  {t("auth.register", { locale })}
                </ThemedText>
              </TouchableOpacity>
            </View>

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
                      backgroundColor: GameColors.green,
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

            <ThemedText style={styles.orDivider}>{t("common.or", { locale })}</ThemedText>

            <View style={styles.emailFormContainer}>
              {authMode === "register" && (
                <TextInput
                  style={[styles.input, inputTheme.style]}
                  value={displayNameInput}
                  onChangeText={setDisplayNameInput}
                  placeholder={t("auth.displayNamePlaceholder", { locale })}
                  placeholderTextColor={inputTheme.placeholderTextColor}
                  testID="display-name-input"
                />
              )}
              <TextInput
                style={[styles.input, inputTheme.style]}
                value={emailInput}
                onChangeText={setEmailInput}
                placeholder={t("auth.email", { locale })}
                placeholderTextColor={inputTheme.placeholderTextColor}
                autoCapitalize="none"
                keyboardType="email-address"
                testID="email-input"
              />
              <TextInput
                style={[styles.input, inputTheme.style]}
                value={passwordInput}
                onChangeText={setPasswordInput}
                placeholder={t("auth.password", { locale })}
                placeholderTextColor={inputTheme.placeholderTextColor}
                secureTextEntry
                testID="password-input"
              />
              {authMode === "register" && (
                <TextInput
                  style={[styles.input, inputTheme.style]}
                  value={confirmPasswordInput}
                  onChangeText={setConfirmPasswordInput}
                  placeholder={t("auth.confirmPassword", { locale })}
                  placeholderTextColor={inputTheme.placeholderTextColor}
                  secureTextEntry
                  testID="confirm-password-input"
                />
              )}
              <TouchableOpacity
                style={[styles.emailSubmitButton, { backgroundColor: GameColors.blue, shadowColor: GameColors.shadow }]}
                onPress={authMode === "register" ? handleRegister : handleEmailSignIn}
                disabled={isSubmittingEmailForm}
                activeOpacity={0.8}
                testID={authMode === "register" ? "register-submit-button" : "email-signin-submit-button"}
              >
                {isSubmittingEmailForm ? (
                  <ActivityIndicator size="small" color={GameColors.white} />
                ) : (
                  <ThemedText style={styles.emailSubmitButtonText}>
                    {authMode === "register" ? t("auth.registerWithEmail", { locale }) : t("auth.signInWithEmail", { locale })}
                  </ThemedText>
                )}
              </TouchableOpacity>
              {authMode === "signin" && (
                <TouchableOpacity onPress={() => setAuthMode("forgot")} testID="forgot-password-link">
                  <ThemedText style={styles.modeLinkText}>{t("auth.forgotPassword", { locale })}</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>
      </ScrollView>
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
  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginTop: 20,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: "auto",
  },
  loadingText: {
    marginTop: 16,
  },
  signInScreen: {
    flex: 1,
  },
  headerBlock: {
    alignItems: "center",
    paddingHorizontal: 20,
  },
  signInTopBar: {
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  signInScroll: {
    flex: 1,
    width: "100%",
  },
  // Children centre themselves with marginVertical "auto": centred when the
  // content fits, and (unlike justifyContent: "center") never pushed above
  // the top of the scroll area when it doesn't.
  signInScrollContent: {
    flexGrow: 1,
    alignItems: "center",
    padding: 20,
  },
  signInContainer: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    marginVertical: "auto",
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
  modeToggleRow: {
    flexDirection: "row",
    gap: 24,
    marginBottom: 20,
  },
  modeToggleText: {
    fontSize: 16,
    fontFamily: Fonts.sans,
    opacity: 0.5,
    paddingBottom: 4,
  },
  modeToggleTextActive: {
    opacity: 1,
    fontWeight: "700",
    borderBottomWidth: 2,
    borderBottomColor: GameColors.blue,
  },
  emailFormContainer: {
    width: "100%",
    gap: 12,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: Fonts.sans,
  },
  emailSubmitButton: {
    width: "100%",
    height: 50,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
  emailSubmitButtonText: {
    color: GameColors.white,
    fontSize: 16,
    fontWeight: "600",
    fontFamily: Fonts.sans,
  },
  modeLinkText: {
    fontSize: 13,
    opacity: 0.7,
    textAlign: "center",
    fontFamily: Fonts.sans,
  },
  orDivider: {
    opacity: 0.5,
    marginBottom: 16,
    fontFamily: Fonts.sans,
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
    backgroundColor: GameColors.green,
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
    marginVertical: "auto",
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
