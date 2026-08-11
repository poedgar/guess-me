# Admin Round Restart / Skip Controls

**Date:** 2026-08-11
**Scope:** `apps/web` and `apps/expo`, all four game modes (Mirror, Basket, Clash, Group Ideas).

## Problem

The admin has no manual override for a round that's stuck or needs a do-over. This surfaced directly from a production incident: a Basket round could get permanently stuck waiting on a player's guess that had, in fact, already been submitted (see the concurrent-write bug fixed earlier the same day). Even outside of bugs, an admin running the game in person needs the ability to redo a round (someone's phone died mid-write, a comment was inappropriate) or to just move on when a player has genuinely stepped away and isn't coming back.

## Behavior

Two distinct admin-only actions, available at any point during the current round (writing/submitting step or guessing/rating step), in every game mode:

- **Restart Round** — redo the *current* round from scratch. Same pairings/target as before. All of this round's submissions (comments, guesses, ratings) are wiped. Any points already awarded *during this round* are rolled back. The round returns to its writing/submitting step.
- **Skip Round** — abandon whatever's unfinished in the current round and immediately advance to a new one (new target for Mirror, the next scheduled pairing set for Basket/Clash/Ideas). Points already awarded during the abandoned round are **left as-is** — skip doesn't undo anything, it just stops waiting.

Both require confirmation via a dialog (same pattern as the existing "Force Finalize" / "Leave game" confirms) before taking effect.

## UI

Every phase component with a round in progress gets a collapsible "⚙ Admin tools ▾" section, tucked below the existing primary round-control button (e.g. "Next Round"), visible to the admin only. Collapsed by default so the screen looks unchanged for the common case. Expanding it reveals two outline-style buttons: "↻ Restart Round" and "⏭ Skip Round".

Confirm dialog copy:

- Restart: *"Restart this round? Everyone's comments and guesses for this round will be cleared, and any points already given this round will be undone. This can't be undone."*
- Skip: *"Skip to the next round? Not everyone has finished this round. Anything already submitted keeps its points — this just stops waiting and moves on."*

**Files changed (both web and expo):** the writing-phase and guessing/rating-phase components for each mode — `mirror/ActivePhase.tsx`, `mirror/GuessingPhase.tsx`, `basket/BasketWritingPhase.tsx`, `basket/BasketGuessingPhase.tsx`, `clash/ClashWritingPhase.tsx`, `clash/ClashGuessingPhase.tsx`, and the equivalent Group Ideas writing/rating phase components.

## Architecture — new context functions

All new/changed functions live in `GameContext.tsx` in both apps (identical logic, matching the parity pattern used throughout this codebase). All read-modify-write operations use `runTransaction` — restart in particular touches round state and `scores` together and must not race an in-flight player submission, the same concurrency-safety requirement established in the earlier basket/clash fixes.

### Mirror

Mirror's round data does **not** live in one place the way the other three modes' does — this matters for restart. `currentRound` is only populated during the writing/point-giving step (`status: 'active'`). The moment `startGuessingPhase()` runs, it sets `currentRound: null` and moves that round's data into `rounds[]` (as an entry with `guesses: []`) plus `guessingData.singleRoundTargetId` (naming which round is being guessed) — `currentRound` stays `null` through the rest of guessing, through `awardPointsToPlayers`'s post-guessing bonus-point step (which is part of the guessing-phase screen, before finalize), and through `finalizeGuessingPhase` itself, only becoming populated again once `startNextRound()` builds the next one.

- **`restartMirrorRound()`** (new): inside a transaction, reads the fresh game doc and locates "the round being restarted" one of two ways: if `currentRound` is set, use it directly; otherwise (mid-guessing, `status === 'guessing_phase'`) look it up via `rounds.find(r => r.targetUserId === guessingData.singleRoundTargetId)`. Throws `"No active round to restart"` if neither is found. Builds a fresh `Round` with the same `targetUserId`/`targetUserName`/`roundNumber` but empty `comments`, `commentsVisible: false`, `pointsGiven: false`, `guesses: []`, `targetCorrectGuesses: 0`, `guessesFinalized: false`, `targetPoints: 0`, `targetPointsGivenBy: []`, `targetPointsByPlayer: {}`, and writes it back as `currentRound` — this is a **full reset to the writing step regardless of which step restart was triggered from** (per explicit confirmation: even a guessing-step restart wipes comments too, not just guesses). If the round had already been pushed into `rounds[]` (the guessing-phase case), that entry is removed from `rounds[]` in the same write, since the round is no longer "completed." Restores `scores` and `guessResults` from the existing `roundStartScores`/`roundStartGuessResults` snapshot (already captured at the start of every round for the leaderboard-freeze feature) — this single restore undoes *every* point mechanism from the round being restarted (comment points, target points, and bulk post-guessing admin awards) without needing to reverse-engineer each one individually. Sets `status: 'active'`, `postGuessingPointPhase: false`, `playersWhoAwardedPostGuessPoints: []`, `guessingData: null`, `playersWhoCompletedPostCommentPhase: []`. Also filters every entry in `adminAwards[*]` to drop any whose `roundNumber` matches the round being restarted (see below).
- **`awardPointsToPlayers`** (changed): since this always runs while `currentRound` is `null` (it's a guessing-phase-screen action, per above), each stored award entry is tagged using `guessingData.singleRoundTargetId` → `rounds.find(r => r.targetUserId === singleTargetId)?.roundNumber` instead of `currentRound.roundNumber` (which would be `undefined` here). `roundNumber` is `undefined` for legacy (non-per-round) games, which is fine — restart never applies to a finished game. This tag lets `restartMirrorRound` identify and strip entries belonging to the restarted round from the `adminAwards` history log. Scores are already correctly undone via the snapshot restore regardless — this only keeps the audit-trail log itself accurate.
- **`skipMirrorRound()`** (new, thin wrapper): calls the existing `startNextRound()` logic directly. No behavior change to `startNextRound()` itself — it already handles a `null` `currentRound` gracefully (comment already in the code: "may be null after per-round guessing") and has no hard requirement that the round be finalized first (only an admin check); it just wasn't previously exposed as a direct admin action outside the finalize flow.

### Basket

- **`restartBasketRound()`** (new): inside a transaction, clears `basketData.currentRoundComments` and `basketData.currentRoundGuesses` to `[]`, keeps `schedule` and `currentRoundIndex` untouched, sets `status: 'basket_writing'`. Rolls back `scores` by summing `pointsAwarded` from the pre-reset `currentRoundGuesses`, grouped by `guesserId`, and subtracting each sum from `scores[guesserId]`.
- **`skipBasketRound()`** (new, thin wrapper): calls the existing `startNextBasketRound()`, which already has no server-side completion gate (only the UI's `allGuessersDone` check currently blocks it).

### Clash

- **`restartClashRound()`** (new): inside a transaction, clears `currentRoundCommentsA/B` and `currentRoundGuessesA/B` to `[]`, resets `lastGroupToFinish: null` and `currentGuessingGroup: null`, sets `status: 'clash_writing'`. Every guess in `currentRoundGuessesA` was submitted by `groupA.leaderId` (only the active leader can submit — see `submitClashGuess`/`submitClashAuthorGuess`), so rollback subtracts `sum(pointsAwarded in currentRoundGuessesA)` from `scores[groupA.leaderId]`, and symmetrically for group B. Rolls back `clashData.teamScores.a`/`.b` by the same two sums respectively.
- **`advanceClashGuessing`** (changed): gains a `force: boolean = false` parameter. When `true`, skips the "has the other group finished?" check and goes straight to the existing next-round-or-finish branch.
- **`skipClashRound()`** (new, thin wrapper): calls `advanceClashGuessing({ force: true })`.

### Group Ideas

- **`restartIdeaRound()`** (new): inside a transaction, clears `ideaData.currentRoundRatings` to `[]`, keeps `schedule`/`currentRoundIndex` untouched. Rolls back `scores` by summing `points` from the pre-reset `currentRoundRatings`, grouped by the rated idea's `authorId` (looked up via `ideaData.ideas`), and subtracting each sum.
- **`skipIdeaRound()`** (new, thin wrapper): calls the existing `startNextIdeaRound()`, which already has no server-side completion gate.

## Edge Cases

- **Authorization:** every new/changed function throws unless the caller is `currentGame.adminId`, matching every other admin-only action in the codebase.
- **Nothing submitted yet:** restarting a round with no comments/guesses/ratings submitted is a safe no-op (clearing already-empty arrays, rolling back zero points).
- **Concurrent admin taps:** if restart/skip is triggered twice near-simultaneously (e.g. two admin devices), the transaction's fresh-read-then-write naturally serializes them; the second call re-reads the already-reset state and reapplies harmlessly.
- **Restart never touches future rounds:** only the current round's data is affected — `schedule`/`currentRoundIndex` (Basket/Clash/Ideas) and the target-rotation bookkeeping (Mirror's `usedTargets`/`adminSkippedTargets`, untouched by restart) are unaffected, so pairings for rounds after this one are unaffected.
- **`adminAwards` history log (Mirror):** entries are tagged with the round number they were given in and filtered out on restart, so the audit trail stays accurate. This is the one place restart does more than a blind snapshot-restore.
- **Restart during Mirror's guessing step:** since the round being guessed already lives in `rounds[]` (not `currentRound`) by that point, restart removes that entry from `rounds[]` in the same write that rebuilds `currentRound` — otherwise the restarted round would incorrectly still appear in round history.

## Testing

Same pattern as the concurrency fixes earlier this session: `runTransaction`-mock-based unit tests per function, added to the existing `GameContext.*.test.ts(x)` files (or new sibling files following the same naming) in `apps/expo/__tests__/`.

Per restart function: verify submissions clear, verify points roll back correctly (for Mirror, verify both the `roundStartScores`/`roundStartGuessResults` restore and the `adminAwards` round-filtering), verify pairings/target/schedule position are untouched, verify non-admin callers are rejected.

Per skip function: verify the existing next-round logic is reused unchanged (Mirror/Basket/Ideas), verify Clash's new `force` path bypasses the group-turn check and goes straight to the next round regardless of `otherGroupDone`.

`apps/web` has no test runner (established in prior work) — verified via `tsc --noEmit` plus manual review of parity against the expo implementation and this spec.

## Out of Scope

- No change to how points are earned during normal play — only to what happens when an admin explicitly restarts or skips.
- No change to the target-rotation/pairing-generation algorithms themselves (`generateBasketSchedule`, `generateClashSchedule`, `generateIdeaSchedule`, Mirror's random/chronological target selection) — restart and skip both operate within the existing schedule, never regenerate it.
- No new Firestore security rule changes — these are `updateDoc`/`transaction.update` calls from the admin, already covered by the existing `isAdmin(resource.data)` rule.
