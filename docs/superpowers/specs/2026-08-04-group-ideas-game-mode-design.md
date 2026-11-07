# Group Ideas Game Mode

**Date:** 2026-08-04
**Scope:** `apps/web` and `packages/shared` only. `apps/expo` is explicitly out of scope for this phase — this is Phase 1 of a two-phase delivery (web first, then a separate Expo port), the same phasing used for this session's Cypress test-suite expansion. No Cypress tests are part of this plan; testing this new mode is a separate follow-up.

## Problem

The app currently has three game modes (mirror, basket, clash), all built around anonymous comment-writing about a specific target/subject. There's no mode for collecting and rating open-ended ideas from the group — a "brainstorm and rate" format, where every participant contributes one or more ideas and the group gives feedback (either anonymously, with written comments, or openly, with attributed numeric ratings only).

## Behavior

### Game Flow

```
waiting
  → idea_writing   (ONE phase, not per-round: every eligible participant submits ≥1 idea)
    → idea_rating  (round 1: a random participant's full idea set is revealed, author hidden)
      → idea_rating (round 2: next participant, ...)
        ...
      → finished    (after the last round)
```

Unlike basket/clash, idea-writing happens exactly **once**, upfront, before any rating rounds start — not once per round. Every subsequent round only reveals-and-rates; nobody writes new ideas mid-game.

### Settings (configured in `WaitingPhase`, before `idea_writing` starts)

- **`adminWritesComments`** (reused, existing field) — when on, the admin is also an eligible idea-writer and can end up as a round's revealed participant. Off by default, matching every other mode.
- **`ideaIncognitoMode`** (new field, default `true`) — the mode's core toggle:
  - **Incognito (default):** each rater gives a 0–5 point rating *and* an optional written comment. Both stay permanently anonymous — there is no reveal/guess mechanic (unlike mirror mode's guess-the-author flow). Comments are shown to the idea's author and the group as an unattributed list.
  - **Open:** each rater gives only a 0–5 point rating, visibly attributed to them. No written-comment UI exists in this mode — actual discussion happens verbally among the group, outside the app.

### Round mechanics

Each round reveals **all** of one randomly-selected participant's submitted ideas together (someone with 3 ideas gets covered in one round, not three). **The idea's own author also rates their own idea that round** — critically, they are *not* excluded, because an exclusion would itself leak who the author is (everyone would notice one participant conspicuously not rating). The UI treats every participant identically each round; only the underlying data distinguishes the author.

A round's ideas are gated for advancement the same way basket/mirror gate every other phase: the admin must click an explicit "next round" / "finish game" action once everyone has rated every idea in the current round — no phase auto-advances.

### Scoring

Each submitted rating immediately adds its points to `scores[authorId]` in the same `updateDoc` call that records the rating — the same incremental-award pattern basket/clash already use for correct guesses (`scores.${uid} += 1`), just with a 0–5 point value instead of a flat +1. If an author's round revealed multiple ideas, all ratings across all their ideas from all raters accumulate into the same score. This means the existing `Leaderboard` component and `ResultsPhase` need **no changes** — `scores` is already the field they read.

### Data Model

New shared types (`packages/shared/src/types.ts`, alongside `BasketData`/`ClashData`):

```typescript
export interface Idea {
  id: string;
  authorId: string;
  text: string;
  submittedAt: number;
}

export interface IdeaRating {
  raterId: string;
  ideaId: string;
  points: number;      // 0-5
  comment?: string;    // only ever set in incognito mode
}

export interface IdeaGameData {
  incognitoMode: boolean;          // frozen at game start from the ideaIncognitoMode setting
  ideas: Idea[];                   // every idea ever submitted, flat, across the whole game
  schedule: string[];              // shuffled eligible participant userIds — one round per entry
  currentRoundIndex: number;
  currentRoundRatings: IdeaRating[]; // reset to [] at the start of each round
}
```

- `Game.gameType` gains a 4th value: `'mirror' | 'basket' | 'clash' | 'ideas'`.
- `Game.status` gains two new values: `'idea_writing' | 'idea_rating'`.
- `Game.ideaData?: IdeaGameData` — added alongside `basketData?`/`clashData?`.
- `Game.ideaIncognitoMode?: boolean` — a new top-level settings field (mirrors `adminWritesComments`/`showSurnames`/etc.), read once at `idea_writing → idea_rating` transition to freeze `ideaData.incognitoMode`.

A new shared utility, `packages/shared/src/utils/ideaSchedule.ts`, exporting `generateIdeaSchedule(participantIds: string[]): string[]` — a Fisher-Yates shuffle of eligible participant IDs (mirroring `basketSchedule.ts`'s shuffle technique), one entry per round. Kept as its own small util for the same testability/consistency reasons `basketSchedule.ts`/`clashSchedule.ts` are separate files, even though the shape here is simpler (no writer→subject pairing, just an ordering).

### GameContext functions (apps/web, `apps/web/src/contexts/GameContext.tsx`)

Five new functions, directly modeled on basket's five equivalent functions:

- **`startIdeaGame()`** (admin-only, `waiting → idea_writing`): computes eligible writers the same way `startBasketGame()` does (`adminWritesComments`-gated), requires at least 2 eligible writers (matching basket's minimum), initializes `ideaData: { incognitoMode: <frozen from ideaIncognitoMode>, ideas: [], schedule: [], currentRoundIndex: 0, currentRoundRatings: [] }`.
- **`submitIdea(text: string)`**: appends a new `Idea` to `ideaData.ideas` via `arrayUnion`. No per-round association — ideas are just tagged with `authorId`. Callable multiple times per user (each call adds one more idea) — no upper bound.
- **`startIdeaRatingRounds()`** (admin-only, `idea_writing → idea_rating`): requires every eligible writer to have submitted ≥1 idea; builds `schedule` via `generateIdeaSchedule()` over the set of participants who actually submitted ≥1 idea; sets `currentRoundIndex: 0`.
- **`submitIdeaRating(ideaId: string, points: number, comment?: string)`**: appends an `IdeaRating` to `currentRoundRatings` via `arrayUnion`, and in the same `updateDoc` call increments `scores.${authorIdOfThatIdea}` by `points`. `comment` is only accepted/stored when `ideaData.incognitoMode` is true.
- **`startNextIdeaRound()`** (admin-only): if `currentRoundIndex + 1 >= schedule.length`, sets `status: 'finished'` directly (no separate "end game" step, matching basket's last-round handling); otherwise increments `currentRoundIndex` and resets `currentRoundRatings: []`.

### UI Components (apps/web, `apps/web/src/components/game/ideas/`)

Directly modeled on the equivalent basket components:

- **`IdeaWritingPhase.tsx`** — a form to add one idea at a time (textarea + submit, clears after each submission so the user can add another), a running list of the user's own already-submitted ideas, and (admin-only) a per-participant submitted-count list plus a "Start Rating Rounds" button, disabled until every eligible participant has ≥1 idea.
- **`IdeaRatingPhase.tsx`** — shows the current round's revealed ideas (author never named), each with a 0–5 point selector; in incognito mode, also an optional comment textarea per idea. Once a user has rated every idea in the round, shows a waiting state. Admin sees per-idea/per-rater completion progress and a "Next Round"/"Finish Game" button (label and color driven by `isLastRound`, matching `BasketGuessingPhase.tsx`'s existing pattern), disabled until every eligible rater has rated every idea this round.
- **`IdeaScreen.tsx`** — routes `idea_writing`/`idea_rating` to the two components above, exactly mirroring `BasketScreen.tsx`'s two-line structure.

### Integration points (existing files, small additions)

- **`WaitingPhase.tsx`**: add a 4th `game-type-button` (`'ideas'`) to the existing mirror/basket/clash selector array; add the `ideaIncognitoMode` toggle to the settings block, shown only when `gameType === 'ideas'` (mirroring how mirror-only settings are already conditionally rendered); wire `handleStartGame` to call `startIdeaGame()` when `gameType === 'ideas'`.
- **`GameScreen.tsx`**: add a `gameType === 'ideas'` branch — `waiting` → `WaitingPhase`, `idea_writing`/`idea_rating` → `IdeaScreen`, `finished` → `ResultsPhase` — exactly matching the existing basket/clash branches' shape.
- **`locales/en.json` / `locales/uk.json`**: new `game.ui.ideas.*` keys (gameTypeIdeas, round, yourIdeas, writeIdea, addAnotherIdea, waitingForOthers, ratePoints, commentPlaceholder, submitRating, nextRound, finishGame, incognitoModeTitle, incognitoModeDescription, etc.) — the exact key list and English/Ukrainian copy is finalized during plan-writing, once every UI string that needs one is enumerated against the built components.

## Out of Scope

- `apps/expo` — Phase 2, a separate future plan.
- Cypress E2E test coverage for this mode — separate follow-up, after the feature itself ships and stabilizes (matching how basket/clash shipped as features well before this session's Cypress work covered them).
- A maximum cap on ideas per participant — unbounded by design (per the approved requirements).
- Any "guess who wrote this" mechanic for incognito comments — comments and ratings stay permanently anonymous, there is no reveal step.
- Any in-app discussion/comment thread for open mode — open mode only collects attributed numeric ratings; discussion happens outside the app.
- Continuous/mid-game idea submission — all ideas are submitted in the single upfront `idea_writing` phase; nothing can be added once rating rounds begin.
