import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signInWithPopup, signOut } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TouchableOpacity } from 'react-native';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Collapsible } from '@/components/ui/collapsible';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Fonts } from '@/constants/theme';

WebBrowser.maybeCompleteAuthSession();

const firebaseConfig = {
  apiKey: "AIzaSyDEXWXgE_Rx44YPhlnH7fIHMfHwmQsRQhI",
  authDomain: "spygame-2fce3.firebaseapp.com",
  projectId: "spygame-2fce3",
  storageBucket: "spygame-2fce3.appspot.com",
  messagingSenderId: "841856303776",
  appId: "1:841856303776:web:b580fb85f1e3e34c573fc5",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export default function TabTwoScreen() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);

  // Get the redirect URI for the current platform
  // For Android, we need to use Expo's proxy which provides an HTTPS URL
  // This ensures the redirect URI has a proper TLD (.io) that Google accepts
  const redirectUri = AuthSession.makeRedirectUri({
    useProxy: true, // Use Expo's proxy - generates https://auth.expo.io/@username/slug
  });

  // Verify the redirect URI is HTTPS (required by Google)
  useEffect(() => {
    console.log("Redirect URI:", redirectUri);

    if (Platform.OS === 'android' && redirectUri && !redirectUri.startsWith('https://')) {
      console.warn('WARNING: Redirect URI is not HTTPS. It should start with https://');
      console.warn('Current redirect URI:', redirectUri);
      console.warn('If you see exp:// or myapp://, the proxy might not be working.');
      console.warn('Make sure you are logged into Expo CLI: npx expo login');
    }
  }, [redirectUri]);

  // Log the redirect URI for debugging (especially useful for Android setup)
  useEffect(() => {
    if (Platform.OS === 'android') {
      console.log('Android Redirect URI:', redirectUri);
      
      if (redirectUri.startsWith('https://')) {
        console.log('✓ Redirect URI is HTTPS (valid for Google OAuth)');
        console.log('IMPORTANT: Add this exact URI to your WEB OAuth 2.0 Client ID:');
        console.log('1. Go to https://console.cloud.google.com/j');
        console.log('2. Select your project');
        console.log('3. Go to APIs & Services > Credentials');
        console.log('4. Click on your WEB OAuth 2.0 Client ID');
        console.log('5. Scroll down to "Authorized redirect URIs"');
        console.log('6. Click "ADD URI" and paste:', redirectUri);
        console.log('7. Click "SAVE"');
      } else {
        console.error('✗ Redirect URI is NOT HTTPS - this will not work with Google OAuth');
        console.error('The redirect URI must start with https:// and have a .com, .org, .io, etc. TLD');
        console.error('Current URI:', redirectUri);
        console.error('');
        console.error('SOLUTION: Make sure you are logged into Expo:');
        console.error('  Run: npx expo login');
        console.error('Then restart your app. The proxy should generate an https://auth.expo.io URL');
      }
      
      console.log('Make sure your OAuth consent screen is in "Testing" mode for development');
    }
  }, [redirectUri]);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: "627274303735-t5egjmpffjsg29qoco7nv7lqjlqlt02s.apps.googleusercontent.com",
    androidClientId: "726884000116-mfedbdu3fkb8knq3v6u8hequ0oab68s9.apps.googleusercontent.com",
    scopes: ['profile', 'email'],
    redirectUri,
  });

  useEffect(() => {
    if (response?.type === 'success' && Platform.OS !== 'web') {
      handleGoogleSignIn(response);
    }
  }, [response]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return unsubscribe;
  }, []);

  const handleGoogleSignIn = async (res) => {
    setLoading(true);
    try {
      // For web, use Firebase's signInWithPopup
      if (Platform.OS === 'web') {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        return;
      }

      // For native platforms (iOS/Android), use expo-auth-session response
      const idToken = res.authentication?.idToken;

      if (!idToken) {
        console.error("Response structure:", {
          authentication: res.authentication,
          params: res.params,
          fullResponse: res
        });
        throw new Error("ID token is missing");
      }

      const credential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, credential);
    } catch (error) {
      console.error('Auth error:', error.message);
      console.error('Full error details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignInPress = async () => {
    if (Platform.OS === 'web') {
      // For web, directly call handleGoogleSignIn which will use signInWithPopup
      await handleGoogleSignIn(null);
    } else {
      // For native, use expo-auth-session
      await promptAsync();
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={
        <IconSymbol
          size={310}
          color="#808080"
          name="chevron.left.forwardslash.chevron.right"
          style={styles.headerImage}
        />
      }>
      <ThemedView style={styles.titleContainer}>
        <ThemedText type="title" style={{ fontFamily: Fonts.rounded }}>
          Google Authentication !
        </ThemedText>
      </ThemedView>

      {user ? (
        <ThemedView style={styles.userContainer}>
          <ThemedText type="defaultSemiBold">Welcome, {user.displayName}!</ThemedText>
          <ThemedText>{user.email}</ThemedText>
          <TouchableOpacity style={styles.button} onPress={handleLogout}>
            <ThemedText style={styles.buttonText}>Sign Out</ThemedText>
          </TouchableOpacity>
        </ThemedView>
      ) : (
        <TouchableOpacity
          style={styles.button}
          onPress={handleSignInPress}
          disabled={(!request && Platform.OS !== 'web') || loading}>
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText style={styles.buttonText}>Sign in with Google</ThemedText>
          )}
        </TouchableOpacity>
      )}

      <Collapsible title="Setup Instructions">
        <ThemedText>1. Google OAuth credentials configured</ThemedText>
        <ThemedText>2. Web Client ID: 627274303735-t5egjmpffjsg29qoco7nv7lqjlqlt02s.apps.googleusercontent.com</ThemedText>
        <ThemedText>3. Firebase authentication enabled</ThemedText>
        {Platform.OS === 'android' && (
          <>
            <ThemedText style={{ marginTop: 8, fontWeight: 'bold' }}>Redirect URI to add:</ThemedText>
            <ThemedText style={{ fontSize: 12, fontFamily: 'monospace' }}>{redirectUri}</ThemedText>
            <ThemedText style={{ marginTop: 8, fontSize: 12, fontStyle: 'italic' }}>
              Add this to your WEB OAuth 2.0 Client ID (not Android) in Google Cloud Console:
            </ThemedText>
            <ThemedText style={{ fontSize: 11, marginTop: 4 }}>
              APIs & Services → Credentials → Web Client ID → Authorized redirect URIs
            </ThemedText>
          </>
        )}
      </Collapsible>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  userContainer: {
    padding: 16,
    marginVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  button: {
    backgroundColor: '#4285F4',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
