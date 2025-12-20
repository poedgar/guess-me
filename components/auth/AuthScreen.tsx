import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

export const AuthScreen: React.FC = () => {
  const { signIn, signOut, user, loading, isSignedIn } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await signIn();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error: any) {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert(
        'Sign In Error',
        error.message || 'Failed to sign in. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign Out',
            style: 'destructive',
            onPress: async () => {
              await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await signOut();
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            },
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Sign Out Error', error.message || 'Failed to sign out. Please try again.');
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDark ? Colors.dark.tint : Colors.light.tint} />
          <ThemedText type="subtitle" style={styles.loadingText}>
            Loading...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (isSignedIn && user) {
    return (
      <ThemedView style={styles.container}>
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
            {user.displayName || 'User'}
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
            <ThemedText style={styles.signOutButtonText}>Sign Out</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.signInContainer}>
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <ThemedText type="title" style={styles.welcomeTitle}>
            Welcome!
          </ThemedText>
          <ThemedText type="subtitle" style={styles.welcomeSubtitle}>
            Sign in to continue
          </ThemedText>
        </View>

        {/* Google Sign-In Button */}
        <View style={styles.buttonContainer}>
          {isSigningIn ? (
            <View style={styles.loadingButton}>
              <ActivityIndicator size="small" color="#fff" />
              <ThemedText style={styles.loadingButtonText}>Signing in...</ThemedText>
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
                  <ThemedText style={styles.webGoogleIconText}>G</ThemedText>
                </View>
                <ThemedText style={styles.webGoogleButtonText}>
                  Sign in with Google
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
  },
  webGoogleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
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
  },
  userName: {
    marginBottom: 8,
    textAlign: 'center',
  },
  userEmail: {
    opacity: 0.7,
    marginBottom: 32,
    textAlign: 'center',
  },
  signOutButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    minWidth: 200,
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
    }),
  },
  signOutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

