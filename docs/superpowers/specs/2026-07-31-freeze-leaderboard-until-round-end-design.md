# Freeze Leaderboard Until Round End

**Date:** 2026-07-31
**Scope:** `apps/web` and `apps/expo`, mirror mode only. Basket and clash modes never read `scores`/`guessResults` at all (their scoring lives entirely in `basketData`/`clashData`), so `startBasketGame`/`startClashGame` and the basket/clash phase components are untouched.

## Problem

The leaderboard (total scores per player) currently reflects `game.scores`/`game.guessResults` live, in real time, as points are awarded during a round — comment points and target points as the target reviews comments in the Active phase, guess points once guessing is finalized, and post-guessing bonus points as players award them. Anyone looking at a leaderboard mid-round sees the round's scoring shift while it's still happening, which spoils the reveal. Round results should instead only become visible once the round has fully concluded.

## Behavior

Every leaderboard display shows standings **as of the end of the last completed round** throughout the current round, and updates the instant the current round finishes (i.e. the moment the next round begins, or the moment the game finishes). Prior standings stay visible for reference the whole time — nothing goes blank — only the currently-unfolding round's changes are held back until it resolves.

## Architecture

Two new optional fields on the `Game` document (added to the TypeScript interface in both `apps/web/src/contexts/GameContext.tsx` and `apps/expo/contexts/GameContext.tsx`):

```typescript
roundStartScores?: { [userId: string]: number };
roundStartGuessResults?: { [userId: string]: { correctGuesses: number } };
```

Captured at the two places a round begins:

- **`startGame()`** — set both to `{}` in the same `updateDoc` call that already sets `scores: {}` for round 1 (nobody has scored anything yet).
- **`startNextRound()`** — set both to whatever `scores`/`guessResults` already are on the freshly-read game document (`gameData.scores`, `gameData.guessResults`), in the same `updateDoc` call that establishes `currentRound: nextRound`. This captures "standings as they stood the instant the new round began," which is exactly the just-finished round's final results.

Both apps get the identical change — same parity pattern as every prior feature this session.

## Component Wiring

Every place that renders the shared `Leaderboard` component while a round can be in progress switches its `scores`/`guessResults` props from the live fields to the frozen ones, with a fallback to the live fields for backward compatibility:

```typescript
scores={game.roundStartScores ?? game.scores}
guessResults={game.roundStartGuessResults ?? game.guessResults}
```

**Files changed (both web and expo):**
- `ActivePhase.tsx` — inline mid-round leaderboard.
- `GuessingPhase.tsx` — inline mid-round leaderboard.
- Standalone Results tab (`apps/web/src/pages/ResultsPage.tsx`, `apps/expo/app/(tabs)/results.tsx`) — same substitution, but conditional on game status: while `currentGame.status !== 'finished'`, show the frozen snapshot; once `status === 'finished'`, show live `scores`/`guessResults` directly.

**Files NOT changed:**
- `WaitingPhase.tsx` — only rendered pre-game (`status === 'waiting'`), where `scores` is always `{}` regardless, so live and frozen are identical.
- `ResultsPhase.tsx` — only rendered once the game is finished; already shows live final totals, which is correct (the game is over, nothing is left to hide).

## Edge Cases & Backward Compatibility

- **Older games** created before this ships simply lack `roundStartScores`/`roundStartGuessResults` in Firestore. The `?? game.scores` / `?? game.guessResults` fallback shows live totals for such a game until its *next* round transition writes a snapshot for the first time. No migration needed, no crash.
- **First round:** `roundStartScores`/`roundStartGuessResults` are explicitly `{}`, matching reality (no round has been scored yet).
- **Brief transitional gap:** in mirror mode's per-round guessing flow, `finalizeGuessingPhase()` sets `status: 'active', currentRound: null` immediately after a round resolves (comment/target/guess points are already written to the live `scores`/`guessResults` fields at this point), and the *next* round's snapshot isn't taken until `startNextRound()` runs moments later (admin- or auto-triggered). `ActivePhase.tsx` already renders nothing when `currentRound` is null, so the inline leaderboard is unaffected during this window. A player who happens to open the standalone Results tab in that sub-second gap would still see the previous round's frozen snapshot even though the round has technically already resolved server-side. This is treated as a disclosed, accepted edge case — a momentary display lag, not a bug — rather than adding snapshot-writing logic to `finalizeGuessingPhase` to close a sub-second window with no real consequence.
- **Finished games:** the standalone Results tab's `status === 'finished'` branch shows live totals, since the last-ever `roundStartScores` snapshot (taken at the start of the *final* round) would otherwise permanently hide that round's outcome — there is no "next round" call after the last one to refresh it.

## Testing

- **apps/web:** no test runner in this package (established in prior work) — verified via `tsc --noEmit` plus manual review of the wiring against this spec.
- **apps/expo:** real Jest suite. `GameContext.startGame.test.tsx` gets assertions that `startGame()` and `startNextRound()` write the two snapshot fields correctly (round 1 → `{}`; later rounds → a copy of the pre-transition `scores`/`guessResults`). `ActivePhase.test.tsx`, `GuessingPhase.test.tsx`, and any `results.tsx`-equivalent test get assertions that the rendered leaderboard reflects the frozen snapshot, not live `scores`, when both differ.

## Out of Scope

- No change to *how* or *when* points are actually earned — only to when they become visible on a leaderboard.
- No change to the "Round History" section on the Results tab, which already correctly gates on `commentsVisible && pointsGiven` per round and needs no further changes.
- No change to basket or clash game modes.
