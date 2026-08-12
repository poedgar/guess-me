const FIREBASE_AUTH_ERROR_CODE_TO_KEY: Record<string, string> = {
  'auth/email-already-in-use': 'auth.errorEmailInUse',
  'auth/weak-password': 'auth.errorWeakPassword',
  'auth/wrong-password': 'auth.errorWrongPassword',
  'auth/invalid-credential': 'auth.errorWrongPassword',
  'auth/user-not-found': 'auth.errorUserNotFound',
  'auth/invalid-email': 'auth.errorInvalidEmail',
  'auth/too-many-requests': 'auth.errorTooManyRequests',
};

/**
 * Maps a thrown Firebase Auth error to a locale key for a user-facing
 * message. Returns the key only — callers translate it with their own
 * platform's t(). Unrecognized codes fall back to the existing generic
 * sign-in-failure key already used for Google Sign-In errors.
 */
export function mapFirebaseAuthErrorToKey(error: unknown): string {
  const code = (error as { code?: string } | null | undefined)?.code;
  return (code && FIREBASE_AUTH_ERROR_CODE_TO_KEY[code]) || 'auth.signInErrorMessage';
}
