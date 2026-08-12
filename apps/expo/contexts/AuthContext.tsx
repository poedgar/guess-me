import { auth } from '@/config/firebase';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
  User,
} from 'firebase/auth';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';

type GoogleSignInResponse =
  | { data: { idToken: string | null } }
  | { idToken: string | null };

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  isSignedIn: boolean;
  registerWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Configure Google Sign-In only for native platforms
    if (Platform.OS !== 'web') {
      GoogleSignin.configure({
        webClientId: "841856303776-n0qnohvvtecnmgj9a8dk2q0s16k820ol.apps.googleusercontent.com",
        iosClientId: "841856303776-sq4b4lurs12lg1cnb6hm4qkh381kk007.apps.googleusercontent.com",
        scopes: ['profile', 'email'],
        offlineAccess: true,
        forceCodeForRefreshToken: false,
      });
    }

    // Listen to auth state changes
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    try {
      setLoading(true);
      
      if (Platform.OS === 'web') {
        // Use Firebase web authentication for web platform
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      } else {
        // Use native Google Sign-In for iOS/Android
        // Check if device has Google Play Services (Android only)
        if (Platform.OS === 'android') {
          await GoogleSignin.hasPlayServices();
        }
        
        // Get user info from Google Sign-In
        const response = await GoogleSignin.signIn() as GoogleSignInResponse;
        const idToken = 'data' in response ? response.data.idToken : response.idToken;
        
        if (!idToken) {
          throw new Error('No ID token received from Google Sign-In');
        }
        
        // Create a Google credential with the token
        const googleCredential = GoogleAuthProvider.credential(idToken);
        
        // Sign in the user with the credential
        await signInWithCredential(auth, googleCredential);
      }
    } catch (error: unknown) {
      console.error('Sign-in error:', error);
      setLoading(false);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      // Sign out from Firebase
      await firebaseSignOut(auth);
      // Sign out from Google Sign-In (native only)
      if (Platform.OS !== 'web') {
        await GoogleSignin.signOut();
      }
    } catch (error: unknown) {
      console.error('Sign-out error:', error);
      setLoading(false);
      throw error;
    }
  };

  const registerWithEmail = async (email: string, password: string, displayName: string) => {
    try {
      setLoading(true);
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName });
      // onAuthStateChanged fires from this write and resets loading, same as signIn().
    } catch (error: unknown) {
      console.error('Register error:', error);
      setLoading(false);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: unknown) {
      console.error('Email sign-in error:', error);
      setLoading(false);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error: unknown) {
      console.error('Password reset error:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signOut,
    isSignedIn: !!user,
    registerWithEmail,
    signInWithEmail,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};