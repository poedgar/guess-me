# State Management

All global state uses React Context. There are four providers, each with a dedicated hook.

---

## AuthContext

**File:** `contexts/AuthContext.tsx`
**Hook:** `useAuth()`

### Shape

```typescript
interface AuthContextType {
  user: User | null;       // Firebase User object
  loading: boolean;        // true while checking persisted session
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  isSignedIn: boolean;     // convenience: user !== null
}
```

### Behavior

- On mount: calls `onAuthStateChanged` — sets `user` if a session exists, clears loading.
- `signIn()`:
  - **Web:** `signInWithPopup(auth, googleProvider)`
  - **iOS/Android:** `GoogleSignin.signIn()` → exchanges credential with Firebase
- `signOut()`: signs out from both Firebase and the Google SDK.
- The `user` object is the standard Firebase `User` — contains `uid`, `displayName`, `email`, `photoURL`.

### Usage

```typescript
const { user, isSignedIn, signIn, signOut, loading } = useAuth();
```

---

## GameContext

**File:** `contexts/GameContext.tsx`  
**Hook:** `useGame()`  
**Size:** ~1500 lines — the largest and most complex context.

### Shape

```typescript
interface GameContextType {
  currentGame: Game | null;
  loading: boolean;

  // Setup
  enterGame: (input: string, adminWritesComments?: boolean) => Promise<string | void>;
  createGame: (adminWritesComments?: boolean) => Promise<string>;
  joinGame: (gameId: string) => Promise<void>;
  leaveGame: () => Promise<void>;

  // Phase transitions (admin only)
  startGame: () => Promise<void>;
  showComments: () => Promise<void>;
  startGuessingPhase: () => Promise<void>;
  finalizeGuessingPhase: () => Promise<void>;
  startNextRound: () => Promise<void>;
  startPostGuessingPointPhase: () => Promise<void>;
  skipPostCommentPhase: () => Promise<void>;

  // Player actions
  submitComment: (commentText: string) => Promise<void>;
  givePoints: (commentId: string, points: number) => Promise<void>;
  finishGivingPoints: () => Promise<void>;
  givePointsToTarget: (targetUserId: string, points?: number) => Promise<void>;
  submitGuess: (roundNumber: number, commentId: string, guessedAuthorId: string) => Promise<void>;
  markPlayerGuessesSubmitted: (userId?: string) => Promise<void>;
  awardPointsToPlayers: (awards: { recipientId: string; points: number }[]) => Promise<void>;

  // Settings (admin only)
  updateAdminWritesComments: (value: boolean) => Promise<void>;
  updateShowSurnames: (value: boolean) => Promise<void>;
  updateTargetSelectionMode: (mode: 'random' | 'chronological') => Promise<void>;
  updateShowGuessResults: (value: boolean) => Promise<void>;
}
```

### How State Updates

`currentGame` is kept in sync with Firestore via `onSnapshot`. When any player performs an action (submits a comment, starts a phase), they write to Firestore. The `onSnapshot` listener fires on every client and updates `currentGame`. Components derive all their UI from `currentGame`.

```
Player action → GameContext method → Firestore write
                                          ↓
                                   onSnapshot fires on ALL clients
                                          ↓
                              setCurrentGame(newData)
                                          ↓
                              Component re-renders
```

### Listener Lifecycle

The Firestore listener is created in `joinGame` / `createGame` and cleaned up in `leaveGame` (and on component unmount). Never call `onSnapshot` outside of `GameContext`.

### `enterGame` — Smart Entry Point

`enterGame(input)` is the single entry point called from the UI. It:
1. Checks `input` against the admin password in Firestore.
2. If match → calls `createGame()`.
3. If no match → calls `joinGame(input)` treating input as a game ID.

### Admin vs Participant Guards

Most phase-transition methods check `currentGame.adminId === user.uid` before writing. Non-admins calling admin-only methods will silently fail or throw. The UI hides admin controls from non-admins.

---

## LanguageContext

**File:** `contexts/LanguageContext.tsx`  
**Hook:** `useLanguage()`

### Shape

```typescript
interface LanguageContextType {
  locale: string;                    // 'uk' | 'en'
  setLocale: (locale: string) => void;
  t: (key: string, options?: object) => string;  // translation function
}
```

### Behavior

- On mount: reads saved locale from `AsyncStorage` (`@locale` key). Defaults to `'uk'`.
- `setLocale(locale)`: updates i18n-js, saves to AsyncStorage, triggers re-render.
- `t(key)`: wraps `i18n.t(key)` — returns the translated string for the current locale.

### Usage

```typescript
const { locale, setLocale, t } = useLanguage();

// Translate
<Text>{t('game.submitComment')}</Text>

// Switch language
<Button onPress={() => setLocale('en')} />
```

Translation key structure: see [localization.md](localization.md).

---

## SoundContext

**File:** `contexts/SoundContext.tsx`  
**Hook:** `useSound()`

### Shape

```typescript
interface SoundContextType {
  playSound: (sound: SoundName) => void;
  isMuted: boolean;
  toggleMute: () => void;
}

type SoundName =
  | 'success' | 'error' | 'click'
  | 'gameStart' | 'points' | 'correctGuess' | 'wrongGuess'
  | 'roundComplete' | 'gameOver' | 'timerWarning'
  | 'achievement' | 'notification' | 'copy';
```

### Behavior

- All sounds are generated procedurally using the **Web Audio API** — no audio files bundled.
- Each sound is a sequence of oscillator nodes (frequency, wave type, gain, duration).
- `isMuted` persists to AsyncStorage (`@sound_muted` key).
- On native, falls back to haptic feedback if audio context is unavailable.

### Usage

```typescript
const { playSound, isMuted, toggleMute } = useSound();

playSound('success');      // Play a sound effect
playSound('correctGuess');
toggleMute();              // Toggle mute state
```

---

## Derived State Patterns

Common values computed from `currentGame` in components:

```typescript
const { currentGame } = useGame();
const { user } = useAuth();

// Is current user the admin?
const isAdmin = currentGame?.adminId === user?.uid;

// Is current user the target this round?
const isTarget = currentGame?.currentRound?.targetUserId === user?.uid;

// Has current user submitted a comment this round?
const hasSubmitted = currentGame?.currentRound?.comments
  .some(c => c.authorId === user?.uid);

// All participants except admin
const nonAdminParticipants = currentGame?.participants
  .filter(p => p.userId !== currentGame.adminId);

// Current user's total score
const myScore = (currentGame?.scores?.[user?.uid] ?? 0)
  + (currentGame?.guessResults?.[user?.uid]?.correctGuesses ?? 0);
```

---

## Context Anti-Patterns to Avoid

- **Do not** import `db` from `config/firebase.js` in components. All Firestore access goes through `GameContext`.
- **Do not** call `setCurrentGame` directly — it is internal to the context.
- **Do not** reorder providers in `app/_layout.tsx`. `GameContext` reads from `AuthContext`; reversing them breaks auth-dependent game logic.
- **Do not** add new contexts without confirming they cannot live inside an existing one.
