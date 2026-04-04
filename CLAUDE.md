# CLAUDE.md — In-The-Mirror (Psychoplay / Guessme)

This file gives AI assistants full context on the project. Read it before making any changes.

## Project Overview

**In-The-Mirror** is a multiplayer psychological communication-training game built with Expo React Native. Players submit anonymous comments about each other, then try to guess who wrote what. The goal is to build self-awareness and improve interpersonal communication.

- **App slug:** `guessme` | **Package ID:** `com.psycho.play`
- **Platforms:** iOS, Android, Web
- **Backend:** Firebase (Firestore + Auth)

Full docs: [docs/](docs/)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 54, React 19, React Native 0.81 |
| Routing | Expo Router v6 (file-based) |
| State | React Context API (4 providers) |
| Backend | Firebase Firestore (real-time) |
| Auth | Firebase Auth + Google Sign-In |
| UI | Ant Design RN + custom components |
| Fonts | Google Fonts: Philosopher |
| i18n | i18n-js, locales: Ukrainian (default), English |
| Sound | Web Audio API procedural tone generation |
| Testing | Jest + React Native Testing Library |
| Build | EAS (Expo Application Services) |
| Language | TypeScript (strict mode) |

---

## Repository Layout

```
in-the-mirror/
├── app/                    # Expo Router screens
│   ├── _layout.tsx         # Root layout — all providers stacked here
│   ├── (tabs)/
│   │   ├── _layout.tsx     # Tab bar config (Home / Results / Rules)
│   │   ├── index.tsx       # Home: shows AuthScreen or GameScreen
│   │   ├── results.tsx     # Leaderboard + round history
│   │   └── rules.tsx       # Game rules
│   └── modal.tsx
├── components/
│   ├── auth/AuthScreen.tsx     # Sign-in / sign-out UI
│   ├── game/GameScreen.tsx     # Main game UI (~2000 lines)
│   └── ui/                     # Shared UI primitives
├── contexts/
│   ├── AuthContext.tsx          # Firebase auth state
│   ├── GameContext.tsx          # Game logic & Firestore (~1500 lines)
│   ├── LanguageContext.tsx      # i18n locale switching
│   └── SoundContext.tsx         # Audio effects
├── config/firebase.js           # Firebase app init
├── constants/
│   ├── theme.ts                 # Color palette
│   └── globalStyles.ts          # Shared style constants
├── i18n/index.ts                # i18n-js setup
├── locales/en.json              # English strings
├── locales/uk.json              # Ukrainian strings
├── utils/gameIdGenerator.ts     # Generates Ukrainian-word game IDs
├── __tests__/                   # Jest test suites
├── docs/                        # Extended documentation
├── app.json                     # Expo config
├── eas.json                     # EAS build profiles
└── google-services.json         # Firebase Android config
```

---

## Key Concepts

### Game State Machine

The game moves through these statuses (stored in Firestore):

```
waiting → active → guessing_phase → (post-guessing point phase) → next round / finished
```

See [docs/game-mechanics.md](docs/game-mechanics.md) for the complete flow.

### Provider Hierarchy

Providers are stacked in `app/_layout.tsx` from outermost to innermost:

```
SoundProvider
  └─ LanguageProvider
       └─ AuthProvider
            └─ GameProvider
                 └─ ThemeProvider
                      └─ <app screens>
```

**Import order matters.** `GameProvider` depends on `AuthProvider`; never reorder them.

### Admin Password

Creating a game requires entering the admin password stored in Firestore at:
`password/YR20RZ67FKy88HQVF6yW` (the `value` field).

The current admin password is: **YR20RZ67FKy88HQVF6yW**

Non-admins join by entering a game ID directly.

### Path Aliases

TypeScript path alias `@/*` maps to the project root. Use it for all non-relative imports:

```typescript
import { theme } from '@/constants/theme';
import { useGame } from '@/contexts/GameContext';
```

---

## Development Setup

```bash
npm install
npx expo start          # Start dev server (tunnel for devices)
npx expo start --web    # Web only
npx expo run:android    # Build and run on Android
npx expo run:ios        # Build and run on iOS
```

### Running Tests

```bash
npm test                  # All tests
npm run test:watch        # Watch mode
npm run test:coverage     # Coverage report
```

---

## Important Patterns

### Accessing Game State

Always use hooks — never access contexts directly:

```typescript
const { currentGame, submitComment, startNextRound } = useGame();
const { user, isSignedIn } = useAuth();
const { t } = useLanguage();    // t('game.start')
const { playSound } = useSound();
```

### Firestore Operations

All Firestore writes go through `GameContext`. **Do not** call Firestore directly from components. The context handles real-time listeners, transactions, and cleanup.

### Localization

All user-facing strings must use the `t()` function. Keys live in `locales/en.json` and `locales/uk.json`. When adding a new string, add it to **both** files.

```typescript
const { t } = useLanguage();
<Text>{t('game.submitComment')}</Text>
```

### Sound Effects

```typescript
const { playSound } = useSound();
playSound('success');   // success | error | click | gameStart | points | correctGuess | wrongGuess | roundComplete | gameOver | timerWarning | achievement | notification | copy
```

---

## Firebase Data Model

```
Firestore
├── games/{gameId}                  # Game document
│   ├── adminId, adminName, adminEmail
│   ├── status: 'waiting' | 'active' | 'guessing_phase' | 'finished'
│   ├── participants: Participant[]
│   ├── currentRound: Round | null
│   ├── rounds: Round[]
│   ├── scores: { [userId]: number }
│   ├── guessingData: GuessingData
│   ├── guessResults: { [userId]: { correctGuesses: number } }
│   └── settings: adminWritesComments, showSurnames, showGuessResults, targetSelectionMode
└── password/{docId}                # Admin password document
    └── value: string
```

Full schema: [docs/firebase.md](docs/firebase.md)

---

## Build & Deployment

```bash
eas build --platform android --profile preview      # APK for testing
eas build --platform android --profile production   # Production APK
```

Profiles: `development` | `preview` | `production`

Full guide: [docs/deployment.md](docs/deployment.md)

---

## Code Style Rules

- **TypeScript strict mode** is enabled — no `any` without justification.
- All interfaces defined in the same file as the context that owns them.
- Components receive only what they need via hooks — no prop drilling.
- `GameScreen.tsx` is large (~2000 lines) by design. It handles all game phase rendering. Refactor only if extracting a clearly self-contained sub-feature.
- Do not hardcode user-facing strings. Use `t()`.
- Do not call Firestore from components. Use `GameContext` methods.
- New Firebase fields must be added to **both** the TypeScript interface and handled for backward compatibility (older games may lack the field).

---

## Extended Documentation

| File | Contents |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Full system architecture and data flow |
| [docs/game-mechanics.md](docs/game-mechanics.md) | Game phases, rules, scoring, variations |
| [docs/state-management.md](docs/state-management.md) | All four contexts, hooks, and state shape |
| [docs/firebase.md](docs/firebase.md) | Firestore schema, auth setup, security |
| [docs/localization.md](docs/localization.md) | i18n setup, adding languages, translation keys |
| [docs/testing.md](docs/testing.md) | Test setup, mocking strategy, writing new tests |
| [docs/deployment.md](docs/deployment.md) | EAS builds, signing, channels, submission |
