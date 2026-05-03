# Basket Game Mechanics — Design Spec

**Date:** 2026-05-03

## Overview

Implement the full Basket game mode for In-the-Mirror. Basket is a multiplayer comment-and-guess game where every player secretly writes about a randomly assigned other player each round. After all comments are written, the admin reveals them anonymously and players guess which comment is about them, then who wrote it.

---

## Status Machine

Basket uses two new top-level game statuses, completely separate from Mirror's `active` / `guessing_phase`:

```
waiting → basket_writing → basket_guessing → [basket_writing (next round)] → finished
```

- `basket_writing` — players secretly write their comment about their assigned subject
- `basket_guessing` — admin has revealed comments; players guess which is about them

**Transitions:**
- `waiting` → `basket_writing`: admin presses Start (generates full schedule)
- `basket_writing` → `basket_guessing`: admin presses Reveal Comments
- `basket_guessing` → `basket_writing`: admin presses Next Round (if rounds remain)
- `basket_guessing` → `finished`: admin presses Next Round on the last round

---

## Round Schedule Generation

For N players, the game has exactly **N-1 rounds**. The schedule is generated once when the game starts and stored in Firestore. By the end of the game, every player has written about every other player exactly once.

**Algorithm:**
1. Shuffle participants into a random order → indexed `[p0, p1, ..., p(N-1)]`
2. For round `r` (0 to N-2): player at index `i` writes about player at index `(i + r + 1) % N`

**Example with 4 players [A, B, C, D]:**
```
Round 0: A→B, B→C, C→D, D→A
Round 1: A→C, B→D, C→A, D→B
Round 2: A→D, B→A, C→B, D→C
```

No self-assignments are possible (shift is always ≥ 1). Edge cases:
- **2 players:** 1 round, A→B and B→A simultaneously — valid.
- **1 player:** admin is blocked from starting (enforced in UI and GameContext).

The schedule is extracted into a pure utility function `generateBasketSchedule(participantIds: string[]): BasketRound[]` for easy unit testing.

---

## Data Model

New TypeScript interfaces added to `GameContext.tsx`:

```typescript
interface BasketAssignment {
  writerId: string;
  subjectId: string;
}

interface BasketRound {
  assignments: BasketAssignment[];
}

interface BasketComment {
  writerId: string;    // not shown to other players during basket_guessing
  subjectId: string;   // not shown to other players during basket_guessing
  text: string;
  submittedAt: number;
}

interface BasketGuess {
  guesserId: string;
  commentWriterId: string;   // writerId of the comment they believe is about them
  authorGuessId?: string;    // only present if commentCorrect is true
  commentCorrect: boolean;
  authorCorrect: boolean;
  pointsAwarded: number;     // 0, 1, or 2
}
```

New optional field on the `Game` interface:

```typescript
basketData?: {
  schedule: BasketRound[];
  currentRoundIndex: number;
  currentRoundComments: BasketComment[];
  currentRoundGuesses: BasketGuess[];
}
```

`game.scores` (the existing `{ [userId]: number }` map) is updated by `submitBasketGuess` — no new scoring field needed.

Comments are stored in Firestore with `writerId` and `subjectId` intact. The UI simply does not render those fields during `basket_guessing` — no client-side filtering or encryption is needed.

---

## GameContext Methods

Six new methods:

### `startBasketGame(): Promise<void>`
- Blocked if `participants.length < 2` (throws or shows alert)
- Generates schedule via `generateBasketSchedule`
- Writes to Firestore: `{ status: 'basket_writing', basketData: { schedule, currentRoundIndex: 0, currentRoundComments: [], currentRoundGuesses: [] } }`

### `submitBasketComment(text: string): Promise<void>`
- Player submits their comment for the current round
- Looks up their assignment from `basketData.schedule[currentRoundIndex]`
- Appends `BasketComment` to `basketData.currentRoundComments` via Firestore array union

### `revealBasketComments(): Promise<void>`
- Admin only
- Sets `status: 'basket_guessing'`

### `submitBasketCommentGuess(commentWriterId: string): Promise<void>`
- Step 1 of the two-step guess flow
- `commentWriterId` is the writerId of the comment the player believes is about them
- Finds the actual comment about this player: the comment in `currentRoundComments` where `subjectId === guesserId`
- `commentCorrect = true` if `commentWriterId` matches that comment's `writerId`
- Awards 1 point to `game.scores[guesserId]` if correct
- Writes a `BasketGuess` record to `basketData.currentRoundGuesses` with `commentCorrect`, `pointsAwarded: commentCorrect ? 1 : 0`
- If wrong, the guess is finalised here (no author step)

### `submitBasketAuthorGuess(authorGuessId: string): Promise<void>`
- Step 2 of the two-step guess flow — only reachable if step 1 was correct
- `authorGuessId` is the userId the player believes wrote the comment about them
- Looks up the actual writer from `basketData.schedule[currentRoundIndex]` (assignment where `subjectId === guesserId`)
- `authorCorrect = true` if `authorGuessId === actualWriterId`
- Awards 1 additional point to `game.scores[guesserId]` if correct
- Updates the existing `BasketGuess` record for this guesser with `authorGuessId`, `authorCorrect`, updated `pointsAwarded`

### `startNextBasketRound(): Promise<void>`
- Admin only
- If `currentRoundIndex + 1 >= schedule.length`: sets `status: 'finished'`
- Otherwise: increments `currentRoundIndex`, clears `currentRoundComments` and `currentRoundGuesses`, sets `status: 'basket_writing'`

---

## Components

All basket components live in `components/game/basket/`.

### `BasketScreen.tsx` (update existing placeholder)
Routes between phases based on `game.status`:
```tsx
{status === 'basket_writing'  && <BasketWritingPhase  ... />}
{status === 'basket_guessing' && <BasketGuessingPhase ... />}
```

### `BasketWritingPhase.tsx`
- Displays current round number and total rounds (e.g. "Round 1 of 3")
- Shows the player their assigned subject's display name
- Text input + Submit button for writing the comment
- After submitting: "waiting for others" state (no re-submission)
- Admin sees "Reveal Comments" button — enabled once all players have submitted (or always forceable)
- Admin sees count of how many players have submitted

### `BasketGuessingPhase.tsx`
- Shows all `currentRoundComments` as anonymous cards (text only — no author or subject)
- Each player selects the card they believe is about them → calls `submitBasketCommentGuess(commentWriterId)`
- **If correct:** shows success feedback, then prompts "Who wrote this?" — renders a list of other players' names; player taps one → calls `submitBasketAuthorGuess(authorGuessId)`
- **If wrong:** shows error feedback; no author-guess prompt
- After a player has fully submitted, shows waiting state
- Admin sees count of how many players have guessed, plus "Next Round" / "Finish Game" button

---

## Scoring

| Action | Points |
|--------|--------|
| Correctly identify your comment | +1 |
| Correctly identify the author (only if above correct) | +1 |
| Wrong comment guess | 0 |

Points go into `game.scores[userId]` — same field used by Mirror — so the existing leaderboard renders correctly for both game types.

---

## i18n Keys Required

Add to both `locales/en.json` and `locales/uk.json` under `game.ui`:

```
basket.round                 "Round {current} of {total}"
basket.yourSubject           "Write about:"
basket.writeComment          "Write your comment..."
basket.submit                "Submit"
basket.waitingForOthers      "Waiting for others... ({count}/{total} submitted)"
basket.revealComments        "Reveal Comments"
basket.whichIsAboutYou       "Which comment is about you?"
basket.whoWroteIt            "Who wrote it?"
basket.correct               "Correct! +1 point"
basket.correctAuthor         "Right author! +1 point"
basket.wrong                 "Not quite."
basket.nextRound             "Next Round"
basket.finishGame            "Finish Game"
basket.waitingForGuesses     "{count}/{total} players guessed"
```

---

## Testing Strategy

### `__tests__/basketSchedule.test.ts` — pure function, no mocks
- Generates exactly N-1 rounds for N players
- Every player writes about every other player exactly once (complete coverage)
- No self-assignments in any round
- Works for N=2, N=3, N=4, N=5

### `__tests__/GameContext.basket.test.ts` — GameContext integration
- `startBasketGame` sets `status: 'basket_writing'`, `currentRoundIndex: 0`, non-empty schedule
- `startBasketGame` blocked (throws) when fewer than 2 participants
- `submitBasketComment` appends a comment with correct `writerId` and `subjectId`
- `revealBasketComments` sets `status: 'basket_guessing'`
- `submitBasketCommentGuess` awards 1 point for correct comment guess
- `submitBasketCommentGuess` awards 0 points for wrong comment guess
- `submitBasketAuthorGuess` awards 1 additional point for correct author guess
- `submitBasketAuthorGuess` awards 0 additional points for wrong author guess
- `startNextBasketRound` increments `currentRoundIndex`, clears comments/guesses, sets `status: 'basket_writing'`
- `startNextBasketRound` on last round sets `status: 'finished'`

### `__tests__/BasketWritingPhase.test.tsx` — component, TDD
- Shows round number label
- Shows assigned subject's display name
- Submit button calls `submitBasketComment`
- After submit: shows waiting state, hides input
- Admin sees reveal button; non-admin does not
- Admin reveal button calls `revealBasketComments`

### `__tests__/BasketGuessingPhase.test.tsx` — component, TDD
- Renders N anonymous comment cards
- Tapping a card calls `submitBasketCommentGuess` with that comment's writerId
- After correct guess: shows success message and author-selection list
- After wrong guess: shows error message, no author-selection list
- Tapping an author calls `submitBasketAuthorGuess` with the authorId
- After submitting fully: shows waiting state
- Admin sees next-round button; non-admin does not
- Admin next-round button calls `startNextBasketRound`
