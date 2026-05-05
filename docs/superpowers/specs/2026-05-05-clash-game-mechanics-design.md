# Head-to-Head Clash (Стінка на стінку) — Game Mechanics Design

## Overview

Head-to-Head Clash is the third game mode in In-the-Mirror. Players are divided into two equal-sized groups. Each round, every player writes an anonymous comment about one member of the opposite group. After all comments are submitted, the leader of whichever group finished writing last guesses which of their own group members each comment from the opposite group is about — then guesses the author. The other group's leader does the same. Correct guesses earn team points. Admin advances rounds until every player has written about every member of the opposite group.

---

## State Machine

```
waiting → clash_writing → clash_guessing → clash_writing (next round)
                                        ↘ finished (last round)
```

Group setup happens inside the `waiting` status. The game document stays in `waiting` until admin taps Start.

---

## Data Model

### Changes to `Game` interface

```typescript
// Extend status union:
status: 'waiting' | 'active' | 'guessing_phase' | 'finished'
       | 'basket_writing' | 'basket_guessing'
       | 'clash_writing' | 'clash_guessing';

// Extend gameType union:
gameType?: 'mirror' | 'basket' | 'clash';

// New top-level optional field:
clashData?: ClashData;
```

### New interfaces (add to GameContext.tsx above `Game`)

```typescript
interface ClashGroup {
  leaderId: string;
  memberIds: string[]; // includes leaderId
}

interface ClashAssignment {
  writerId: string;
  subjectId: string;
}

interface ClashRound {
  assignmentsA: ClashAssignment[]; // Group A member → Group B subject
  assignmentsB: ClashAssignment[]; // Group B member → Group A subject
}

interface ClashComment {
  writerId: string;
  subjectId: string;
  text: string;
  submittedAt: number;
}

interface ClashGuess {
  commentWriterId: string;    // whose comment is being guessed about
  guessedSubjectId: string;   // leader's guess for who the comment is about
  subjectCorrect: boolean;
  guessedAuthorId?: string;   // only set if subjectCorrect === true
  authorCorrect?: boolean;    // only set if subjectCorrect === true
  pointsAwarded: number;      // 0, 1, or 2
}

interface ClashData {
  groupA: ClashGroup;
  groupB: ClashGroup;
  schedule: ClashRound[];                  // N rounds (N = group size), generated at start
  currentRoundIndex: number;
  currentRoundCommentsA: ClashComment[];   // submitted by Group A members
  currentRoundCommentsB: ClashComment[];   // submitted by Group B members
  lastGroupToFinish: 'a' | 'b' | null;    // set when a group reaches 100% submissions
  currentGuessingGroup: 'a' | 'b' | null; // which leader is currently active
  currentRoundGuessesA: ClashGuess[];      // Leader A's guesses about Group B's comments
  currentRoundGuessesB: ClashGuess[];      // Leader B's guesses about Group A's comments
  teamScores: { a: number; b: number };
}
```

### Scoring

`clashData.teamScores` is kept separate from `game.scores` (used by mirror mode) to avoid interference.

| Action | Team points |
|--------|------------|
| Leader correctly identifies which group member a comment is about | +1 |
| Leader then correctly identifies who wrote it (only if subject correct) | +1 |
| Wrong subject guess | 0 |

---

## Schedule Generation

**File:** `utils/clashSchedule.ts`

**Function:** `generateClashSchedule(groupA: string[], groupB: string[]): ClashRound[]`

- Requires `groupA.length === groupB.length` (enforced before calling)
- Produces exactly N rounds where N = group size
- Each round: every Group A member is assigned exactly one Group B member, and every Group B member is assigned exactly one Group A member
- Across all rounds, every Group A member writes about every Group B member exactly once, and vice versa
- **Algorithm:** For round `r`, Group A member at index `i` is assigned Group B member at index `(i + r) % N`. Group B member at index `j` is assigned Group A member at index `(j + r) % N`.

---

## GameContext Methods

Seven new methods added to `GameContext`:

### `saveClashGroups(groupA: ClashGroup, groupB: ClashGroup): Promise<void>`
- Admin-only, game must be in `waiting` status
- Validates: `groupA.memberIds.length === groupB.memberIds.length`, each group has exactly one `leaderId`, leaderId is in memberIds, no overlap between groups
- Writes `clashData.groupA` and `clashData.groupB` to Firestore (game stays in `waiting`)

### `startClashGame(): Promise<void>`
- Admin-only, game must be in `waiting` with `clashData.groupA` and `clashData.groupB` set
- Generates schedule via `generateClashSchedule`
- Writes to Firestore: `status: 'clash_writing'`, full `clashData` with schedule and zeroed state

### `submitClashComment(text: string): Promise<void>`
- Any player, game must be in `clash_writing`
- Determines if caller is in Group A or Group B
- Finds their assignment for `currentRoundIndex` in the corresponding schedule
- Appends `ClashComment` via `arrayUnion` to `currentRoundCommentsA` or `currentRoundCommentsB`
- After appending, if that group's comment count equals group size AND the other group's count already equals group size: sets `lastGroupToFinish` to the caller's group
- If only this group just hit 100% (other group not yet): sets `lastGroupToFinish` to the caller's group (will be overwritten if the other group finishes later)

### `revealClashComments(): Promise<void>`
- Admin-only, game must be in `clash_writing`
- Validates both groups have submitted all comments (`commentsA.length === groupA.memberIds.length` AND `commentsB.length === groupB.memberIds.length`)
- Sets `status: 'clash_guessing'`, `currentGuessingGroup: lastGroupToFinish`

### `submitClashGuess(commentWriterId: string, guessedSubjectId: string): Promise<void>`
- Active leader only (caller must be leader of `currentGuessingGroup`)
- Looks up the actual `subjectId` from the corresponding comment array
- `subjectCorrect = actualSubjectId === guessedSubjectId`
- Appends `ClashGuess` (without author fields yet) to `currentRoundGuessesA` or `currentRoundGuessesB`
- If `subjectCorrect`: increments `clashData.teamScores[currentGuessingGroup]` by 1

### `submitClashAuthorGuess(commentWriterId: string, guessedAuthorId: string): Promise<void>`
- Active leader only, only callable when the corresponding `ClashGuess.subjectCorrect === true` and `guessedAuthorId` not yet set
- `authorCorrect = guessedAuthorId === commentWriterId`
- Updates the existing guess in the array (replaces it via array filter + arrayUnion or transaction)
- If `authorCorrect`: increments `clashData.teamScores[currentGuessingGroup]` by 1

### `advanceClashGuessing(): Promise<void>`
- Admin-only, game must be in `clash_guessing`
- If `currentGuessingGroup` is the first leader and the other group has not yet guessed: flips `currentGuessingGroup` to the other group
- If both groups have guessed (both guess arrays have entries for all comments):
  - Last round (`currentRoundIndex + 1 >= schedule.length`): `status = 'finished'`
  - Otherwise: `status = 'clash_writing'`, increment `currentRoundIndex`, clear `currentRoundCommentsA/B`, `currentRoundGuessesA/B`, reset `lastGroupToFinish: null`, `currentGuessingGroup: null`

---

## UI Components

All under `components/game/clash/`:

### `ClashScreen.tsx`
Router component. Receives all standard props. Routes to `ClashWritingPhase` or `ClashGuessingPhase` based on `game.status`. Same pattern as `BasketScreen`.

### `ClashSetupPanel.tsx`
Rendered inside `WaitingPhase` when `gameType === 'clash'`, replacing the target-control panel.

- **Layout:** Unassigned player pool at top. Two columns below: "Group A" and "Group B".
- **Interaction:** Long-press a player card (anywhere — pool or column) to start drag. Drag over a column to highlight it. Release to assign. Player card shows a crown icon when they are the leader of their group. Tap a player already in a column to toggle them as leader (only one leader per group allowed).
- **Validation:** Start button is enabled only when both columns are non-empty, equal in size, and each has exactly one leader.
- **Persistence:** On every drag/leader-toggle, calls `saveClashGroups()` to persist to Firestore so other participants can see group assignments in real-time.
- **Gesture implementation:** Uses `react-native-gesture-handler` (`LongPressGestureHandler` + `PanGestureHandler`) with `Animated` for the drag visual. No external drag-and-drop library required.

### `ClashWritingPhase.tsx`
- Phase wrapper: orange tint (`rgba(255,120,0,0.06)` bg, `rgba(255,120,0,0.15)` border) — distinct from basket blue/purple
- Status badge: `StatusColors.clash_writing` (`#FF7800`)
- Shows current assignment: "Write about: [name]"
- `TextInput` with `themedInput(isDark)`, 500 char max, character counter
- Submit button (disabled until text entered and all group members haven't all submitted yet for reveal)
- After submitting: waiting card showing `X/N Group A submitted · Y/N Group B submitted`
- Admin section: `ClashScoreboard` + reveal button (disabled until both groups at 100%)
- Haptics, sound, `showFancyAlert` on error — same pattern as basket

### `ClashGuessingPhase.tsx`
- Phase wrapper: orange-red tint (`rgba(255,80,0,0.06)` bg, `rgba(255,80,0,0.15)` border)
- Status badge: `StatusColors.clash_guessing` (`#FF5000`)
- `ClashScoreboard` at top
- **Active leader view:** List of anonymous comment cards from the opposite group. Tap a card to expand a subject-picker (list of own group members). On selection:
  - Correct: green feedback, author-picker appears (list of opposite group members)
  - Wrong: red feedback, card collapses, move to next
- **Non-leader view:** Waiting card "Leader [name] is guessing…"
- Admin section: "Next" button (advances to other leader or next round via `advanceClashGuessing`)
- Haptics, sound, `showFancyAlert` — same pattern as basket

### `ClashScoreboard.tsx`
Small inline component. Shows `Group A: N pts  |  Group B: N pts`. Used in both writing and guessing phases.

### `clashSchedule.ts`
Pure function, no side effects. Exported as `generateClashSchedule`. Covered by unit tests.

---

## New Statuses & Colors

Add to `constants/theme.ts`:

```typescript
// StatusColors:
clash_writing: '#FF7800',
clash_guessing: '#FF5000',

// GameColors:
clashWritingTint: 'rgba(255,120,0,0.06)',
clashWritingTintBorder: 'rgba(255,120,0,0.15)',
clashGuessingTint: 'rgba(255,80,0,0.06)',
clashGuessingTintBorder: 'rgba(255,80,0,0.15)',
```

---

## i18n Keys

All keys nested under `game.ui.clash.*` in both `locales/en.json` and `locales/uk.json`.

```
clash.round              — "Round %{current} of %{total}"
clash.groupA             — "Group A"
clash.groupB             — "Group B"
clash.leader             — "Leader"
clash.assignLeader       — "Tap to set as leader"
clash.unassigned         — "Unassigned"
clash.startGame          — "Start Game"
clash.equalSizeWarning   — "Both groups must have the same number of players"
clash.yourSubject        — "Write about:"
clash.writeComment       — "Write your comment..."
clash.submit             — "Submit"
clash.waitingForGroup    — "Group A: %{a}/%{n} · Group B: %{b}/%{n}"
clash.revealComments     — "Reveal Comments"
clash.leaderGuessing     — "%{name} is guessing…"
clash.whichMember        — "Which group member is this about?"
clash.whoWroteIt         — "Who wrote it?"
clash.correct            — "Correct! +1 point"
clash.correctAuthor      — "Right author! +1 point"
clash.wrong              — "Not quite."
clash.teamScore          — "Group A: %{a} pts  ·  Group B: %{b} pts"
clash.nextLeader         — "Next Leader"
clash.nextRound          — "Next Round"
clash.finishGame         — "Finish Game"
```

---

## GameScreen Routing

Add to `GameScreen.tsx`:

```tsx
{(game.status === 'clash_writing' || game.status === 'clash_guessing') && (
  <ClashScreen game={currentGame} user={user} isAdmin={isAdmin} locale={locale}
    isDark={isDark} getDisplayName={getDisplayName}
    showFancyAlert={showFancyAlert} showFaceMessage={showFaceMessage} />
)}
```

The `WaitingPhase` check for `gameType === 'clash'` renders `ClashSetupPanel` instead of the target-control panel (no status change needed — setup is inline).

---

## File Structure

```
components/game/clash/
  ClashScreen.tsx
  ClashSetupPanel.tsx
  ClashWritingPhase.tsx
  ClashGuessingPhase.tsx
  ClashScoreboard.tsx

utils/
  clashSchedule.ts

__tests__/
  clashSchedule.test.ts
  ClashWritingPhase.test.tsx
  ClashGuessingPhase.test.tsx
```

Modifications to existing files:
- `contexts/GameContext.tsx` — new interfaces + 7 methods + value export
- `components/game/mirror/WaitingPhase.tsx` — render `ClashSetupPanel` when `gameType === 'clash'`
- `components/game/GameScreen.tsx` — routing for clash statuses
- `constants/theme.ts` — clash colors
- `locales/en.json` + `locales/uk.json` — clash i18n keys

---

## Constraints & Edge Cases

- **Equal group size enforced** in both `saveClashGroups` (client) and `startClashGame` (server-side guard).
- **Minimum players:** 4 (2 per group). `startClashGame` throws if fewer.
- **Author guess only on correct subject:** `submitClashAuthorGuess` throws if the corresponding `ClashGuess.subjectCorrect !== true`.
- **Leader cannot guess their own comment:** The opposite group's comments are written about the leader's group — the leader is never the author of a comment they're guessing about.
- **`lastGroupToFinish` logic:** Updated every time a comment is submitted. The last group to reach 100% overwrites any earlier value. When `revealClashComments` is called, `lastGroupToFinish` is guaranteed non-null (both groups are at 100%).
- **Backward compatibility:** `clashData` is optional — old game documents without it remain valid.
