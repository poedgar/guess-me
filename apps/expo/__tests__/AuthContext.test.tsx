import { act, renderHook } from '@testing-library/react-native';
import React from 'react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

const mockOnAuthStateChanged = require('firebase/auth').onAuthStateChanged;
const mockSignInWithPopup = require('firebase/auth').signInWithPopup;
const mockFirebaseSignOut = require('firebase/auth').signOut;
const mockGoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;

// resetMocks: true wipes mock implementations each test, so onAuthStateChanged would
// return undefined — AuthContext tries to call its return value as unsubscribe().
// Restore a safe default before every test.
beforeEach(() => {
  mockOnAuthStateChanged.mockImplementation((_auth: any, callback: (u: any) => void) => {
    callback(null);
    return jest.fn(); // unsubscribe
  });
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe('AuthContext', () => {
  describe('useAuth', () => {
    it('throws when used outside AuthProvider', () => {
      expect(() => renderHook(() => useAuth())).toThrow(
        'useAuth must be used within an AuthProvider'
      );
    });
  });

  describe('AuthProvider', () => {
    it('provides initial state: user null, loading true then false', async () => {
      // onAuthStateChanged mock immediately calls callback with null
      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(result.current.user).toBeNull();
      expect(result.current.isSignedIn).toBe(false);
      expect(result.current.loading).toBe(false); // mock fires synchronously
    });

    it('sets user when onAuthStateChanged fires with a user', async () => {
      const fakeUser = { uid: 'abc123', displayName: 'Test User', email: 'test@example.com' };
      mockOnAuthStateChanged.mockImplementationOnce((_auth: any, callback: (user: any) => void) => {
        callback(fakeUser);
        return jest.fn();
      });

      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(result.current.user).toEqual(fakeUser);
      expect(result.current.isSignedIn).toBe(true);
      expect(result.current.loading).toBe(false);
    });

    it('keeps user null when onAuthStateChanged fires with null', async () => {
      mockOnAuthStateChanged.mockImplementationOnce((_auth: any, callback: (user: any) => void) => {
        callback(null);
        return jest.fn();
      });

      const { result } = renderHook(() => useAuth(), { wrapper });
      expect(result.current.user).toBeNull();
      expect(result.current.isSignedIn).toBe(false);
    });

    it('signIn calls signInWithPopup on web', async () => {
      const { Platform } = require('react-native');
      Platform.OS = 'web';
      mockSignInWithPopup.mockResolvedValueOnce({ user: { uid: 'web-user' } });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signIn();
      });

      expect(mockSignInWithPopup).toHaveBeenCalled();
    });

    it('signIn calls GoogleSignin on native', async () => {
      const { Platform } = require('react-native');
      Platform.OS = 'android';
      const { signInWithCredential, GoogleAuthProvider } = require('firebase/auth');
      signInWithCredential.mockResolvedValueOnce({ user: { uid: 'native-user' } });
      GoogleAuthProvider.credential = jest.fn(() => ({}));
      mockGoogleSignin.signIn.mockResolvedValueOnce({
        data: { idToken: 'fake-token' },
      });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signIn();
      });

      expect(mockGoogleSignin.signIn).toHaveBeenCalled();
    });

    it('signOut calls firebaseSignOut', async () => {
      mockFirebaseSignOut.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signOut();
      });

      expect(mockFirebaseSignOut).toHaveBeenCalled();
    });

    it('signIn rethrows errors', async () => {
      const { Platform } = require('react-native');
      Platform.OS = 'web';
      mockSignInWithPopup.mockRejectedValueOnce(new Error('popup closed'));

      const { result } = renderHook(() => useAuth(), { wrapper });

      await expect(
        act(async () => {
          await result.current.signIn();
        })
      ).rejects.toThrow('popup closed');
    });

    it('registerWithEmail calls createUserWithEmailAndPassword then updateProfile with the display name', async () => {
      const { createUserWithEmailAndPassword, updateProfile } = require('firebase/auth');
      const fakeUser = { uid: 'new-user' };
      createUserWithEmailAndPassword.mockResolvedValueOnce({ user: fakeUser });
      updateProfile.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.registerWithEmail('alice@example.com', 'password123', 'Alice');
      });

      expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(), 'alice@example.com', 'password123',
      );
      expect(updateProfile).toHaveBeenCalledWith(fakeUser, { displayName: 'Alice' });
    });

    it('registerWithEmail rethrows errors without calling updateProfile', async () => {
      const { createUserWithEmailAndPassword, updateProfile } = require('firebase/auth');
      createUserWithEmailAndPassword.mockRejectedValueOnce(
        Object.assign(new Error('email in use'), { code: 'auth/email-already-in-use' }),
      );
      updateProfile.mockClear();

      const { result } = renderHook(() => useAuth(), { wrapper });

      await expect(
        act(async () => {
          await result.current.registerWithEmail('taken@example.com', 'password123', 'Bob');
        })
      ).rejects.toThrow('email in use');
      expect(updateProfile).not.toHaveBeenCalled();
    });

    it('signInWithEmail calls signInWithEmailAndPassword', async () => {
      const { signInWithEmailAndPassword } = require('firebase/auth');
      signInWithEmailAndPassword.mockResolvedValueOnce({ user: { uid: 'existing-user' } });

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.signInWithEmail('alice@example.com', 'password123');
      });

      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        expect.anything(), 'alice@example.com', 'password123',
      );
    });

    it('signInWithEmail rethrows errors', async () => {
      const { signInWithEmailAndPassword } = require('firebase/auth');
      signInWithEmailAndPassword.mockRejectedValueOnce(
        Object.assign(new Error('wrong password'), { code: 'auth/wrong-password' }),
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await expect(
        act(async () => {
          await result.current.signInWithEmail('alice@example.com', 'wrong');
        })
      ).rejects.toThrow('wrong password');
    });

    it('resetPassword calls sendPasswordResetEmail', async () => {
      const { sendPasswordResetEmail } = require('firebase/auth');
      sendPasswordResetEmail.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useAuth(), { wrapper });

      await act(async () => {
        await result.current.resetPassword('alice@example.com');
      });

      expect(sendPasswordResetEmail).toHaveBeenCalledWith(expect.anything(), 'alice@example.com');
    });

    it('resetPassword rethrows errors', async () => {
      const { sendPasswordResetEmail } = require('firebase/auth');
      sendPasswordResetEmail.mockRejectedValueOnce(
        Object.assign(new Error('no user'), { code: 'auth/user-not-found' }),
      );

      const { result } = renderHook(() => useAuth(), { wrapper });

      await expect(
        act(async () => {
          await result.current.resetPassword('nobody@example.com');
        })
      ).rejects.toThrow('no user');
    });
  });
});
