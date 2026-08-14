# CLAUDE.md — In-The-Mirror (Psychoplay / Guessme)

This file gives AI assistants full context on the project. Read it before making any changes.

## Project Overview

**In-The-Mirror** is a multiplayer psychological communication-training game. Players submit anonymous comments about each other, then try to guess who wrote what. The goal is to build self-awareness and improve interpersonal communication.

- **Backend:** Firebase (Firestore + Auth), shared by both apps below

This is an **npm-workspaces monorepo with two independently-implemented apps** that share only types, config, and i18n strings — not UI or game logic:

| App | What it is | Deployed as |
|---|---|---|
| [apps/expo/](apps/expo/) | Expo SDK 54 / React Native app. App slug `guessme`, package ID `com.psycho.play`. | iOS + Android (via EAS), plus its own minor `expo start --web` build |
| [apps/web/](apps/web/) | A separate Vite + React Router + Tailwind SPA | The actual production web app (Vercel / Firebase Hosting) |
| [packages/shared/](packages/shared/) | Firebase config, TypeScript types, i18n strings/engine, color constants, a few pure scheduling/utility algorithms | Imported by both apps as `@mirror/shared` |

**`GameContext.tsx` — the ~2,900-line core game logic — is hand-duplicated, not shared.** [apps/expo/contexts/GameContext.tsx](apps/expo/contexts/GameContext.tsx) and [apps/web/src/contexts/GameContext.tsx](apps/web/src/contexts/GameContext.tsx) are two independent implementations against the same Firestore schema. **When fixing a bug or adding a feature in one, check whether the same change is needed in the other** — this codebase has a real history of one-sided fixes (e.g. `showSurnames` worked on native for a long time before web's rendering was ever updated to apply it). The same applies to each game-mode component pair under `components/game/{mirror,basket,clash,ideas}/`.

Full docs: [docs/](docs/) — note: `docs/architecture.md` predates the monorepo split and still only describes `apps/expo`; treat it as native-only reference, not a description of `apps/web`.

---

## Tech Stack

| Layer | apps/expo | apps/web |
|---|---|---|
| Framework | Expo SDK 54, React 19, React Native 0.81 | Vite 6, React 19, React Router v6 |
| Routing | Expo Router v6 (file-based) | react-router-dom (`/`, `/game/:gameId`, `/results`, `/rules`, `/admin/cleanup`) |
| State | React Context API (4 providers) | React Context API (4 providers, separate implementations) |
| UI | Ant Design RN + custom `StyleSheet` components | Tailwind CSS |
| Sound | Web Audio API on web build / synthesized WAV via `expo-av` on native | Web Audio API (`OscillatorNode`) |
| Auth | Firebase Auth + native `@react-native-google-signin` SDK | Firebase Auth + `signInWithPopup` |
| Testing | Jest + React Native Testing Library | Vitest + `@testing-library/react` (unit), Cypress (E2E, against real prod Firebase) |
| Build | EAS (Expo Application Services) | `vite build` → Vercel / Firebase Hosting |
| Language | TypeScript (strict mode) | TypeScript (strict mode) |

Shared: Firebase Firestore (real-time) backend, i18n-js (Ukrainian default, English), Google Fonts Philosopher.

---

## Repository Layout

```
in-the-mirror/
├── apps/
│   ├── expo/                        # Native app (iOS/Android + minor web build)
│   │   ├── app/                     # Expo Router screens
│   │   │   ├── _layout.tsx          # Root layout — all providers stacked here
│   │   │   └── (tabs)/              # index (Home) / results / rules
│   │   ├── components/
│   │   │   ├── auth/AuthScreen.tsx
│   │   │   └── game/
│   │   │       ├── GameScreen.tsx           # Orchestrator: shared state, status-based routing
│   │   │       ├── GameHeader.tsx, JoinScreen.tsx, Leaderboard.tsx, AdminRoundTools.tsx
│   │   │       ├── mirror/    # Default 1v1-comment game mode (Active/Guessing/Waiting/Results phases)
│   │   │       ├── basket/    # "Basket" game mode
│   │   │       ├── clash/     # "Clash" (team) game mode
│   │   │       └── ideas/     # "Group Ideas" game mode
│   │   ├── contexts/                # AuthContext, GameContext, LanguageContext, SoundContext
│   │   ├── config/firebase.js        # Firebase app init (native)
│   │   ├── constants/, i18n/, locales/, utils/
│   │   ├── __tests__/                # Jest test suites
│   │   ├── app.json, eas.json
│   │   └── google-services.json / GoogleService-Info.plist
│   └── web/                          # Deployed web SPA
│       ├── src/
│       │   ├── pages/                # HomePage, GameJoinPage, ResultsPage, RulesPage, AdminCleanupPage
│       │   ├── components/game/      # Same mirror/basket/clash/ideas structure as apps/expo, separate files
│       │   ├── contexts/             # AuthContext, GameContext, LanguageContext, SoundContext (separate from apps/expo)
│       │   ├── utils/, hooks/, constants/
│       │   └── App.tsx               # react-router-dom routes + bottom nav
│       ├── cypress/                  # E2E suite (real production Firebase)
│       └── vite.config.ts, tailwind.config.js
├── packages/
│   └── shared/src/                   # @mirror/shared — Firebase init, types, i18n, constants, pure utils
├── docs/                             # Extended documentation (see below; some predates the monorepo split)
├── .github/workflows/cypress-e2e.yml # CI — Cypress E2E only; no CI runs the Jest suite
├── vercel.json, firebase.json        # Point at apps/web/dist
└── package.json                      # npm workspaces root
```

---

## Key Concepts

### Game State Machine

The game moves through these statuses (stored in Firestore), identically on both apps:

```
waiting → active → guessing_phase → (post-guessing point phase) → next round / finished
```

See [docs/game-mechanics.md](docs/game-mechanics.md) for the complete flow.

### Provider Hierarchy

Providers are stacked the same way in `apps/expo/app/_layout.tsx` and `apps/web/src/App.tsx`, outermost to innermost:

```
SoundProvider
  └─ LanguageProvider
       └─ AuthProvider
            └─ GameProvider
                 └─ ThemeProvider (apps/expo only)
                      └─ <app screens>
```

**Import order matters.** `GameProvider` depends on `AuthProvider`; never reorder them.

### Admin Password

Creating a game requires entering the admin password stored in Firestore at:
`password/YR20RZ67FKy88HQVF6yW` (the `password` field — not `value`).

The current admin password is: **YR20RZ67FKy88HQVF6yW3**

Note the doc ID and the password value are similar but distinct strings — the value has a trailing `3` that the doc ID does not.

Non-admins join by entering a game ID directly.

### Path Aliases

- `apps/expo`: `@/*` maps to the `apps/expo/` root.
- `apps/web`: `@/*` maps to `apps/web/src/`; `@mirror/shared` maps to `packages/shared/src/index.ts`.

```typescript
// apps/expo
import { theme } from '@/constants/theme';
import { useGame } from '@/contexts/GameContext';

// apps/web
import { useGame } from '@/contexts/GameContext';
import { auth, db } from '@mirror/shared';
```

---

## Development Setup

```bash
npm install                # installs all workspaces from the repo root

npm run expo                # apps/expo: npx expo start (tunnel for devices)
npx expo start --web        # from apps/expo: web-only Expo build (not the deployed web app)
npx expo run:android        # from apps/expo
npx expo run:ios            # from apps/expo

npm run web                 # apps/web: vite dev server (the actual deployed web app)
npm run build:web           # apps/web: vite build
```

### Running Tests

```bash
# apps/expo (Jest)
cd apps/expo && npm test              # all tests
npm run test:watch                    # watch mode
npm run test:coverage                 # coverage report

# apps/web (Vitest — unit tests; Cypress — E2E against real prod Firebase)
cd apps/web && npm test               # vitest run
npm run cypress:open                  # interactive E2E
npm run cypress:run                   # headless E2E
```

Only the Cypress suite runs in CI ([.github/workflows/cypress-e2e.yml](.github/workflows/cypress-e2e.yml)); the Jest and Vitest suites are local-only for now.

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

All user-facing strings must use the `t()` function. Keys live in `packages/shared` i18n strings, consumed via each app's `LanguageContext`. When adding a new string, add it for **both** locales (Ukrainian + English).

```typescript
const { t } = useLanguage();
<Text>{t('game.submitComment')}</Text>   {/* apps/expo */}
{t('game.submitComment')}                {/* apps/web */}
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
├── games/{gameId}                  # Game document — same schema on both apps
│   ├── adminId, adminName, adminEmail
│   ├── status: 'waiting' | 'active' | 'guessing_phase' | 'finished'
│   ├── participants: Participant[]
│   ├── currentRound: Round | null
│   ├── rounds: Round[]
│   ├── scores: { [userId]: number }
│   ├── guessingData: GuessingData
│   ├── guessResults: { [userId]: { correctGuesses: number } }
│   └── settings: adminWritesComments, showSurnames, showGuessResults, targetSelectionMode
│       (showGuessResults is currently unimplemented on BOTH apps — stored/toggleable, never read)
└── password/{docId}                # Admin password document
    └── password: string
```

Full schema: [docs/firebase.md](docs/firebase.md)

---

## Build & Deployment

```bash
# apps/expo — from apps/expo/
eas build --platform android --profile preview      # APK for testing
eas build --platform android --profile production   # Production APK

# apps/web — deployed via Vercel / Firebase Hosting from apps/web/dist,
# NOT via EAS. See vercel.json / firebase.json at the repo root.
```

EAS profiles: `development` | `preview` | `production`

Full guide: [docs/deployment.md](docs/deployment.md) (native only — predates apps/web)

---

## Code Style Rules

- **TypeScript strict mode** is enabled — no `any` without justification.
- All interfaces defined in the same file as the context that owns them.
- Components receive only what they need via hooks/props — no unnecessary prop drilling.
- `GameScreen.tsx` (in both apps) is a thin orchestrator. Each game phase/mode has its own component under `components/game/{mirror,basket,clash,ideas}/`. Add new phase UI to the relevant phase component, not to `GameScreen.tsx`.
- When adding a new game phase or sub-feature, create a dedicated component and wire it into `GameScreen.tsx`'s status-based routing — **and check whether the change needs to be mirrored in the other app** (see the duplication note in Project Overview).
- Do not hardcode user-facing strings. Use `t()`.
- Do not call Firestore from components. Use `GameContext` methods.
- New Firebase fields must be added to **both** the TypeScript interface (in both `GameContext.tsx` files) and handled for backward compatibility (older games may lack the field).
- `apps/expo` uses RN `StyleSheet.create`; `apps/web` uses Tailwind utility classes. Don't port styling approaches across apps — port behavior/logic, restyle idiomatically for the target app.

---

## Extended Documentation

| File | Contents | Scope |
|---|---|---|
| [docs/architecture.md](docs/architecture.md) | System architecture and data flow | **apps/expo only** — predates apps/web |
| [docs/game-mechanics.md](docs/game-mechanics.md) | Game phases, rules, scoring, variations | Both apps |
| [docs/state-management.md](docs/state-management.md) | Contexts, hooks, and state shape | **apps/expo only** — predates apps/web |
| [docs/firebase.md](docs/firebase.md) | Firestore schema, auth setup, security | Both apps |
| [docs/localization.md](docs/localization.md) | i18n setup, adding languages, translation keys | Both apps |
| [docs/testing.md](docs/testing.md) | Test setup, mocking strategy, writing new tests | Both apps (documents the Jest/Cypress split) |
| [docs/deployment.md](docs/deployment.md) | EAS builds, signing, channels, submission | **apps/expo only** |
