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
  });
});
