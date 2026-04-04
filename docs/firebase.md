# Firebase

## Project Details

| Field | Value |
|---|---|
| Project ID | `spygame-2fce3` |
| Auth domain | `spygame-2fce3.firebaseapp.com` |
| Firestore region | Default (us-central1) |
| Services used | Firestore, Firebase Authentication |

Config is in `config/firebase.js`. Credentials are currently hardcoded — move to environment variables before any public release.

---

## Authentication

### Provider

Google Sign-In only (no email/password, no other social providers).

### Platform Differences

| Platform | Method |
|---|---|
| Web | `signInWithPopup(auth, googleProvider)` |
| iOS / Android | `@react-native-google-signin/google-signin` → Firebase credential exchange |

### Google OAuth Credentials

| Key | Value |
|---|---|
| Web Client ID | `841856303776-n0qnohvvtecnmgj9a8dk2q0s16k820ol.apps.googleusercontent.com` |
| Android Client ID | `726884000116-mfedbdu3fkb8knq3v6u8hequ0oab68s9.apps.googleusercontent.com` |

Both are configured in `app.json` under `extra.googleAuth` and read by `AuthContext`.

### Session Persistence

Firebase Auth handles session persistence automatically. On app restart `onAuthStateChanged` fires with the cached user — no re-login required.

---

## Firestore Schema

### Collection: `games`

Each document is one game session.

```
games/
└── {gameId}/
    ├── adminId: string
    ├── adminName: string
    ├── adminEmail: string
    ├── createdAt: Timestamp
    ├── status: 'waiting' | 'active' | 'guessing_phase' | 'finished'
    ├── adminWritesComments: boolean (default: false)
    ├── showSurnames: boolean (default: false)
    ├── showGuessResults: boolean (default: false)
    ├── targetSelectionMode: 'random' | 'chronological' (default: 'random')
    ├── postGuessingPointPhase: boolean (optional)
    ├── playersWhoAwardedPostGuessPoints: string[] (userIds)
    ├── adminLeft: boolean (optional)
    │
    ├── participants: Participant[]
    │   └── {
    │         userId: string,
    │         userName: string,
    │         userEmail: string,
    │         joinedAt: Timestamp,
    │         hasBeenTarget: boolean (optional)
    │       }
    │
    ├── currentRound: Round | null
    │   └── {
    │         roundNumber: number,
    │         targetUserId: string,
    │         targetUserName: string,
    │         commentsVisible: boolean,
    │         pointsGiven: boolean,
    │         startedAt: Timestamp,
    │         targetPoints: number (optional),
    │         targetPointsGivenBy: string[] (optional),
    │         targetCorrectGuesses: number (optional),
    │         comments: Comment[],
    │         guesses: Guess[] (optional)
    │       }
    │
    ├── rounds: Round[]             (archive of completed rounds)
    │
    ├── scores: { [userId]: number }
    │
    ├── guessResults: { [userId]: { correctGuesses: number } }
    │
    └── guessingData: {
            [roundNumber]: {
              [commentId]: {
                [guesserId]: {
                  guessedAuthorId: string,
                  correct: boolean,
                  guessedAt: Timestamp
                }
              }
            }
          }
```

### Comment (nested in Round)

```
{
  id: string,
  authorId: string,
  text: string,
  submittedAt: Timestamp,
  points: number (optional)
}
```

### Guess (nested in Round)

```
{
  commentId: string,
  guesserId: string,
  guessedAuthorId: string,
  correct: boolean,
  guessedAt: Timestamp
}
```

---

### Collection: `password`

Stores the admin password. One document with a known ID.

```
password/
└── YR20RZ67FKy88HQVF6yW/
    └── value: string    ← the admin password
```

**Current admin password:** `YR20RZ67FKy88HQVF6yW`

When a user enters this string in the game ID field, `GameContext.enterGame()` creates a new game instead of joining.

> Security note: This is a simple shared secret. It prevents random users from accidentally creating games but is not production-grade access control. Do not use this pattern for sensitive data.

---

## Real-Time Updates

The app attaches a single Firestore `onSnapshot` listener per active game:

```typescript
onSnapshot(doc(db, 'games', gameId), (snapshot) => {
  if (snapshot.exists()) {
    setCurrentGame({ id: snapshot.id, ...snapshot.data() as Omit<Game, 'id'> });
  }
});
```

This fires immediately with current data, then again on every write. All four participants see updates within ~100–300ms on a normal connection.

The listener is stored in a ref and unsubscribed when:
- `leaveGame()` is called
- The component unmounts

---

## Firestore Operations Used

| Operation | Used for |
|---|---|
| `setDoc` | Creating a new game |
| `updateDoc` | Phase transitions, score updates, settings |
| `arrayUnion` | Adding a participant, adding a comment |
| `arrayRemove` | Removing a participant |
| `runTransaction` | Atomic score calculations |
| `onSnapshot` | Real-time game state sync |
| `getDoc` | Reading admin password |
| `serverTimestamp` | All `*At` timestamp fields |

---

## Adding New Fields to the Schema

When adding a new field to a game document:

1. Add the field to the `Game` (or sub-interface) TypeScript interface in `GameContext.tsx`.
2. Handle `undefined` gracefully — existing game documents won't have the field. Use `?? defaultValue`.
3. Write the field in `createGame()` with its default value so new games always have it.
4. Update this file.

Example:

```typescript
// In the interface
newFeatureEnabled?: boolean;

// In createGame()
newFeatureEnabled: false,

// When reading
const isEnabled = currentGame?.newFeatureEnabled ?? false;
```

---

## Android Configuration

`google-services.json` in the project root is required for Firebase on Android. It maps the package name `com.psycho.play` to the Firebase project. This file is committed to the repo (it contains no secret keys, only app identifiers).

---

## Security Rules

Current Firestore security rules are not documented here (check the Firebase Console). Recommended minimum rules for production:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Only authenticated users can read/write games
    match /games/{gameId} {
      allow read, write: if request.auth != null;
    }
    // Password is read-only for authenticated users
    match /password/{docId} {
      allow read: if request.auth != null;
      allow write: if false;
    }
  }
}
```
