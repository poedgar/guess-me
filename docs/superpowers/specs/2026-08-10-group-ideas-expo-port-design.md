# Group Ideas Game Mode — apps/expo Port (Phase 2)

**Date:** 2026-08-10
**Scope:** `apps/expo` only. This is Phase 2 of Group Ideas, following Phase 1 (`apps/web` + `packages/shared`), documented in `docs/superpowers/specs/2026-08-04-group-ideas-game-mode-design.md` and shipped to production.

## Problem

Group Ideas (submit-ideas-then-rate-them-anonymously game mode) exists only in `apps/web`. `apps/expo`'s `WaitingPhase.tsx` still only offers mirror/basket/clash; its `GameContext.tsx` has no idea of `ideaData`, `ideaIncognitoMode`, or any of the six Idea-related functions. This phase ports the feature so mobile users get the same mode.

The game mechanics, data model, and scoring logic are **not being redesigned** — Phase 1's design (approved, shipped, battle-tested against production Firestore including a full security-rules rollout) is the source of truth for *what* the feature does. This spec covers only *how* it maps onto `apps/expo`'s conventions, which differ from `apps/web`'s in ways that matter for the port.

## Behavior

### Architectural constraint: `apps/expo` duplicates, it doesn't share

Confirmed by direct inspection: `apps/expo/contexts/GameContext.tsx` defines its own local `Game`, `GameContextType`, `Participant`, `Round`, `Comment`, `BasketData`, `ClashData`, etc. — entirely separate from `packages/shared/src/types.ts`, despite `@mirror/shared` being a declared dependency. It also has local copies of `basketSchedule.ts` and `clashSchedule.ts` under `apps/expo/utils/`, rather than importing the shared versions `packages/shared` already exports. This is the established pattern for every existing mode, and this port follows it rather than introducing a one-off exception: a local `apps/expo/utils/ideaSchedule.ts`, and local `Idea`/`IdeaRating`/`IdeaGameData` interfaces added to `GameContext.tsx`'s existing local type block, mirroring `packages/shared/src/types.ts`'s versions field-for-field.

### Data model (local to `apps/expo/contexts/GameContext.tsx`)

Added to the existing local type declarations, matching `packages/shared/src/types.ts` exactly in shape:

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
  points: number; // 0-5
  comment?: string; // only ever set in incognito mode
}

export interface IdeaGameData {
  incognitoMode: boolean;
  ideas: Idea[];
  schedule: string[];
  currentRoundIndex: number;
  currentRoundRatings: IdeaRating[];
}
```

`Game` gains: `status` widened to include `"idea_writing" | "idea_rating"`; `gameType` widened to include `'ideas'`; `ideaData?: IdeaGameData`; `ideaIncognitoMode?: boolean` (matching web's corrected comment: "Whether ratings/comments in Group Ideas mode stay anonymous (default: true)" — not the stale comment web's own copy briefly had before its own fix-round corrected it, so this port starts from the *corrected* text, no need to repeat that bug). `GameContextType` gains the six new function signatures and `setGameType`'s parameter type widens to include `'ideas'`.

### `apps/expo/utils/ideaSchedule.ts` (new file)

```typescript
export function generateIdeaSchedule(participantIds: string[]): string[] {
  const shuffled = [...participantIds];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
```

(Fisher-Yates, identical to `packages/shared/src/utils/ideaSchedule.ts` and `apps/expo/utils/basketSchedule.ts`'s own shuffle technique — no per-round pairing needed, just an ordering.)

### GameContext functions (`apps/expo/contexts/GameContext.tsx`)

Six functions, ported from `apps/web/src/contexts/GameContext.tsx`'s **current, post-security-review** implementations (not the original Phase 1 versions — the final whole-branch review found and fixed real bugs in these; the port must start from the corrected code, not rediscover the same bugs):

- **`startIdeaGame()`** — admin-only, `waiting → idea_writing`, `adminWritesComments`-gated eligible-writer computation, requires ≥2 eligible writers, initializes `ideaData` with `incognitoMode` frozen from `ideaIncognitoMode ?? true`.
- **`submitIdea(text: string)`** — appends via `arrayUnion`, no per-round association, callable multiple times per user.
- **`startIdeaRatingRounds()`** — admin-only, `idea_writing → idea_rating`. Uses the **corrected** eligibility check from web's final fix wave (every eligible writer must have submitted an idea, not just "≥2 authors total") — this was a real gap in the original Phase 1 code that web's own review caught and fixed; the port starts from the fixed version.
- **`submitIdeaRating(ideaId: string, points: number, comment?: string)`** — implemented as a `runTransaction`, **not** a plain `updateDoc` read-modify-write. This is the single most important thing to port correctly: the original Phase 1 web code had a non-atomic score-increment race (concurrent raters could clobber each other's score updates) that web's final review caught and fixed by moving to a transaction with a fresh in-transaction read, an eligibility check, and an `alreadyRated` guard all evaluated against the transaction's fresh snapshot — not the client's stale local state. Port *that* version.
- **`startNextIdeaRound()`** — admin-only, advances `currentRoundIndex` or sets `status: 'finished'` on the last round.
- **`updateIdeaIncognitoMode(ideaIncognitoMode: boolean)`** — admin-only, `status === "waiting"`-gated setting update.

### UI components (`apps/expo/components/game/ideas/`, new directory)

Following the basket mode's established file shape exactly:

- **`IdeaScreen.tsx`** — 2-line router: `idea_writing` → `IdeaWritingPhase`, `idea_rating` → `IdeaRatingPhase`, matching `apps/expo/components/game/basket/BasketScreen.tsx`'s structure.
- **`IdeaWritingPhase.tsx`** — form to add ideas (RN `TextInput` + submit button, clears after each submission), list of the user's own submitted ideas, admin-only submitted-count + "Start Rating Rounds" button (disabled until every eligible writer has ≥1 idea — the corrected gate, matching the context function above). RN styling via local `StyleSheet.create`, colors from `@/constants/theme`, following `BasketWritingPhase.tsx`'s conventions.
- **`IdeaRatingPhase.tsx`** — current round's revealed ideas (author never named — every viewer, including the author, sees the same UI, the mechanism that keeps incognito mode anonymous), 0–5 point selector per idea (RN `TouchableOpacity` row, matching web's point-button pattern), optional comment `TextInput` gated on `incognitoMode`, admin's "Next Round"/"Finish Game" button gated on every eligible rater having rated every idea this round. Includes the unattributed-comments display (the fix web's final review added after finding comments were collected but never shown) and the eligibility guard hiding rating controls from non-eligible viewers (the other fix from that same review) — both ported as part of the baseline, not added later.

### Integration points

- **`WaitingPhase.tsx`**: 4th game-type button (`'ideas'`, alongside mirror/basket/clash) in the existing selector array; new settings block shown only when `gameType === 'ideas'` (`adminWritesComments` toggle reused + new `ideaIncognitoMode` `Switch`), mirroring how mirror-only settings are already conditionally rendered; `handleStartGame` gains an `else if (game.gameType === 'ideas') { await startIdeaGame(); }` branch.
- **`GameScreen.tsx`**: new conditional branch — `(currentGame.status === 'idea_writing' || currentGame.status === 'idea_rating') && <IdeaScreen .../>` — matching basket/clash's existing branch shape exactly (same shared-props spread).

### Testing (`apps/expo/__tests__/`, matching basket/clash's existing coverage shape)

- **`GameContext.ideas.test.ts`** — `renderHook`/`act` against the real `GameProvider` with mocked Firestore, covering all six functions: happy paths, the admin-only guards, the `runTransaction`-based race-safety of `submitIdeaRating` (at minimum: eligibility rejection, duplicate-rating rejection), matching `GameContext.basket.test.ts`'s existing shape and rigor.
- **`IdeaWritingPhase.test.tsx`**, **`IdeaRatingPhase.test.tsx`** — RTL component tests, matching `BasketWritingPhase.test.tsx`/`BasketGuessingPhase.test.tsx`'s conventions (query by text/role, not `testID` — confirmed `apps/expo` has no systematic `testID` convention for game components).
- **`ideaSchedule.test.ts`** — unit test for the new local schedule util, matching `basketSchedule.test.ts`.

### Housekeeping (separate first commit, unrelated to the port itself)

Delete `apps/expo/contexts/GameContext.tsx.bak` and `apps/expo/components/game/ActivePhase.tsx.bak` — stale, git-tracked backup files noticed during research for this spec, dated well before this work.

## Out of Scope

- Any redesign of the game mechanics, data model, or scoring — Phase 1's design is authoritative; this is a port, not a reconsideration.
- Adopting `@mirror/shared`'s types/utilities for Group Ideas specifically (or any other mode) — the codebase's established duplication pattern is followed as-is; a shared-architecture refactor is a separate, much larger, cross-cutting decision not undertaken here.
- Any change to `apps/web`'s Group Ideas implementation.
- E2E/integration testing beyond Jest — `apps/expo` has no Cypress-equivalent E2E suite; Jest (context + component tests) is the established ceiling for this platform's automated coverage.
