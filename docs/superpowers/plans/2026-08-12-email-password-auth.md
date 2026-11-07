# Email/Password Sign-In & Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users register and sign in with email + password, alongside the existing Google Sign-In, on both `apps/web` and `apps/expo`.

**Architecture:** Three new `AuthContext` methods per app (`registerWithEmail`, `signInWithEmail`, `resetPassword`), a shared error-code-to-locale-key mapping utility in `packages/shared`, new locale strings, and a Sign In / Register mode toggle added to each app's existing `AuthScreen.tsx`. No Firestore or security-rule changes — the rest of the app already treats any signed-in `user` uniformly regardless of provider.

**Tech Stack:** React Native + Expo (apps/expo), React + Vite (apps/web), Firebase Auth (`firebase/auth`), Jest + React Testing Library (apps/expo), Cypress (apps/web).

## Global Constraints

- Firebase's email/password provider is already enabled on the project — `apps/web/src/contexts/AuthContext.tsx` already imports and uses `signInWithEmailAndPassword` for a Cypress-only test hook (`window.__cypressSignInWithEmail`). That hook and `apps/web/cypress/support/commands.ts`'s `signInAsTestUser` are **not to be modified or removed** — they're load-bearing for the entire existing E2E suite's session-caching/validation logic. New Cypress coverage for the new UI is additive only.
- New `AuthContext` methods throw raw errors on failure (matching the existing `signIn`/`signOut` convention) — no error-message mapping inside the context. The UI layer maps errors to locale-keyed messages via the shared `mapFirebaseAuthErrorToKey` utility.
- No email verification step, no account-linking flow, no password strength rules beyond Firebase's own 6-character minimum — all explicitly out of scope per the spec.
- Locale strings live in one shared place: `packages/shared/src/locales/en.json` and `.../uk.json` — both apps import from `@mirror/shared`.
- Spec reference: `docs/superpowers/specs/2026-08-12-email-password-auth-design.md`.

---

### Task 1: Shared — locale strings + auth error-mapping utility

**Files:**
- Modify: `packages/shared/src/locales/en.json`
- Modify: `packages/shared/src/locales/uk.json`
- Create: `packages/shared/src/utils/authErrors.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `mapFirebaseAuthErrorToKey(error: unknown): string` — returns a locale key (e.g. `'auth.errorWeakPassword'`), never the message text itself. Consumed by Tasks 4 and 5.
- Produces locale keys (both languages): `auth.email`, `auth.password`, `auth.confirmPassword`, `auth.displayName`, `auth.displayNamePlaceholder`, `auth.register`, `auth.signInWithEmail`, `auth.registerWithEmail`, `auth.alreadyHaveAccount`, `auth.needAccount`, `auth.forgotPassword`, `auth.sendResetEmail`, `auth.resetPasswordSentTitle`, `auth.resetPasswordSent`, `auth.backToSignIn`, `auth.errorFieldsRequired`, `auth.errorDisplayNameRequired`, `auth.errorPasswordMismatch`, `auth.errorEmailInUse`, `auth.errorWeakPassword`, `auth.errorWrongPassword`, `auth.errorUserNotFound`, `auth.errorInvalidEmail`, `auth.errorTooManyRequests`, and `common.or`.

- [ ] **Step 1: Add the new `auth.*` and `common.or` keys to `en.json`**

Find (the existing end of the `auth` block):

```json
    "signOutErrorTitle": "Sign-out error",
    "signOutErrorMessage": "Could not sign out. Please try again."
  },
```

Replace with:

```json
    "signOutErrorTitle": "Sign-out error",
    "signOutErrorMessage": "Could not sign out. Please try again.",
    "email": "Email",
    "password": "Password",
    "confirmPassword": "Confirm password",
    "displayName": "Your name",
    "displayNamePlaceholder": "Your name",
    "register": "Register",
    "signInWithEmail": "Sign In",
    "registerWithEmail": "Create Account",
    "alreadyHaveAccount": "Already have an account? Sign in",
    "needAccount": "Need an account? Register",
    "forgotPassword": "Forgot password?",
    "sendResetEmail": "Send reset email",
    "resetPasswordSentTitle": "Check your email",
    "resetPasswordSent": "We've sent a password reset link to your email.",
    "backToSignIn": "Back to sign in",
    "errorFieldsRequired": "Please fill in all fields.",
    "errorDisplayNameRequired": "Please enter your name.",
    "errorPasswordMismatch": "Passwords don't match.",
    "errorEmailInUse": "This email is already registered — try signing in instead.",
    "errorWeakPassword": "Password must be at least 6 characters.",
    "errorWrongPassword": "Incorrect email or password.",
    "errorUserNotFound": "No account found with that email.",
    "errorInvalidEmail": "That doesn't look like a valid email address.",
    "errorTooManyRequests": "Too many attempts — please wait a moment and try again."
  },
```

Find (the existing end of the `common` block):

```json
    "success": "Success",
    "unknown": "Unknown"
  },
```

Replace with:

```json
    "success": "Success",
    "unknown": "Unknown",
    "or": "or"
  },
```

- [ ] **Step 2: Add the equivalent keys to `uk.json`**

Find (the existing end of the `auth` block):

```json
    "signOutErrorTitle": "Помилка виходу",
    "signOutErrorMessage": "Не вдалося вийти. Спробуйте ще раз."
  },
```

Replace with:

```json
    "signOutErrorTitle": "Помилка виходу",
    "signOutErrorMessage": "Не вдалося вийти. Спробуйте ще раз.",
    "email": "Електронна пошта",
    "password": "Пароль",
    "confirmPassword": "Підтвердіть пароль",
    "displayName": "Ваше ім'я",
    "displayNamePlaceholder": "Ваше ім'я",
    "register": "Реєстрація",
    "signInWithEmail": "Увійти",
    "registerWithEmail": "Створити акаунт",
    "alreadyHaveAccount": "Вже є акаунт? Увійти",
    "needAccount": "Немає акаунту? Зареєструватися",
    "forgotPassword": "Забули пароль?",
    "sendResetEmail": "Надіслати лист для відновлення",
    "resetPasswordSentTitle": "Перевірте пошту",
    "resetPasswordSent": "Ми надіслали посилання для відновлення пароля на вашу пошту.",
    "backToSignIn": "Повернутися до входу",
    "errorFieldsRequired": "Будь ласка, заповніть усі поля.",
    "errorDisplayNameRequired": "Будь ласка, введіть ваше ім'я.",
    "errorPasswordMismatch": "Паролі не співпадають.",
    "errorEmailInUse": "Ця електронна пошта вже зареєстрована — спробуйте увійти.",
    "errorWeakPassword": "Пароль має містити щонайменше 6 символів.",
    "errorWrongPassword": "Невірна електронна пошта або пароль.",
    "errorUserNotFound": "Акаунт з такою поштою не знайдено.",
    "errorInvalidEmail": "Це не схоже на дійсну електронну адресу.",
    "errorTooManyRequests": "Забагато спроб — зачекайте трохи і спробуйте ще раз."
  },
```

Find (the existing end of the `common` block):

```json
    "success": "Успіх",
    "unknown": "Невідомо"
  },
```

(Read the file first to confirm the exact existing Ukrainian values for `success`/`unknown` before replacing — the English side is confirmed verbatim above, transcribe the Ukrainian anchor exactly as found.) Replace with the same block plus `"or": "або"` added before the closing `},`, following the same pattern as the English edit.

- [ ] **Step 3: Verify JSON validity**

Run: `node -e "JSON.parse(require('fs').readFileSync('packages/shared/src/locales/en.json', 'utf8')); JSON.parse(require('fs').readFileSync('packages/shared/src/locales/uk.json', 'utf8')); console.log('valid')"`
Expected: prints `valid`.

- [ ] **Step 4: Create the error-mapping utility**

Create `packages/shared/src/utils/authErrors.ts`:

```typescript
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
```

- [ ] **Step 5: Export it from the package**

In `packages/shared/src/index.ts`, add after the last `export`:

```typescript
export { mapFirebaseAuthErrorToKey } from './utils/authErrors';
```

- [ ] **Step 6: Verify the package still type-checks**

Run: `cd apps/web && npx tsc --noEmit -p .`
Expected: no new errors beyond the 3 known pre-existing ones (`PostCommentPointsPanel.tsx:69`, `GameContext.tsx` "string | null", `i18n.ts` pluralize/ru).

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/locales/en.json packages/shared/src/locales/uk.json packages/shared/src/utils/authErrors.ts packages/shared/src/index.ts
git commit -m "Add email/password auth locale strings and error-mapping utility"
```

---

### Task 2: expo — `AuthContext.tsx` new methods

**Files:**
- Modify: `apps/expo/contexts/AuthContext.tsx`
- Modify: `apps/expo/jest.setup.js`
- Test: `apps/expo/__tests__/AuthContext.test.tsx`

**Interfaces:**
- Produces: `registerWithEmail(email: string, password: string, displayName: string): Promise<void>`, `signInWithEmail(email: string, password: string): Promise<void>`, `resetPassword(email: string): Promise<void>` — added to `AuthContextType` and the provider's exposed `value`.

- [ ] **Step 1: Write the failing tests**

Add to `apps/expo/__tests__/AuthContext.test.tsx`, inside the existing `describe('AuthProvider', ...)` block, after the `it('signIn rethrows errors', ...)` test:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/expo && npx jest __tests__/AuthContext.test.tsx -t "registerWithEmail|signInWithEmail|resetPassword"`
Expected: FAIL — `result.current.registerWithEmail is not a function`, etc., and `createUserWithEmailAndPassword`/`signInWithEmailAndPassword`/`sendPasswordResetEmail`/`updateProfile` are not yet mocked functions on the `firebase/auth` module (the mock object doesn't have these keys yet).

- [ ] **Step 3: Add the new functions to the `firebase/auth` jest mock**

In `apps/expo/jest.setup.js`, find:

```javascript
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: null,
  })),
  onAuthStateChanged: jest.fn((auth, callback) => {
    // Call the callback immediately to simulate real Firebase behavior
    callback(null);
    // Return unsubscribe function
    return jest.fn();
  }),
  signInWithPopup: jest.fn(),
  signInWithCredential: jest.fn(),
  signOut: jest.fn(() => Promise.resolve()),
  GoogleAuthProvider: jest.fn(),
  User: {},
}));
```

Replace with:

```javascript
jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: null,
  })),
  onAuthStateChanged: jest.fn((auth, callback) => {
    // Call the callback immediately to simulate real Firebase behavior
    callback(null);
    // Return unsubscribe function
    return jest.fn();
  }),
  signInWithPopup: jest.fn(),
  signInWithCredential: jest.fn(),
  signOut: jest.fn(() => Promise.resolve()),
  GoogleAuthProvider: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  updateProfile: jest.fn(),
  User: {},
}));
```

- [ ] **Step 4: Add the three new functions to `AuthContext.tsx`**

Find the import block:

```typescript
import { auth } from '@/config/firebase';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { signOut as firebaseSignOut, GoogleAuthProvider, onAuthStateChanged, signInWithCredential, signInWithPopup, User } from 'firebase/auth';
```

Replace with:

```typescript
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
```

Find the `AuthContextType` interface:

```typescript
interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  isSignedIn: boolean;
}
```

Replace with:

```typescript
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
```

Find the `signOut` function's closing brace (right before `const value: AuthContextType = {`):

```typescript
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

  const value: AuthContextType = {
```

Replace with:

```typescript
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
```

Find the `value` object's contents:

```typescript
  const value: AuthContextType = {
    user,
    loading,
    signIn,
    signOut,
    isSignedIn: !!user,
  };
```

Replace with:

```typescript
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/expo && npx jest __tests__/AuthContext.test.tsx`
Expected: PASS — all tests, no regressions.

- [ ] **Step 6: Run the full expo suite once**

Run: `cd apps/expo && npx jest`
Expected: same pre-existing failure count as the established baseline (30 failing tests total across the suite, all pre-existing and unrelated) — no new failures.

- [ ] **Step 7: Commit**

```bash
git add apps/expo/contexts/AuthContext.tsx apps/expo/jest.setup.js apps/expo/__tests__/AuthContext.test.tsx
git commit -m "Add registerWithEmail/signInWithEmail/resetPassword to expo AuthContext"
```

---

### Task 3: web — `AuthContext.tsx` new methods

**Files:**
- Modify: `apps/web/src/contexts/AuthContext.tsx`

**Interfaces:**
- Produces: `registerWithEmail(email: string, password: string, displayName: string): Promise<void>`, `signInWithEmail(email: string, password: string): Promise<void>`, `resetPassword(email: string): Promise<void>` — added to `AuthContextType` and the provider's exposed value.

`apps/web` has no unit test runner (established in prior work) — this task is verified via `tsc --noEmit` and manual review; Task 6 adds real Cypress coverage that exercises this code through the UI.

- [ ] **Step 1: Add the new imports and functions**

Find:

```typescript
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut as firebaseSignOut, User } from 'firebase/auth';
```

Replace with:

```typescript
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
```

Find the `AuthContextType` interface:

```typescript
interface AuthContextType {
  user: User | null;
  isSignedIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}
```

Replace with:

```typescript
interface AuthContextType {
  user: User | null;
  isSignedIn: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}
```

Find the `signOut` function and the provider's return statement:

```typescript
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Sign-out error:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, isSignedIn, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
```

Replace with:

```typescript
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Sign-out error:', error);
      throw error;
    }
  };

  const registerWithEmail = async (email: string, password: string, displayName: string) => {
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { displayName });
    } catch (error) {
      console.error('Register error:', error);
      throw error;
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
```

Note: `signInWithEmailAndPassword` is already imported at the top of this file (used by the `window.__cypressSignInWithEmail` hook, which is untouched) — do not duplicate that import; the change above only adds the three new names to the same `firebase/auth` import statement.

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit -p .`
Expected: no new errors beyond the 3 known pre-existing ones.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/contexts/AuthContext.tsx
git commit -m "Add registerWithEmail/signInWithEmail/resetPassword to web AuthContext"
```

---

### Task 4: expo — `AuthScreen.tsx` UI (Sign In / Register / Forgot Password)

**Files:**
- Modify: `apps/expo/components/auth/AuthScreen.tsx`
- Test: `apps/expo/__tests__/AuthScreen.test.tsx`

**Interfaces:**
- Consumes: Task 2's `registerWithEmail`/`signInWithEmail`/`resetPassword`; Task 1's `mapFirebaseAuthErrorToKey` from `@mirror/shared`.

- [ ] **Step 1: Write the failing tests**

Add to `apps/expo/__tests__/AuthScreen.test.tsx`. First, extend the `useAuth` mock (find the existing `jest.mock('@/contexts/AuthContext', ...)` block) to include the three new functions:

```typescript
const mockRegisterWithEmail = jest.fn();
const mockSignInWithEmail = jest.fn();
const mockResetPassword = jest.fn();

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: mockLoading,
    isSignedIn: mockIsSignedIn,
    signIn: mockSignIn,
    signOut: mockSignOut,
    registerWithEmail: mockRegisterWithEmail,
    signInWithEmail: mockSignInWithEmail,
    resetPassword: mockResetPassword,
  }),
}));
```

(This replaces the existing `jest.mock('@/contexts/AuthContext', ...)` block — same shape, three new keys added.)

Add `mockRegisterWithEmail.mockReset(); mockSignInWithEmail.mockReset(); mockResetPassword.mockReset();` to the existing top-level `beforeEach` (alongside the existing `mockSignIn.mockReset(); mockSignOut.mockReset();`).

Then add a new describe block, after the existing `describe('AuthScreen — signed out', ...)` block:

```typescript
// ── signed out — email/password forms ──────────────────────────────────────────
describe('AuthScreen — email/password forms', () => {
  beforeEach(() => {
    mockUser = null;
    mockIsSignedIn = false;
    mockLoading = false;
  });

  it('defaults to the Sign In tab, showing email/password fields but not confirm-password or display-name', () => {
    const { getByTestId, queryByTestId } = renderScreen();
    expect(getByTestId('email-input')).toBeTruthy();
    expect(getByTestId('password-input')).toBeTruthy();
    expect(queryByTestId('confirm-password-input')).toBeNull();
    expect(queryByTestId('display-name-input')).toBeNull();
  });

  it('switching to the Register tab reveals display-name and confirm-password fields', () => {
    const { getByTestId, queryByTestId } = renderScreen();
    fireEvent.press(getByTestId('register-tab'));
    expect(getByTestId('display-name-input')).toBeTruthy();
    expect(getByTestId('confirm-password-input')).toBeTruthy();
    expect(queryByTestId('forgot-password-link')).toBeNull();
  });

  it('calls signInWithEmail with the entered credentials on Sign In submit', async () => {
    mockSignInWithEmail.mockResolvedValueOnce(undefined);
    const { getByTestId } = renderScreen();
    fireEvent.changeText(getByTestId('email-input'), 'alice@example.com');
    fireEvent.changeText(getByTestId('password-input'), 'password123');
    fireEvent.press(getByTestId('email-signin-submit-button'));
    await waitFor(() =>
      expect(mockSignInWithEmail).toHaveBeenCalledWith('alice@example.com', 'password123'),
    );
  });

  it('does not call signInWithEmail when a field is empty', async () => {
    const { getByTestId } = renderScreen();
    fireEvent.changeText(getByTestId('email-input'), 'alice@example.com');
    // password left empty
    fireEvent.press(getByTestId('email-signin-submit-button'));
    await waitFor(() => expect(mockSignInWithEmail).not.toHaveBeenCalled());
  });

  it('calls registerWithEmail with trimmed email/name and the password on valid Register submit', async () => {
    mockRegisterWithEmail.mockResolvedValueOnce(undefined);
    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('register-tab'));
    fireEvent.changeText(getByTestId('display-name-input'), '  Alice  ');
    fireEvent.changeText(getByTestId('email-input'), '  alice@example.com  ');
    fireEvent.changeText(getByTestId('password-input'), 'password123');
    fireEvent.changeText(getByTestId('confirm-password-input'), 'password123');
    fireEvent.press(getByTestId('register-submit-button'));
    await waitFor(() =>
      expect(mockRegisterWithEmail).toHaveBeenCalledWith('alice@example.com', 'password123', 'Alice'),
    );
  });

  it('does not call registerWithEmail when passwords do not match', async () => {
    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('register-tab'));
    fireEvent.changeText(getByTestId('display-name-input'), 'Alice');
    fireEvent.changeText(getByTestId('email-input'), 'alice@example.com');
    fireEvent.changeText(getByTestId('password-input'), 'password123');
    fireEvent.changeText(getByTestId('confirm-password-input'), 'different');
    fireEvent.press(getByTestId('register-submit-button'));
    await waitFor(() => expect(mockRegisterWithEmail).not.toHaveBeenCalled());
  });

  it('does not call registerWithEmail when the password is shorter than 6 characters', async () => {
    const { getByTestId } = renderScreen();
    fireEvent.press(getByTestId('register-tab'));
    fireEvent.changeText(getByTestId('display-name-input'), 'Alice');
    fireEvent.changeText(getByTestId('email-input'), 'alice@example.com');
    fireEvent.changeText(getByTestId('password-input'), '123');
    fireEvent.changeText(getByTestId('confirm-password-input'), '123');
    fireEvent.press(getByTestId('register-submit-button'));
    await waitFor(() => expect(mockRegisterWithEmail).not.toHaveBeenCalled());
  });

  it('forgot-password link switches to a single email field and calls resetPassword on submit', async () => {
    mockResetPassword.mockResolvedValueOnce(undefined);
    const { getByTestId, queryByTestId } = renderScreen();
    fireEvent.press(getByTestId('forgot-password-link'));
    expect(queryByTestId('password-input')).toBeNull();
    fireEvent.changeText(getByTestId('reset-email-input'), 'alice@example.com');
    fireEvent.press(getByTestId('send-reset-button'));
    await waitFor(() => expect(mockResetPassword).toHaveBeenCalledWith('alice@example.com'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/expo && npx jest __tests__/AuthScreen.test.tsx -t "email/password forms"`
Expected: FAIL — none of the new `testID`s exist yet (`email-input`, `password-input`, `register-tab`, etc.).

- [ ] **Step 3: Add the email/password UI to `AuthScreen.tsx`**

Add to the imports (the `useAuth` destructure and a new import):

Find:

```typescript
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
```

Replace with:

```typescript
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { mapFirebaseAuthErrorToKey } from "@mirror/shared";
```

Find:

```typescript
export const AuthScreen: React.FC = () => {
  const { signIn, signOut, user, loading, isSignedIn } = useAuth();
  const { locale } = useLanguage();
  const { playSound } = useSound();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const insets = useSafeAreaInsets();
```

Replace with:

```typescript
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
```

Add `themedInput` to the theme import — find:

```typescript
import { Colors, Fonts, GameColors } from "@/constants/theme";
```

Replace with:

```typescript
import { Colors, Fonts, GameColors, themedInput } from "@/constants/theme";
```

Add `TextInput` to the react-native import — find:

```typescript
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
```

Replace with:

```typescript
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
```

Add the three handler functions right after the existing `handleSignOut` function (before `if (loading) {`):

```typescript
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
```

Now replace the signed-out return block's `signInContainer` contents. Find:

```typescript
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
```

Replace with:

```typescript
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

            <ThemedText style={styles.orDivider}>{t("common.or", { locale })}</ThemedText>
          </>
        )}

        {/* Google Sign-In Button */}
        {authMode !== "forgot" && (
        <View style={styles.buttonContainer}>
```

Then find the closing of the Google button block (the JSX right before the final closing tags of `signInContainer`):

```typescript
          )}
        </View>
      </View>
    </ThemedView>
  );
};
```

Replace with (closing the new conditional wrapper around the Google button block):

```typescript
          )}
        </View>
        )}
      </View>
    </ThemedView>
  );
};
```

- [ ] **Step 4: Add the new styles**

In the `StyleSheet.create({...})` call at the bottom of the file, add these new keys (anywhere inside the object, e.g. right after the existing `buttonContainer` style):

```typescript
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/expo && npx jest __tests__/AuthScreen.test.tsx`
Expected: PASS — all tests including the pre-existing ones (mode toggle defaults to Sign In, so the pre-existing "signed out" tests that look for the Google button must still find it — verify this explicitly, since the Google button is now wrapped in an `authMode !== "forgot"` condition rather than being unconditional).

- [ ] **Step 6: Run the full expo suite once**

Run: `cd apps/expo && npx jest`
Expected: same pre-existing baseline (30 failing tests, unrelated), no new failures.

- [ ] **Step 7: Commit**

```bash
git add apps/expo/components/auth/AuthScreen.tsx apps/expo/__tests__/AuthScreen.test.tsx
git commit -m "Add email/password sign-in and registration UI to expo AuthScreen"
```

---

### Task 5: web — `AuthScreen.tsx` UI (Sign In / Register / Forgot Password)

**Files:**
- Modify: `apps/web/src/components/auth/AuthScreen.tsx`

**Interfaces:**
- Consumes: Task 3's `registerWithEmail`/`signInWithEmail`/`resetPassword`; Task 1's `mapFirebaseAuthErrorToKey` from `@mirror/shared`.

No expo-style component tests here (`apps/web` has no unit test runner) — Task 6 covers this through Cypress.

- [ ] **Step 1: Rewrite `AuthScreen.tsx`**

Replace the full contents of `apps/web/src/components/auth/AuthScreen.tsx` with:

```tsx
import { useLanguage } from '../../contexts/LanguageContext';
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { mapFirebaseAuthErrorToKey } from '@mirror/shared';
import { HeaderLogo } from '../ui/HeaderLogo';
import { LanguageSelector } from '../ui/LanguageSelector';
import { SoundToggle } from '../ui/SoundToggle';
import { LiquidLoader } from '../ui/LiquidLoader';

type AuthMode = 'signin' | 'register' | 'forgot';

export const AuthScreen: React.FC = () => {
  const { signIn, registerWithEmail, signInWithEmail, resetPassword } = useAuth();
  const { t } = useLanguage();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [authMode, setAuthMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [resetEmail, setResetEmail] = useState('');

  const switchMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setError(null);
    setInfo(null);
  };

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await signIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
      setIsLoading(false);
    }
  };

  const handleEmailSignIn = async () => {
    if (!email.trim() || !password) {
      setError(t('auth.errorFieldsRequired'));
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await signInWithEmail(email.trim(), password);
    } catch (err) {
      setError(t(mapFirebaseAuthErrorToKey(err)));
      setIsLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!displayName.trim()) {
      setError(t('auth.errorDisplayNameRequired'));
      return;
    }
    if (!email.trim() || !password) {
      setError(t('auth.errorFieldsRequired'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.errorWeakPassword'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.errorPasswordMismatch'));
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await registerWithEmail(email.trim(), password, displayName.trim());
    } catch (err) {
      setError(t(mapFirebaseAuthErrorToKey(err)));
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail.trim()) {
      setError(t('auth.errorInvalidEmail'));
      return;
    }
    try {
      setIsLoading(true);
      setError(null);
      await resetPassword(resetEmail.trim());
      setInfo(t('auth.resetPasswordSent'));
      setIsLoading(false);
    } catch (err) {
      setError(t(mapFirebaseAuthErrorToKey(err)));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <HeaderLogo />

        <h1 className="text-4xl font-bold text-center mb-4 text-gray-900 dark:text-white">
          In The Mirror
        </h1>

        <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
          {t('game.description') || 'A multiplayer game for understanding yourself and others better.'}
        </p>

        {error && (
          <div className="bg-game-danger/10 border border-game-danger text-game-danger rounded-lg p-4 mb-6 text-sm">
            {error}
          </div>
        )}
        {info && (
          <div className="bg-game-green/10 border border-game-green text-game-green rounded-lg p-4 mb-6 text-sm">
            {info}
          </div>
        )}

        {isLoading ? (
          <div className="mb-8">
            <LiquidLoader size={60} />
          </div>
        ) : authMode === 'forgot' ? (
          <div className="mb-8 space-y-3">
            <input
              type="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              placeholder={t('auth.email')}
              data-cy="reset-email-input"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
            <button
              type="button"
              onClick={handleResetPassword}
              data-cy="send-reset-button"
              className="w-full bg-game-blue text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              {t('auth.sendResetEmail')}
            </button>
            <button
              type="button"
              onClick={() => switchMode('signin')}
              data-cy="back-to-signin-link"
              className="w-full text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              {t('auth.backToSignIn')}
            </button>
          </div>
        ) : (
          <>
            <div className="flex gap-6 mb-6 justify-center">
              <button
                type="button"
                onClick={() => switchMode('signin')}
                data-cy="signin-tab"
                className={`pb-1 font-semibold ${authMode === 'signin' ? 'border-b-2 border-game-blue text-gray-900 dark:text-white' : 'text-gray-400'}`}
              >
                {t('auth.signIn')}
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                data-cy="register-tab"
                className={`pb-1 font-semibold ${authMode === 'register' ? 'border-b-2 border-game-blue text-gray-900 dark:text-white' : 'text-gray-400'}`}
              >
                {t('auth.register')}
              </button>
            </div>

            <div className="mb-6 space-y-3">
              {authMode === 'register' && (
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('auth.displayNamePlaceholder')}
                  data-cy="display-name-input"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              )}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.email')}
                data-cy="email-input"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.password')}
                data-cy="password-input"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              {authMode === 'register' && (
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t('auth.confirmPassword')}
                  data-cy="confirm-password-input"
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              )}
              <button
                type="button"
                onClick={authMode === 'register' ? handleRegister : handleEmailSignIn}
                data-cy={authMode === 'register' ? 'register-submit-button' : 'email-signin-submit-button'}
                className="w-full bg-game-blue text-white px-6 py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity"
              >
                {authMode === 'register' ? t('auth.registerWithEmail') : t('auth.signInWithEmail')}
              </button>
              {authMode === 'signin' && (
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  data-cy="forgot-password-link"
                  className="w-full text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  {t('auth.forgotPassword')}
                </button>
              )}
            </div>

            <p className="text-center text-gray-400 mb-6 text-sm">{t('common.or')}</p>

            <button type="button"
              onClick={handleSignIn}
              data-cy="google-signin-button"
              className="w-full bg-game-blue text-white px-6 py-4 rounded-lg font-semibold hover:opacity-90 transition-opacity mb-8 text-lg"
            >
              {t('auth.signInGoogle') || 'Sign in with Google'}
            </button>
          </>
        )}

        <div className="space-y-4 flex flex-col items-center">
          <LanguageSelector />
          <SoundToggle />
        </div>
      </div>
    </div>
  );
};
```

Note this preserves `data-cy="google-signin-button"` unchanged and in the same reachable state as before (default Sign In tab, not loading) — this is exactly what `apps/web/cypress/support/commands.ts`'s `signInAsTestUser`/`validate()` waits on (`cy.get('[data-cy=google-signin-button]').should('not.exist')` after sign-in), so that existing mechanism keeps working unmodified.

- [ ] **Step 2: Verify it compiles**

Run: `cd apps/web && npx tsc --noEmit -p .`
Expected: no new errors beyond the 3 known pre-existing ones.

- [ ] **Step 3: Manually smoke-test in the browser**

Run: `npm -w apps/web run dev`, open the app, and click through: default Sign In tab shows email/password + Google button; Register tab shows all 4 fields; submitting Register with mismatched passwords shows the client-side error without calling Firebase; Forgot Password shows the single-field form. (A full register → sign out → sign in round trip against the real Firebase project is optional here since Task 6 covers it in Cypress — but do at least confirm the tab switching and validation render correctly.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/auth/AuthScreen.tsx
git commit -m "Add email/password sign-in and registration UI to web AuthScreen"
```

---

### Task 6: web — Cypress E2E coverage for the new auth UI

**Files:**
- Create: `apps/web/cypress/e2e/email-password-auth.cy.ts`
- Modify: `apps/web/src/components/game/JoinScreen.tsx`

**Interfaces:**
- Consumes: Task 5's `data-cy` attributes (`signin-tab`, `register-tab`, `display-name-input`, `email-input`, `password-input`, `confirm-password-input`, `email-signin-submit-button`, `register-submit-button`, `forgot-password-link`, `reset-email-input`, `send-reset-button`, `back-to-signin-link`, `google-signin-button`).

This is additive coverage only — `apps/web/cypress/support/commands.ts` (`signInAsTestUser`, `__cypressSignInWithEmail`) is not modified, and every other existing Cypress spec keeps using it unchanged.

Confirmed conventions from `apps/web/cypress/e2e/smoke.cy.ts` (already read — this is the closest existing analog, an auth-adjacent flow test): specs use `[data-cy=...]` attribute selectors exclusively (no text-content matching), `describe`/`it` blocks, and rely on the dev server's configured base URL (no explicit host in `cy.visit`). The `sign out` control this new spec needs is `apps/web/src/components/game/JoinScreen.tsx:76-82` — a plain `<button onClick={() => signOut()}>{t('auth.signOut')}</button>` with **no existing `data-cy` attribute** — Step 1 below adds one.

- [ ] **Step 1: Add a `data-cy` attribute to the existing sign-out button**

In `apps/web/src/components/game/JoinScreen.tsx`, find:

```tsx
          <button
            type="button"
            onClick={() => signOut()}
            className="w-full bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            {t('auth.signOut')}
          </button>
```

Replace with:

```tsx
          <button
            type="button"
            onClick={() => signOut()}
            data-cy="sign-out-button"
            className="w-full bg-gray-300 dark:bg-gray-600 text-gray-900 dark:text-white px-6 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity"
          >
            {t('auth.signOut')}
          </button>
```

- [ ] **Step 2: Write the new spec**

Create `apps/web/cypress/e2e/email-password-auth.cy.ts`:

```typescript
describe('Email/password auth', () => {
  // A fresh, randomly-suffixed email per run avoids colliding with a
  // previous run's "already registered" state — this suite runs against
  // real production Firebase, not an emulator.
  const uniqueSuffix = Date.now();
  const testEmail = `cy-test-${uniqueSuffix}@example.com`;
  const testPassword = 'password123';
  const testDisplayName = `Cy Test ${uniqueSuffix}`;

  beforeEach(() => {
    cy.visit('/');
  });

  it('shows the Sign In tab by default with email/password fields and the Google button', () => {
    cy.get('[data-cy=signin-tab]').should('exist');
    cy.get('[data-cy=email-input]').should('exist');
    cy.get('[data-cy=password-input]').should('exist');
    cy.get('[data-cy=confirm-password-input]').should('not.exist');
    cy.get('[data-cy=google-signin-button]').should('exist');
  });

  it('switching to Register reveals the display-name and confirm-password fields', () => {
    cy.get('[data-cy=register-tab]').click();
    cy.get('[data-cy=display-name-input]').should('exist');
    cy.get('[data-cy=confirm-password-input]').should('exist');
    cy.get('[data-cy=forgot-password-link]').should('not.exist');
  });

  it('registers a new account, signs out, and signs back in with the same credentials', () => {
    cy.get('[data-cy=register-tab]').click();
    cy.get('[data-cy=display-name-input]').type(testDisplayName);
    cy.get('[data-cy=email-input]').type(testEmail);
    cy.get('[data-cy=password-input]').type(testPassword);
    cy.get('[data-cy=confirm-password-input]').type(testPassword);
    cy.get('[data-cy=register-submit-button]').click();

    // Successful registration lands past the sign-in screen, on the
    // join-game screen (JoinScreen.tsx), which is where the sign-out
    // button added in Step 1 lives.
    cy.get('[data-cy=google-signin-button]').should('not.exist');
    cy.get('[data-cy=sign-out-button]').click();

    cy.visit('/');
    cy.get('[data-cy=signin-tab]').should('exist');
    cy.get('[data-cy=email-input]').type(testEmail);
    cy.get('[data-cy=password-input]').type(testPassword);
    cy.get('[data-cy=email-signin-submit-button]').click();
    cy.get('[data-cy=google-signin-button]').should('not.exist');
  });

  it('shows a client-side error and does not submit when Register passwords do not match', () => {
    cy.get('[data-cy=register-tab]').click();
    cy.get('[data-cy=display-name-input]').type('Mismatch Test');
    cy.get('[data-cy=email-input]').type(`cy-mismatch-${uniqueSuffix}@example.com`);
    cy.get('[data-cy=password-input]').type('password123');
    cy.get('[data-cy=confirm-password-input]').type('different123');
    cy.get('[data-cy=register-submit-button]').click();
    cy.contains(/match/i).should('exist');
    // Still on the sign-in screen, not signed in.
    cy.get('[data-cy=register-tab]').should('exist');
  });

  it('forgot-password flow shows the single email field and a confirmation after sending', () => {
    cy.get('[data-cy=forgot-password-link]').click();
    cy.get('[data-cy=password-input]').should('not.exist');
    cy.get('[data-cy=reset-email-input]').type(testEmail);
    cy.get('[data-cy=send-reset-button]').click();
    cy.contains(/reset|email/i).should('exist');
  });
});
```

- [ ] **Step 3: Run the new spec**

Confirmed script (from `apps/web/package.json`): `npm -w apps/web run cypress:run` runs `cypress run` (all specs). To run just this new spec against a running dev server: `cd apps/web && npx cypress run --spec "cypress/e2e/email-password-auth.cy.ts"`. This suite runs against real production Firebase (per `commands.ts`'s own comments, already confirmed) — expect it to actually create a real test account each run.

Expected: all 5 tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/cypress/e2e/email-password-auth.cy.ts apps/web/src/components/game/JoinScreen.tsx
git commit -m "Add Cypress E2E coverage for email/password sign-in and registration"
```
