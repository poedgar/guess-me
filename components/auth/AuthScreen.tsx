import { LanguageSelector } from '@/components/LanguageSelector';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Fonts } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { t } from '@/i18n';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const AuthScreen: React.FC = () => {
  const { signIn, signOut, user, loading, isSignedIn } = useAuth();
  const { locale } = useLanguage();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  // Fancy alert state
  const [fancyVisible, setFancyVisible] = useState(false);
  const [fancyTitle, setFancyTitle] = useState<string | null>(null);
  const [fancyMessage, setFancyMessage] = useState<string | null>(null);
  const [fancyButtons, setFancyButtons] = useState<Array<{ text: string; onPress?: () => void; style?: any }>>([]);

  const showFancyAlert = (title: string, message?: string | null, buttons?: Array<{ text: string; onPress?: () => void; style?: any }>) => {
    setFancyTitle(title);
    setFancyMessage(message ?? null);
    setFancyButtons(buttons && buttons.length > 0 ? buttons : [{ text: 'ОК' }]);
    setFancyVisible(true);
  };

  const closeFancyAlert = () => {
    setFancyVisible(false);
  };

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await signIn();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert('Помилка входу', error.message || 'Не вдалося увійти. Спробуйте ще раз.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      showFancyAlert(t('auth.signOutConfirmTitle', { locale }), t('auth.signOutConfirmMessage', { locale }), [
        { text: t('common.cancel', { locale }), style: 'cancel' },
        {
          text: t('auth.signOut', { locale }),
          style: 'destructive',
          onPress: async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await signOut();
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]);
    } catch (error: any) {
      showFancyAlert('Помилка виходу', error.message || 'Не вдалося вийти. Спробуйте ще раз.');
    }
  };

  // Render fancy alert modal (shared across all states)
  const renderFancyAlert = () => (
    fancyVisible && (
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
    )
  );

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.languageToggle, { top: insets.top + 12 }]}>
          <LanguageSelector />
        </View>
        {renderFancyAlert()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDark ? Colors.dark.tint : Colors.light.tint} />
          <ThemedText type="subtitle" style={styles.loadingText}>
            {t('common.loading', { locale })}
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (isSignedIn && user) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.languageToggle, { top: insets.top + 12 }]}>
          <LanguageSelector />
        </View>
        {renderFancyAlert()}
        <View style={styles.profileContainer}>
          {/* Profile Picture */}
          <View style={[styles.avatarContainer, { shadowColor: isDark ? '#000' : '#000' }]}>
            {user.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: Colors.light.tint }]}>
                <ThemedText type="title" style={styles.avatarText}>
                  {user.displayName?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
                </ThemedText>
              </View>
            )}
          </View>

          {/* User Info */}
          <ThemedText type="title" style={styles.userName}>
            {user.displayName || t('auth.userFallback', { locale })}
          </ThemedText>
          <ThemedText type="subtitle" style={styles.userEmail}>
            {user.email}
          </ThemedText>

          {/* Sign Out Button */}
          <TouchableOpacity
            style={[
              styles.signOutButton,
              {
                backgroundColor: isDark ? '#ff3b30' : '#ff3b30',
                shadowColor: '#000',
              },
            ]}
            onPress={handleSignOut}
            activeOpacity={0.8}
          >
            <IconSymbol name="door.left.hand.open" size={16} color="#fff" />
            <ThemedText style={styles.signOutButtonText}>{t('auth.signOut', { locale })}</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.languageToggle, { top: insets.top + 12 }]}>
        <LanguageSelector />
      </View>
      {renderFancyAlert()}
      <View style={styles.signInContainer}>
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <ThemedText type="title" style={styles.welcomeTitle}>
            {t('auth.welcome', { locale })}!
          </ThemedText>
          <ThemedText type="subtitle" style={styles.welcomeSubtitle}>
            {t('auth.continue', { locale })}
          </ThemedText>
        </View>

        {/* Google Sign-In Button */}
        <View style={styles.buttonContainer}>
          {isSigningIn ? (
            <View style={styles.loadingButton}>
              <ActivityIndicator size="small" color="#fff" />
              <IconSymbol name="hourglass" size={16} color="#fff" style={{ marginLeft: 8 }} />
            </View>
          ) : Platform.OS === 'web' ? (
            <TouchableOpacity
              style={[
                styles.webGoogleButton,
                {
                  backgroundColor: '#4285F4',
                  shadowColor: '#000',
                },
              ]}
              onPress={handleSignIn}
              disabled={isSigningIn}
              activeOpacity={0.8}
            >
              <View style={styles.webGoogleButtonContent}>
                <View style={styles.webGoogleIcon}>
                  <IconSymbol name="lock.shield" size={20} color="#4285F4" />
                </View>
                <ThemedText style={styles.webGoogleButtonText}>
                  {t('auth.signInWithGoogle', { locale })}
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  languageToggle: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 50,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  signInContainer: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  welcomeTitle: {
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    opacity: 0.7,
    textAlign: 'center',
  },
  buttonContainer: {
    width: '100%',
    alignItems: 'center',
  },
  googleButton: {
    width: '100%',
    height: 50,
  },
  webGoogleButton: {
    width: '100%',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
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
        cursor: 'pointer',
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      },
    }),
  },
  webGoogleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webGoogleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
    backgroundColor: '#fff',
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webGoogleIconText: {
    color: '#4285F4',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Fonts.sans,
  },
  webGoogleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: Fonts.sans,
  },
  loadingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4285F4',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    width: '100%',
    height: 50,
  },
  loadingButtonText: {
    color: '#fff',
    marginLeft: 12,
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Fonts.sans,
  },
  profileContainer: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
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
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#fff',
  },
  avatarText: {
    color: '#fff',
    fontSize: 48,
    fontFamily: Fonts.sans,
  },
  userName: {
    marginBottom: 8,
    fontFamily: Fonts.sans,
    textAlign: 'center',
  },
  userEmail: {
    opacity: 0.7,
    marginBottom: 32,
    textAlign: 'center',
    fontFamily: Fonts.sans,
  },
  signOutButton: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    minWidth: 200,
    alignItems: 'center',
    justifyContent: 'center',
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
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Fonts.sans,
  },
  // Fancy alert styles
  fancyModalOverlay: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: 'rgba(0,0,0,0.5)' 
  },
  fancyModal: { 
    width: '85%', 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    padding: 20, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 8 }, 
    shadowOpacity: 0.2, 
    shadowRadius: 16, 
    elevation: 10 
  },
  fancyTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    marginBottom: 8, 
    textAlign: 'center', 
    fontFamily: Fonts.sans 
  },
  fancyMessage: { 
    fontSize: 15, 
    opacity: 0.9, 
    marginBottom: 16, 
    textAlign: 'center', 
    fontFamily: Fonts.sans 
  },
  fancyButtonsRow: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end' 
  },
  fancyButton: { 
    paddingVertical: 10, 
    paddingHorizontal: 14, 
    borderRadius: 8, 
    marginLeft: 8 
  },
  fancyButtonText: { 
    fontSize: 15, 
    color: '#007AFF', 
    fontWeight: '700', 
    fontFamily: Fonts.sans 
  },
  fancyDestructiveButton: {},
  fancyDestructiveButtonText: { 
    color: '#D9534F' 
  },
});