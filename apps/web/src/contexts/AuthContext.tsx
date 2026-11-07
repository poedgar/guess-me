import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, GoogleAuthProviderInstance } from '@mirror/shared';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  User,
} from 'firebase/auth';

// Exposes email/password sign-in on `window` for Cypress E2E tests. The
// production UI only offers Google sign-in (Cypress can't drive a real
// Google OAuth popup reliably), so this is the hook tests use instead.
// This adds no capability beyond what signInWithEmailAndPassword already
// does — no bypass, no elevated access — it's just not surfaced in the UI.
declare global {
  interface Window {
    __cypressSignInWithEmail?: (email: string, password: string) => Promise<void>;
  }
}

if (typeof window !== 'undefined') {
  window.__cypressSignInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };
}

interface AuthContextType {
  user: User | null;
  isSignedIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
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
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsSignedIn(!!currentUser);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async () => {
    try {
      const provider = new GoogleAuthProviderInstance();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Sign-in error:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Sign-out error:', error);
      throw error;
    }
  };

  const registerWithEmail = async (email: string, password: string, displayName: string) => {
    let credential;
    try {
      credential = await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Register error:', error);
      throw error;
    }
    try {
      await updateProfile(credential.user, { displayName });
    } catch (error) {
      // The account was already created (and the user signed in via
      // onAuthStateChanged) by this point — a display-name write failure is
      // not a registration failure, so it must not be surfaced through the
      // same error path signIn/register failures use.
      console.error('Failed to set display name after registration:', error);
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Email sign-in error:', error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, isSignedIn, signIn, signOut, registerWithEmail, signInWithEmail, resetPassword }}
    >
      {children}
    </AuthContext.Provider>
  );
};
