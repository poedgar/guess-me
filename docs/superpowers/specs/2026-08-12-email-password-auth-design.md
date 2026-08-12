# Email/Password Sign-In & Registration

**Date:** 2026-08-12
**Scope:** `apps/web` and `apps/expo`, alongside the existing Google Sign-In (not a replacement).

## Problem

The app only offers Google Sign-In. Users who don't want to (or can't) use a Google account have no way in. Firebase's email/password provider is already enabled on the project and partially wired — `apps/web/src/contexts/AuthContext.tsx` exposes `signInWithEmailAndPassword` via a `window.__cypressSignInWithEmail` hook purely for Cypress E2E tests, since Cypress can't drive a real Google OAuth popup — but it's never been surfaced as a real sign-in method in the UI, and `apps/expo` has no email/password path at all.

## Behavior

The sign-in screen gets a mode toggle — **Sign In** (default) / **Register** — alongside the existing Google button, which stays available in both modes.

- **Sign In**: email + password fields, plus a "Forgot password?" link.
- **Register**: email, password, confirm password (client-side match check), and a required display name field (email/password accounts don't come with a name or photo the way Google accounts do).
- **Forgot password**: tapping the link prompts for an email, sends Firebase's password-reset email, and shows a confirmation. No custom reset UI — Firebase's own hosted reset page handles the rest.

No email verification step in this version — an account is usable immediately after registration.

If someone tries to register with an email already tied to a Google-signed-in account (or vice versa), Firebase's standard `auth/email-already-in-use` behavior applies — surfaced as "This email is already registered — try signing in instead." No account-linking flow; that's out of scope.

## Architecture — `AuthContext.tsx` (both apps)

Three new methods, added to each app's existing `AuthContextType`/provider, matching each app's existing conventions (expo already has `loading`/`isSignedIn` state management around `signIn`/`signOut`; web's context is a plain async-passthrough):

- **`registerWithEmail(email: string, password: string, displayName: string): Promise<void>`** — `createUserWithEmailAndPassword(auth, email, password)`, then `updateProfile(userCredential.user, { displayName })` (Firebase's create call doesn't accept a display name directly, so this is a required follow-up write before the auth-state listener's next tick).
- **`signInWithEmail(email: string, password: string): Promise<void>`** — `signInWithEmailAndPassword(auth, email, password)`.
- **`resetPassword(email: string): Promise<void>`** — `sendPasswordResetEmail(auth, email)`.

All three throw on failure (matching `signIn`/`signOut`'s existing pattern) — no try/catch swallowing inside the context; the UI layer handles presentation.

**Web-specific note:** `apps/web/src/contexts/AuthContext.tsx` already imports `signInWithEmailAndPassword` for the Cypress-only hook. `signInWithEmail` reuses that import and exposes it as a first-class context method. `window.__cypressSignInWithEmail` itself is **not removed** — it turns out to be load-bearing for the entire E2E suite's session-caching and account-validation logic (`apps/web/cypress/support/commands.ts`'s `signInAsTestUser`, used by every existing Cypress test, including a `cy.session` `validate()` callback that reads persisted Firebase auth state from IndexedDB). Rewriting that to drive the real UI form instead is a much larger, riskier change than this feature calls for, with no functional benefit — the hook already calls the exact same `signInWithEmailAndPassword` the new UI will call, just without going through form clicks. Leave `commands.ts` untouched.

## UI — `AuthScreen.tsx` (both apps)

Signed-out state layout, top to bottom: logo/header (unchanged) → mode toggle ("Sign In" / "Register" as two tappable/clickable labels, matching each app's existing text-link styling) → the relevant form → Google button (unchanged, always visible in both modes, existing `handleSignIn` untouched) → language/sound controls (unchanged).

**Sign In form:** email input, password input, submit button, "Forgot password?" link below the button.

**Register form:** display name input, email input, password input, confirm-password input, submit button.

**Forgot password:** clicking the link swaps the form for a single email input + "Send reset email" button (or, on web, a simple `window.prompt`-style inline field — implementer's call on the exact micro-UI, as long as it doesn't require a new route/screen). On success, show the existing alert/error-banner mechanism each app already has (`FancyAlert` on expo, the existing error `<div>` on web, repurposed for a success message too) with confirmation text, then return to the Sign In form.

Each app builds the forms with its own existing primitives — expo: `TextInput` + `FancyAlert` for error display, matching the rest of the app's form patterns; web: plain `<input>` + the existing inline error `<div>`, matching `AuthScreen.tsx`'s current style. No shared form component between apps — consistent with how `AuthScreen.tsx` has always been a fully separate implementation per platform.

## Validation & Error Handling

**Client-side (before calling Firebase), both apps:**
- All fields required (non-empty).
- Password ≥ 6 characters (Firebase's own minimum — checked client-side too, to avoid an avoidable round trip for an obvious miss).
- Register only: password === confirm password.

**Firebase error codes mapped to translated, friendly messages** (via each app's existing error-display mechanism):
- `auth/email-already-in-use` → "This email is already registered — try signing in instead."
- `auth/weak-password` → "Password must be at least 6 characters."
- `auth/wrong-password` / `auth/invalid-credential` → "Incorrect email or password."
- `auth/user-not-found` → "No account found with that email."
- `auth/invalid-email` → "That doesn't look like a valid email address."
- `auth/too-many-requests` → "Too many attempts — please wait a moment and try again."
- Anything else → fall back to the existing generic `auth.signInErrorMessage`-style fallback already used for Google Sign-In failures.

**No Firestore or security-rule changes.** The rest of the app already treats any signed-in `user` uniformly by `uid`/`displayName`/`email`/`photoURL` (see `Participant` usage throughout `GameContext.tsx`), and UI that renders `photoURL` already falls back to initials when it's absent (`AuthScreen.tsx`'s existing avatar-placeholder logic, unchanged) — email/password users simply have no `photoURL`, which is already a handled case, not a new one.

## Localization

New keys under `auth.*` in the shared locale files (`packages/shared/src/locales/en.json` / `uk.json` — both apps already source from this one package):

`auth.email`, `auth.password`, `auth.confirmPassword`, `auth.displayName`, `auth.displayNamePlaceholder`, `auth.register`, `auth.signInWithEmail`, `auth.registerWithEmail`, `auth.alreadyHaveAccount`, `auth.needAccount`, `auth.forgotPassword`, `auth.sendResetEmail`, `auth.resetPasswordSent`, `auth.backToSignIn`, plus the six mapped error-message keys from the Validation section above (e.g. `auth.errorEmailInUse`, `auth.errorWeakPassword`, `auth.errorWrongPassword`, `auth.errorUserNotFound`, `auth.errorInvalidEmail`, `auth.errorTooManyRequests`).

## Testing

- **apps/expo:** Jest + RTL coverage extending `apps/expo/__tests__/AuthScreen.test.tsx` — mode toggle switches forms, client-side validation blocks submission with the right message, each of the three new `AuthContext` methods gets called with the right arguments on valid submit, Firebase error codes render the mapped message. Plus direct unit coverage for the three new `AuthContext` methods themselves (mocked `firebase/auth`), matching the existing mocking conventions already used for `signIn`/`signOut`.
- **apps/web:** no unit test runner (established in prior work) — add new Cypress E2E coverage that drives the real registration/sign-in/forgot-password forms directly (mode toggle, field validation, a real registration + sign-out + sign-in-again round trip). This is additive: `commands.ts`'s existing `signInAsTestUser`/`__cypressSignInWithEmail` infrastructure is untouched and keeps serving every other existing test unchanged.

## Out of Scope

- No email verification step.
- No account linking between a Google account and an email/password account sharing the same email address.
- No password strength meter or complexity rules beyond Firebase's own 6-character minimum.
- No changes to `Participant`, `Game`, or any Firestore document shape — this is purely an additional authentication entry point into the same `user` object the rest of the app already consumes.
