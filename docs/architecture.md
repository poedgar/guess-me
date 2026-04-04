# Architecture

## Overview

In-The-Mirror is a client-heavy application. Almost all business logic lives in the React Native client; Firebase provides real-time sync and authentication with minimal server-side logic.

```
┌─────────────────────────────────────────────────────────┐
│                  Expo React Native App                   │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────┐  │
│  │  Auth    │  │  Game    │  │ Language  │  │Sound │  │
│  │ Context  │  │ Context  │  │  Context  │  │Ctx   │  │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  └──┬───┘  │
│       │              │              │            │      │
│  ┌────▼──────────────▼──────────────▼────────────▼───┐  │
│  │              Expo Router (File-based)              │  │
│  │   (tabs)/index → (tabs)/results → (tabs)/rules    │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────┘
                          │
              ┌───────────▼────────────┐
              │  Firebase Services     │
              │  ┌──────────────────┐  │
              │  │  Firestore DB    │  │
              │  │  (real-time)     │  │
              │  └──────────────────┘  │
              │  ┌──────────────────┐  │
              │  │  Firebase Auth   │  │
              │  │  (Google OAuth)  │  │
              │  └──────────────────┘  │
              └────────────────────────┘
```

---

## Routing

The app uses **Expo Router v6** (file-based routing). The directory structure inside `app/` maps directly to routes.

```
app/
├── _layout.tsx          → Root Stack (wraps everything, mounts all providers)
├── (tabs)/
│   ├── _layout.tsx      → Bottom Tab Navigator
│   ├── index.tsx        → /  (Home — renders AuthScreen or GameScreen)
│   ├── results.tsx      → /results
│   └── rules.tsx        → /rules
└── modal.tsx            → /modal
```

### Navigation Flow

1. App opens → root `_layout.tsx` loads fonts, mounts providers, navigates to `(tabs)`.
2. `(tabs)/index.tsx` checks `isSignedIn` from `AuthContext`.
   - Not signed in → renders `<AuthScreen />`
   - Signed in → renders `<GameScreen />`
3. Game state in `GameContext` determines what `GameScreen` renders (waiting, active, guessing, etc.).

---

## Provider Stack

Defined in `app/_layout.tsx`. Order is significant — each inner provider can consume outer providers.

```
SoundProvider          (no dependencies — safe to be outermost)
  LanguageProvider     (no dependencies)
    AuthProvider       (no dependencies on Game)
      GameProvider     (depends on AuthContext for userId)
        ThemeProvider  (depends on system color scheme)
          Stack        (Expo Router navigation)
```

---

## Component Architecture

### Screen Components (thin)

Screens in `app/(tabs)/` are thin — they import one smart component and pass minimal props:

```typescript
// app/(tabs)/index.tsx
export default function HomeScreen() {
  const { isSignedIn } = useAuth();
  return isSignedIn ? <GameScreen /> : <AuthScreen />;
}
```

### Feature Components

Business logic lives in feature components under `components/`:

- `components/auth/AuthScreen.tsx` — all auth UI and sign-in flow
- `components/game/` — game UI split into phase-specific components (see below)

### Game Component Architecture

`GameScreen.tsx` is a thin orchestrator (~140 lines). It owns shared state (FancyAlert), computes shared derived values (`isAdmin`, `participantsByJoin`, `joinIndexById`, `getDisplayName`, `commentsForPlayer`), and routes to phase components based on `currentGame.status`:

```
components/game/
├── GameScreen.tsx              — orchestrator: shared state, routing, leave button
├── GameHeader.tsx              — logo, admin badge, status badge (shown while in game)
├── JoinScreen.tsx              — sign-in prompt or game ID input/join form
├── WaitingPhase.tsx            — admin toggles, participant list, mid-game leaderboard, start button
├── ActivePhase.tsx             — comment writing, target view, revealed comments, give-points UI
├── GuessingPhase.tsx           — guess cards, submit, admin finalize, guess result modal
├── PostGuessingPointsPanel.tsx — shared sub-component used by ActivePhase and GuessingPhase
└── ResultsPhase.tsx            — game over screen and final leaderboard
```

The `ShowFancyAlertFn` type is defined in `GameHeader.tsx` and imported by all phase components that need to trigger alerts.

**Cross-cutting concerns:**
- `FancyAlert` is rendered at the `GameScreen` root level; `showFancyAlert` is threaded down as a prop.
- `PostGuessingPointsPanel` is rendered from both `ActivePhase` (when `game.postGuessingPointPhase` is true during `active` status) and `GuessingPhase` (always — it self-guards).
- The guess result modal is owned by `GuessingPhase` and uses `position: absolute` with `zIndex: 1000`.

### UI Primitives

Small, reusable, stateless components in `components/ui/`:

- `ThemedText`, `ThemedView` — apply dark/light theme colors
- `HeaderLogo` — app logo, platform-aware (SVG on web, PNG on native)
- `FancyAlert` — cross-platform alert overlay (replaces `Alert.alert`)
- `icon-symbol.tsx` / `icon-symbol.ios.tsx` — SF Symbols on iOS, fallback on Android
- `collapsible.tsx` — animated expand/collapse
- `haptic-tab.tsx` — wraps tab press with haptic feedback
- `parallax-scroll-view.tsx` — parallax header animation

---

## State Management

All global state lives in React Context. There is no Redux, Zustand, or other state library.

| Context | Purpose | File |
|---|---|---|
| `AuthContext` | Firebase user, sign-in, sign-out | `contexts/AuthContext.tsx` |
| `GameContext` | Game CRUD, Firestore sync, all game logic | `contexts/GameContext.tsx` |
| `LanguageContext` | Active locale, locale switcher | `contexts/LanguageContext.tsx` |
| `SoundContext` | Procedural audio, mute toggle | `contexts/SoundContext.tsx` |

See [state-management.md](state-management.md) for full API of each context.

---

## Data Flow

### Joining / Creating a Game

```
User Input (game ID or admin password)
  → enterGame() in GameContext
  → Firestore read: password collection (admin check)
  → If admin password: createGame() → write new doc to games/
  → If game ID: joinGame() → update games/{id}.participants
  → onSnapshot listener attaches → currentGame state updates
  → GameScreen re-renders based on new currentGame
```

### Real-Time Sync

`GameContext` attaches a Firestore `onSnapshot` listener when the user joins a game:

```typescript
const unsubscribe = onSnapshot(doc(db, 'games', gameId), (snapshot) => {
  setCurrentGame({ id: snapshot.id, ...snapshot.data() });
});
```

All participants see the same game state in real-time. No polling.

### Comment Submission

```
Player types comment → submitComment(text)
  → Firestore transaction: append comment to currentRound.comments
  → onSnapshot fires on all clients → UI updates
  → Admin sees all comments; decides when to advance phase
```

### Guessing Phase

```
Admin calls startGuessingPhase()
  → game.status → 'guessing_phase'
  → All clients see phase change
  → Players submit guesses via submitGuess()
  → Each guess stored in guessingData
  → Admin calls finalizeGuessingPhase() → scores calculated
```

---

## Firebase Architecture

- **Project:** `spygame-2fce3`
- **Services used:** Firestore (database), Firebase Auth (Google provider)
- **No Cloud Functions** — all logic runs on-device
- **No Storage** — no file uploads
- **Real-time updates** via `onSnapshot`

See [firebase.md](firebase.md) for the full schema and security rules.

---

## Audio Architecture

`SoundContext` generates all sounds programmatically using the **Web Audio API** (via `expo-av` shim on native, native Web Audio on web). No audio asset files are bundled.

Each sound is a sequence of oscillator nodes with configured frequency, wave type, gain, and duration. This keeps the bundle size small and allows dynamic pitch changes.

---

## Localization Architecture

`LanguageContext` wraps `i18n-js`. The active locale is:
1. Loaded from `AsyncStorage` on startup (persists across sessions)
2. Defaulted to `'uk'` (Ukrainian) if not set
3. Switchable at runtime via `setLocale()`

Translation files: `locales/en.json`, `locales/uk.json`. Both must be kept in sync.

---

## Build Architecture

Three EAS build profiles in `eas.json`:

| Profile | Distribution | Output | Channel |
|---|---|---|---|
| `development` | Internal | APK + dev client | development |
| `preview` | Internal | APK | preview |
| `production` | Store | APK (auto-version) | production |

Over-the-air updates use Expo Updates with the `production` channel for production builds.
