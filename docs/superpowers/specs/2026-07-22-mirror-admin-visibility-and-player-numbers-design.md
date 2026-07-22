# Mirror Mode: Admin Comment-Completion Visibility + Stable Player Numbers

**Date:** 2026-07-22
**Scope:** `apps/web` (Vite/React port), mirror game mode only. Does not touch the Expo app, or basket/clash modes.

## Problem

In the mirror game's writing phase (`ActivePhase.tsx`), the admin has no visibility into which
participants have submitted their comment about the current round's target and which haven't.
The only signal is a "Show Comments" button that's enabled once at least one comment exists —
the admin has to guess when everyone is actually done.

Separately, participant numbering across the mirror game's screens is inconsistent. The waiting
room list numbers participants by their position in `game.participants` (join order), but that
same numbering doesn't appear anywhere once the game is active — notably the author-picker pills
in the guessing phase show names only. Because `game.participants` order can shift if someone
leaves, a numbering scheme derived from array position on every render isn't stable across a game
either.

## Part 1: Admin comment-completion checklist

**File:** `apps/web/src/components/game/mirror/ActivePhase.tsx`

Within the existing admin-controls block, while `!commentsVisible` (the writing phase), render a
checklist of every participant expected to write a comment this round, each row marked submitted
or pending, plus an "X/Y submitted" summary.

- **Expected commenters:** reuse the same exclusion rule already computed in this file as
  `nonTargetPlayers` (excludes the round's target; excludes the admin when
  `adminWritesComments` is falsy).
- **Submitted state:** a participant has submitted iff their `userId` appears as an `authorId` in
  `currentRound.comments`. No new Firestore reads or writes — this is a pure derived-state UI
  addition over data the client already has via the existing real-time listener.
- **Placement:** above or alongside the existing "Show Comments" button, visible only to the
  admin, only while `!commentsVisible`. Once comments are shown, the checklist is moot and is not
  rendered (existing UI takes over).
- Each row is prefixed with the participant's stable number (Part 2).

## Part 2: Stable per-participant numbers assigned at game start

**Files:** `apps/web/src/contexts/GameContext.tsx` (interface + `startGame()`),
`apps/web/src/components/game/mirror/ActivePhase.tsx` (checklist rows),
`apps/web/src/components/game/mirror/GuessingPhase.tsx` (author-picker pills).

### Data model

Add to the `Game` interface in `GameContext.tsx`:

```ts
// Stable per-participant display numbers, assigned once when the game starts.
// Frozen for the lifetime of the game — does not shift if participants later leave.
playerNumbers?: { [userId: string]: number };
```

### Assignment

In `startGame()`, at the same point the first round is created, compute
`playerNumbers` from `currentGame.participants`' current order (1-indexed, matching the numbering
already shown in the waiting-room list) and include it in the same `updateDoc` call that sets
`status: "active"`. This is a one-time assignment — nothing else mutates `playerNumbers` for the
rest of the game.

### Consumption

- **Waiting room (`WaitingPhase.tsx`):** no change. It only renders pre-start and already shows
  `idx + 1` from the same join order that becomes the frozen numbering at start.
- **Admin checklist (Part 1):** prefix each row with `playerNumbers[userId]`.
- **Guessing-phase author pills (`GuessingPhase.tsx`):** prefix each pill's name with
  `playerNumbers[author.userId]`, e.g. "1. Anna".
- **Leaderboard:** unchanged, out of scope (confirmed with user — medals stay as-is).
- **Fallback:** if a `userId` has no entry in `playerNumbers` (game predates this change, or the
  participant joined after the game was already active), fall back to that participant's
  1-indexed position in `game.participants` so a number is always shown.

## Out of scope

- Basket and clash game modes.
- The Expo app (`app/`, `components/game/` at the repo root) — this is `apps/web` only.
- Any change to how comments themselves are displayed (they remain anonymous pre-reveal).
- Renumbering on participant departure — numbers are intentionally frozen at game start.

## Testing

- Unit/manual: start a mirror game with 3+ participants, confirm the admin sees a live
  submitted/pending checklist as comments come in, and that it disappears once "Show Comments" is
  clicked.
- Confirm the same participant numbers appear in the checklist and in the guessing-phase author
  pills for a given game (e.g. participant assigned "2" shows as "2. Name" in both places).
- Confirm a game already in progress before this change (no `playerNumbers` field) still renders
  numbers via the fallback, without crashing.
