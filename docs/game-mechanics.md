# Game Mechanics

## Concept

**In-The-Mirror** is a psychological communication training exercise. Participants write anonymous comments about one chosen player (the "target"), then everyone tries to guess who wrote each comment. The game builds self-awareness, observational skills, and the ability to communicate clearly about people.

---

## Roles

| Role | Description |
|---|---|
| **Admin** | Creates the game, controls all phase transitions, optionally participates in commenting |
| **Participant** | Joins via game ID, submits comments, guesses authors |
| **Target** | The player currently being commented on — changes each round |

---

## Game Status State Machine

```
waiting
   │
   ▼ (admin starts game)
active                          ← comment submission phase
   │
   ▼ (admin calls showComments / starts guessing)
guessing_phase                  ← players submit guesses
   │
   ▼ (admin finalizes guessing)
post_guessing_point_phase       ← players award bonus points
   │
   ▼ (all players done or admin skips)
active (next round)             ← new target selected
   │
   ▼ (all rounds complete)
finished
```

The `status` field on the game document drives all UI changes. Every client reacts to status transitions via the Firestore `onSnapshot` listener.

---

## Phases in Detail

### 1. Waiting Phase (`status: 'waiting'`)

**What happens:**
- Admin has created the game; participants are joining.
- Admin can configure settings before starting.

**Admin controls:**
| Setting | Description |
|---|---|
| `adminWritesComments` | Whether the admin submits comments alongside participants |
| `showSurnames` | Show full names or first names only |
| `targetSelectionMode` | `'random'` — admin picks random participant each round; `'chronological'` — cycles by join order |
| `showGuessResults` | Show guess accuracy results to the target after guessing |

**Known gaps:**
- `showSurnames` and `showGuessResults` are stored in Firestore and toggleable from the admin UI in `apps/web`, but currently have no effect anywhere in `apps/web`'s rendering — only the toggle itself and the context getter/setter reference them there.
- `showSurnames` works correctly in `apps/expo` (see `apps/expo/components/game/GameScreen.tsx`, which formats participant names based on it). Its lack of effect in `apps/web` is a web-port gap, not an intentional design decision.
- `showGuessResults` appears unimplemented on both platforms — it's stored and toggleable in `apps/expo` too, but nothing reads it to actually gate guess-result visibility.

**Game ID:**
- Game IDs are generated from Ukrainian words (see `utils/gameIdGenerator.ts`).
- Participants can join by typing the ID or scanning a QR code.

---

### 2. Active Phase — Comment Submission (`status: 'active'`)

**What happens:**
- A target is selected (random or by join order).
- All participants except the target submit one anonymous comment about the target.
- If `adminWritesComments` is true, the admin also submits a comment.
- Comments are stored with an author ID but displayed without attribution.

**Rules:**
- Each participant can submit exactly one comment per round.
- The target cannot see who wrote what until the guessing phase.
- The admin can see the full comment list and decides when to move forward.

**Admin transitions:**
- `showComments()` — reveals comments to all players (still no author attribution).
- `startGuessingPhase()` — moves to the guessing phase.

---

### 3. Guessing Phase (`status: 'guessing_phase'`)

**What happens:**
- All comments are now visible.
- Each player submits guesses: for each comment, who do you think wrote it?
- Players guess the author of comments written about the target.

**Scoring during guessing:**
- Correct author guess → points for the guesser.
- Correct identification → target earns points for each correct guess (others were paying attention).

**`guessingData` structure:**
```typescript
interface GuessingData {
  [roundNumber: string]: {
    [commentId: string]: {
      [guesserId: string]: {
        guessedAuthorId: string;
        correct: boolean;
        guessedAt: Timestamp;
      }
    }
  }
}
```

**Finishing guessing:**
- Players call `markPlayerGuessesSubmitted()` when done.
- Admin calls `finalizeGuessingPhase()` which:
  1. Calculates correct guesses per player.
  2. Updates `scores` and `guessResults`.
  3. Optionally starts the post-guessing point phase.

---

### 4. Post-Guessing Point Phase (`postGuessingPointPhase: true`)

**What happens:**
- Players can award bonus points to each other for good reactions, insightful comments, or entertaining guesses.
- Each player calls `awardPointsToPlayers()` with a list of recipients and point amounts.
- Once all players have awarded (or the admin skips), the round ends.

**Tracking:**
- `playersWhoAwardedPostGuessPoints` — array of userIds who have completed this phase.
- Admin can call `skipPostCommentPhase()` to advance without waiting.

---

### 5. Round Cycling

After a round completes:
- `startNextRound()` selects a new target (based on `targetSelectionMode`).
- Game status returns to `'active'`.
- Previous round data is preserved in the `rounds` array.

When all participants have been the target (or admin decides to end), the game finishes.

---

## Scoring System

```
Total Score = Game Points + Guess Points
```

| Points Type | How Earned | Who Earns |
|---|---|---|
| **Comment points** | Target awards points to comment authors after reading | Comment authors |
| **Target points** | Participants award points to the target for reacting well | Target |
| **Guess points** | Awarded for each correctly guessed comment author | Guesser |
| **Reaction points** | Bonus points in post-guessing phase | Any player |

Scores are stored in `game.scores: { [userId]: number }`.
Guess results are stored in `game.guessResults: { [userId]: { correctGuesses: number } }`.

---

## Game Variations

The rules screen documents three variations:

### Variation A — "Telescope"
Standard mode. One target per round, everyone writes about that target.

### Variation B — "Basket"
Everyone writes a comment about any player (not just the designated target). Comments are then sorted and read aloud.

### Variation C — "Basket Exchange"
Like Basket, but comments are exchanged anonymously and players respond to what they received.

> Note: Variations B and C are described in the rules screen but the current codebase implements Variation A only. The `targetSelectionMode` setting is the main configurability lever.

---

## Target Selection Modes

### `'random'`
The admin selects a random non-admin participant who has not yet been the target. The admin has UI to trigger this selection.

### `'chronological'`
Participants become the target in the order they joined the game (by `joinedAt` timestamp). The system cycles through automatically.

---

## Admin-Less Flow

If the admin leaves mid-game, `leaveGame()`'s admin branch (`GameContext.tsx`) writes the following fields in a single Firestore transaction: `status: 'finished'`, `currentRound: null`, `adminLeft: true`, `adminNextTargetPreference: null`, `playersWhoCompletedPostCommentPhase: []`. The game does not linger in a blocked or partially-frozen state — it is immediately over, and there are no further phase transitions to block.

`ResultsPhase.tsx` checks `game.adminLeft` and renders a dedicated view (`data-cy="admin-left"`) instead of the normal finished view (`data-cy="game-finished"`) whenever it's set. Remaining participants land on this admin-left view via the existing real-time Firestore listener, with no extra action required.

The leaving admin's own client is not exempt from this: their still-mounted `GameScreen` receives the same real-time update, and a `useEffect` watching `currentGame?.adminLeft` self-fires the "Admin has left the game" alert on their own screen too. After dismissing it, the admin lands on the same admin-left `ResultsPhase` view as everyone else — **not** a fresh `JoinScreen` or lobby. This was unexpected going in, but was confirmed both by a Cypress run and independent manual verification against production, so it's the actual, current behavior.

Note: the `game.ui.adminLeftMessage` translation string (`packages/shared/src/locales/en.json` / `uk.json`) currently reads "You will be returned to the lobby" (or the Ukrainian equivalent). That promise is not implemented anywhere — nobody is navigated back to a lobby, admin or otherwise. This is a pre-existing copy/behavior mismatch, left as-is for now.

Regression coverage: `apps/web/cypress/e2e/admin-left.cy.ts`.

---

## Data Shapes

### Game Document

```typescript
interface Game {
  id: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  participants: Participant[];
  createdAt: Timestamp;
  status: 'waiting' | 'active' | 'guessing_phase' | 'finished';
  currentRound: Round | null;
  rounds: Round[];
  scores: { [userId: string]: number };
  guessingData: GuessingData;
  guessResults: { [userId: string]: { correctGuesses: number } };
  adminWritesComments?: boolean;
  showSurnames?: boolean;
  showGuessResults?: boolean;
  targetSelectionMode?: 'random' | 'chronological';
  postGuessingPointPhase?: boolean;
  playersWhoAwardedPostGuessPoints?: string[];
  adminLeft?: boolean;
}
```

### Participant

```typescript
interface Participant {
  userId: string;
  userName: string;
  userEmail: string;
  joinedAt: Timestamp;
  hasBeenTarget?: boolean;
}
```

### Round

```typescript
interface Round {
  roundNumber: number;
  targetUserId: string;
  targetUserName: string;
  comments: Comment[];
  commentsVisible: boolean;
  pointsGiven: boolean;
  startedAt: Timestamp;
  targetPoints?: number;
  targetPointsGivenBy?: string[];
  guesses?: Guess[];
  targetCorrectGuesses?: number;
}
```

### Comment

```typescript
interface Comment {
  id: string;
  authorId: string;
  text: string;
  submittedAt: Timestamp;
  points?: number;
}
```

### Guess

```typescript
interface Guess {
  commentId: string;
  guesserId: string;
  guessedAuthorId: string;
  correct: boolean;
  guessedAt: Timestamp;
}
```
