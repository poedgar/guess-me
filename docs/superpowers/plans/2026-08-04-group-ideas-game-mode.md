# Group Ideas Game Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4th game mode, "Group Ideas": participants submit anonymous ideas upfront, then one round per participant reveals their full idea set (author hidden) for the group to rate 0–5, either incognito (rating + anonymous comment) or open (attributed rating only). Phase 1 of 2 — `apps/web` and `packages/shared` only.

**Architecture:** New shared types and a schedule-shuffling utility in `packages/shared` (mirroring `basketSchedule.ts`'s exact shape), six new `GameContext` functions in `apps/web` (mirroring basket's five equivalent functions), two new phase components plus a router (mirroring `BasketWritingPhase`/`BasketGuessingPhase`/`BasketScreen`), and small integration edits to `WaitingPhase.tsx`/`GameScreen.tsx` plus new locale keys.

**Tech Stack:** React 19, TypeScript strict mode, Firebase Firestore (`arrayUnion`, `updateDoc`), no new dependencies.

## Global Constraints

- `apps/expo` is explicitly out of scope for every task in this plan — do not create, modify, or delete any file under `apps/expo`.
- **A subtle cross-package type detail, read this before Task 1:** `packages/shared/src/types.ts` defines its own `Game`/`GameContextType` interfaces, and `apps/web/src/contexts/GameContext.tsx` defines a **separate, local** `Game`/`GameContextType` (not imported from shared) that its own Provider implementation actually uses. However, nearly every other `apps/web` component (`WaitingPhase.tsx`, `BasketWritingPhase.tsx`, `Leaderboard.tsx`, `ResultsPhase.tsx`, etc.) types its `game` prop by importing `Game` from `@mirror/shared` — so both copies must gain the new `ideaData`/`ideaIncognitoMode` fields and the widened `status`/`gameType` unions to stay structurally compatible, or every new/existing component that reads `game.ideaData` will fail to type-check. `GameContextType` is **not** imported by either app's `GameContext.tsx` (each defines its own local copy, confirmed by grep) — so do **not** add the new function signatures to shared's `GameContextType`; only `apps/web`'s local one needs them. This keeps `apps/expo`'s typecheck completely unaffected by this plan (only new *optional* fields and widened *string-literal unions* land in shared's `Game`, both are non-breaking to existing consumers).
- New Firestore fields (`ideaData`, `ideaIncognitoMode`) follow the same "must be added to the TypeScript interface, backward-compatible via optional `?`" rule as every other field in this codebase — older games without this data simply have `ideaData: undefined`.
- Comment/idea IDs use the same `` `${Date.now()}-${uid}` `` scheme `submitComment()` already uses for mirror-mode comments (`GameContext.tsx`'s existing `submitComment` function) — no new ID-generation dependency.
- Every new Firestore-writing function follows the established pattern: `if (!auth.currentUser) throw`, `setLoading(true)` in a `try`, `console.error` + rethrow in `catch`, `setLoading(false)` in `finally`.
- Every new user-facing string goes through `t()` and is added to **both** `packages/shared/src/locales/en.json` and `uk.json` — no hardcoded strings.
- Do not call Firestore directly from any component — every write goes through a `GameContext` method.
- The only acceptable `tsc --noEmit -p apps/web/tsconfig.json` errors are the 3 pre-existing baseline ones (`PostCommentPointsPanel.tsx:69`, one in `GameContext.tsx`, `packages/shared/src/i18n.ts:2`) — line numbers may shift as code is inserted earlier in files, but the same 3 underlying errors, nothing new.
- No Cypress tests are part of this plan (per the design spec) — verification is `tsc --noEmit` plus manual/dev-server walkthroughs described in each UI task.

---

## Task 1: Shared types and schedule utility (`packages/shared`)

**Files:**
- Create: `packages/shared/src/utils/ideaSchedule.ts`
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces (consumed by every later task): `generateIdeaSchedule(participantIds: string[]): string[]`; `Idea`, `IdeaRating`, `IdeaGameData` interfaces; `Game.ideaData?: IdeaGameData`; `Game.ideaIncognitoMode?: boolean`; `Game.gameType` widened to include `'ideas'`; `Game.status` widened to include `'idea_writing' | 'idea_rating'`.

- [ ] **Step 1: `packages/shared/src/utils/ideaSchedule.ts`**

```typescript
export function generateIdeaSchedule(participantIds: string[]): string[] {
  // Fisher-Yates shuffle for unpredictable round order — same technique
  // generateBasketSchedule() uses, just producing a flat ordering (one
  // round per participant) rather than per-round writer/subject pairs.
  const ids = [...participantIds];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids;
}
```

- [ ] **Step 2: `packages/shared/src/types.ts` — new interfaces**

Find:
```typescript
import { Timestamp } from 'firebase/firestore';
import { BasketAssignment, BasketRound } from './utils/basketSchedule';
import { ClashAssignment, ClashRound } from './utils/clashSchedule';
```

Replace with:
```typescript
import { Timestamp } from 'firebase/firestore';
import { BasketAssignment, BasketRound } from './utils/basketSchedule';
import { ClashAssignment, ClashRound } from './utils/clashSchedule';

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

- [ ] **Step 3: `packages/shared/src/types.ts` — extend `Game`**

Find:
```typescript
  status: "waiting" | "active" | "guessing_phase" | "finished" | "basket_writing" | "basket_guessing" | "clash_writing" | "clash_guessing";
```

Replace with:
```typescript
  status: "waiting" | "active" | "guessing_phase" | "finished" | "basket_writing" | "basket_guessing" | "clash_writing" | "clash_guessing" | "idea_writing" | "idea_rating";
```

Find:
```typescript
  gameType?: 'mirror' | 'basket' | 'clash';
  basketData?: BasketData;
  clashData?: ClashData;
```

Replace with:
```typescript
  gameType?: 'mirror' | 'basket' | 'clash' | 'ideas';
  basketData?: BasketData;
  clashData?: ClashData;
  ideaData?: IdeaGameData;
  // Whether the admin also submits an idea for the group to rate (default: false)
  ideaIncognitoMode?: boolean;
```

- [ ] **Step 4: `packages/shared/src/index.ts` — export the new utility**

Find:
```typescript
export { generateClashSchedule, type ClashAssignment, type ClashRound } from './utils/clashSchedule';
```

Replace with:
```typescript
export { generateClashSchedule, type ClashAssignment, type ClashRound } from './utils/clashSchedule';
export { generateIdeaSchedule } from './utils/ideaSchedule';
```

(`Idea`, `IdeaRating`, `IdeaGameData` need no separate export line — `packages/shared/src/index.ts:1`'s existing `export * from './types';` already re-exports every interface added to `types.ts` in Step 2.)

- [ ] **Step 5: Verify**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx tsc --noEmit -p apps/web/tsconfig.json
```

Expected: exactly the 3 pre-existing baseline errors, nothing new (this step doesn't yet wire the new types into any consuming code, so no new errors should appear from this task alone).

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/utils/ideaSchedule.ts packages/shared/src/types.ts packages/shared/src/index.ts
git commit -m "$(cat <<'EOF'
Add shared types and schedule utility for Group Ideas game mode

Idea/IdeaRating/IdeaGameData types, Game.ideaData/ideaIncognitoMode
fields, widened status/gameType unions, and generateIdeaSchedule() —
a flat Fisher-Yates shuffle (one round per participant, no per-round
pairing like basket/clash need). Purely additive: new optional fields
and widened string-literal unions, non-breaking for apps/expo (not
otherwise touched by this plan).
EOF
)"
```

---

## Task 2: `GameContext.tsx` — local types and six new functions (`apps/web`)

**Files:**
- Modify: `apps/web/src/contexts/GameContext.tsx`

**Interfaces:**
- Consumes: `generateIdeaSchedule` from `@mirror/shared` (Task 1).
- Produces (consumed by Tasks 4-7): `startIdeaGame()`, `submitIdea(text)`, `startIdeaRatingRounds()`, `submitIdeaRating(ideaId, points, comment?)`, `startNextIdeaRound()`, `updateIdeaIncognitoMode(ideaIncognitoMode)` — all added to the local `GameContextType` and the `value` object built with `useMemo`.

- [ ] **Step 1: Import `generateIdeaSchedule`**

Find:
```typescript
import { auth, db, generateGameId, sortParticipantsByJoin, buildJoinIndexById, generateBasketSchedule, generateClashSchedule } from '@mirror/shared';
```

Replace with:
```typescript
import { auth, db, generateGameId, sortParticipantsByJoin, buildJoinIndexById, generateBasketSchedule, generateClashSchedule, generateIdeaSchedule } from '@mirror/shared';
```

- [ ] **Step 2: Local `Idea`/`IdeaRating`/`IdeaGameData` types and `Game` interface extension**

Find (the end of the local `ClashData` interface, right before `export interface GameContextType {` — use this as your anchor, matching `apps/web/src/contexts/GameContext.tsx` around line 195):
```typescript
export interface ClashData {
  groupA: ClashGroup;
  groupB: ClashGroup;
  schedule: ClashRound[];
  currentRoundIndex: number;
  currentRoundCommentsA: ClashComment[];
  currentRoundCommentsB: ClashComment[];
  lastGroupToFinish: 'a' | 'b' | null;
  currentGuessingGroup: 'a' | 'b' | null;
  currentRoundGuessesA: ClashGuess[];
  currentRoundGuessesB: ClashGuess[];
  teamScores: { a: number; b: number };
}
```

Replace with:
```typescript
export interface ClashData {
  groupA: ClashGroup;
  groupB: ClashGroup;
  schedule: ClashRound[];
  currentRoundIndex: number;
  currentRoundCommentsA: ClashComment[];
  currentRoundCommentsB: ClashComment[];
  lastGroupToFinish: 'a' | 'b' | null;
  currentGuessingGroup: 'a' | 'b' | null;
  currentRoundGuessesA: ClashGuess[];
  currentRoundGuessesB: ClashGuess[];
  teamScores: { a: number; b: number };
}

export interface Idea {
  id: string;
  authorId: string;
  text: string;
  submittedAt: number;
}

export interface IdeaRating {
  raterId: string;
  ideaId: string;
  points: number;
  comment?: string;
}

export interface IdeaGameData {
  incognitoMode: boolean;
  ideas: Idea[];
  schedule: string[];
  currentRoundIndex: number;
  currentRoundRatings: IdeaRating[];
}
```

Then, in the local `Game` interface, find:
```typescript
  // Which game type to play: 'mirror' (default), 'basket', or 'clash'
  gameType?: 'mirror' | 'basket' | 'clash';
  basketData?: BasketData;
  clashData?: ClashData;
```

Replace with:
```typescript
  // Which game type to play: 'mirror' (default), 'basket', 'clash', or 'ideas'
  gameType?: 'mirror' | 'basket' | 'clash' | 'ideas';
  basketData?: BasketData;
  clashData?: ClashData;
  ideaData?: IdeaGameData;
  // Whether the admin also submits an idea for the group to rate (default: false)
  ideaIncognitoMode?: boolean;
```

And find the local `Game` interface's `status` field:
```typescript
  status: "waiting" | "active" | "guessing_phase" | "finished" | "basket_writing" | "basket_guessing" | "clash_writing" | "clash_guessing";
```

Replace with:
```typescript
  status: "waiting" | "active" | "guessing_phase" | "finished" | "basket_writing" | "basket_guessing" | "clash_writing" | "clash_guessing" | "idea_writing" | "idea_rating";
```

- [ ] **Step 3: Extend the local `GameContextType`**

Find:
```typescript
  saveClashGroups: (groupA: ClashGroup, groupB: ClashGroup) => Promise<void>;
  startClashGame: () => Promise<void>;
  submitClashComment: (text: string) => Promise<void>;
  revealClashComments: () => Promise<void>;
  submitClashGuess: (commentWriterId: string, guessedSubjectId: string) => Promise<void>;
  submitClashAuthorGuess: (commentWriterId: string, guessedAuthorId: string) => Promise<void>;
  advanceClashGuessing: () => Promise<void>;
```

Replace with:
```typescript
  saveClashGroups: (groupA: ClashGroup, groupB: ClashGroup) => Promise<void>;
  startClashGame: () => Promise<void>;
  submitClashComment: (text: string) => Promise<void>;
  revealClashComments: () => Promise<void>;
  submitClashGuess: (commentWriterId: string, guessedSubjectId: string) => Promise<void>;
  submitClashAuthorGuess: (commentWriterId: string, guessedAuthorId: string) => Promise<void>;
  advanceClashGuessing: () => Promise<void>;
  startIdeaGame: () => Promise<void>;
  submitIdea: (text: string) => Promise<void>;
  startIdeaRatingRounds: () => Promise<void>;
  submitIdeaRating: (ideaId: string, points: number, comment?: string) => Promise<void>;
  startNextIdeaRound: () => Promise<void>;
  updateIdeaIncognitoMode: (ideaIncognitoMode: boolean) => Promise<void>;
```

- [ ] **Step 4: Widen `setGameType`'s signature**

Find:
```typescript
  const setGameType = async (type: 'mirror' | 'basket' | 'clash'): Promise<void> => {
```

Replace with:
```typescript
  const setGameType = async (type: 'mirror' | 'basket' | 'clash' | 'ideas'): Promise<void> => {
```

Also update its signature in the `GameContextType` interface — find:
```typescript
  setGameType: (type: 'mirror' | 'basket' | 'clash') => Promise<void>;
```

Replace with:
```typescript
  setGameType: (type: 'mirror' | 'basket' | 'clash' | 'ideas') => Promise<void>;
```

- [ ] **Step 5: Add the six new functions**

Find the end of `advanceClashGuessing` (immediately before `const listAllGames = async ():` — use this as your anchor):
```typescript
  const listAllGames = async (): Promise<Game[]> => {
```

Insert immediately before it:
```typescript
  const startIdeaGame = async (): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame || auth.currentUser.uid !== currentGame.adminId) {
      throw new Error("Only the admin can start the game");
    }
    const eligibleWriters = (currentGame.adminWritesComments ?? false)
      ? currentGame.participants.map((p: Participant) => p.userId)
      : currentGame.participants.filter((p: Participant) => p.userId !== currentGame.adminId).map((p: Participant) => p.userId);
    if (eligibleWriters.length < 2) {
      throw new Error("Need at least 2 players (excluding admin) to start Group Ideas. Enable 'Admin writes comments' or add more players.");
    }
    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      await updateDoc(gameRef, {
        status: 'idea_writing',
        ideaData: {
          incognitoMode: currentGame.ideaIncognitoMode ?? true,
          ideas: [],
          schedule: [],
          currentRoundIndex: 0,
          currentRoundRatings: [],
        },
      });
    } catch (err) {
      console.error('Error starting idea game:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const submitIdea = async (text: string): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame?.ideaData) throw new Error("No active Group Ideas game");
    if (!text.trim()) throw new Error("Idea cannot be empty");
    if (text.trim().length > 500) throw new Error("Idea must be 500 characters or fewer");
    const idea: Idea = {
      id: `${Date.now()}-${auth.currentUser.uid}-${currentGame.ideaData.ideas.length}`,
      authorId: auth.currentUser.uid,
      text: text.trim(),
      submittedAt: Date.now(),
    };
    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      await updateDoc(gameRef, {
        'ideaData.ideas': arrayUnion(idea),
      });
    } catch (err) {
      console.error('Error submitting idea:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const startIdeaRatingRounds = async (): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame || auth.currentUser.uid !== currentGame.adminId) {
      throw new Error("Only the admin can start the rating rounds");
    }
    if (!currentGame.ideaData) throw new Error("No active Group Ideas game");
    const authorIdsWithIdeas = Array.from(new Set(currentGame.ideaData.ideas.map((i: Idea) => i.authorId)));
    if (authorIdsWithIdeas.length < 2) {
      throw new Error("Need at least 2 participants with submitted ideas to start rating");
    }
    try {
      setLoading(true);
      const schedule = generateIdeaSchedule(authorIdsWithIdeas);
      const gameRef = doc(db, 'games', currentGame.id);
      await updateDoc(gameRef, {
        status: 'idea_rating',
        'ideaData.schedule': schedule,
        'ideaData.currentRoundIndex': 0,
        'ideaData.currentRoundRatings': [],
      });
    } catch (err) {
      console.error('Error starting idea rating rounds:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const submitIdeaRating = async (ideaId: string, points: number, comment?: string): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame?.ideaData) throw new Error("No active Group Ideas game");
    if (points < 0 || points > 5) throw new Error("Points must be between 0 and 5");
    const { ideas, currentRoundRatings, incognitoMode } = currentGame.ideaData;
    const idea = ideas.find((i: Idea) => i.id === ideaId);
    if (!idea) throw new Error("Idea not found");
    const raterId = auth.currentUser.uid;
    const alreadyRated = currentRoundRatings.some((r: IdeaRating) => r.raterId === raterId && r.ideaId === ideaId);
    if (alreadyRated) throw new Error("You have already rated this idea");
    const rating: IdeaRating = {
      raterId,
      ideaId,
      points,
      ...(incognitoMode && comment?.trim() ? { comment: comment.trim() } : {}),
    };
    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      await updateDoc(gameRef, {
        'ideaData.currentRoundRatings': arrayUnion(rating),
        [`scores.${idea.authorId}`]: (currentGame.scores?.[idea.authorId] ?? 0) + points,
      });
    } catch (err) {
      console.error('Error submitting idea rating:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const startNextIdeaRound = async (): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame || auth.currentUser.uid !== currentGame.adminId) {
      throw new Error("Only the admin can start the next round");
    }
    if (!currentGame.ideaData) throw new Error("No active Group Ideas game");
    const { schedule, currentRoundIndex } = currentGame.ideaData;
    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      if (currentRoundIndex + 1 >= schedule.length) {
        await updateDoc(gameRef, { status: 'finished' });
      } else {
        await updateDoc(gameRef, {
          'ideaData.currentRoundIndex': currentRoundIndex + 1,
          'ideaData.currentRoundRatings': [],
        });
      }
    } catch (err) {
      console.error('Error starting next idea round:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateIdeaIncognitoMode = async (ideaIncognitoMode: boolean): Promise<void> => {
    if (!currentGame || !auth.currentUser || auth.currentUser.uid !== currentGame.adminId) {
      throw new Error("Only the admin can update this setting");
    }
    if (currentGame.status !== "waiting") {
      throw new Error("This setting can only be updated before the game starts");
    }
    try {
      setLoading(true);
      const gameRef = doc(db, "games", currentGame.id);
      await updateDoc(gameRef, { ideaIncognitoMode });
    } catch (err) {
      console.error("Error updating idea incognito mode setting:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

```

- [ ] **Step 6: Wire the six functions into the `value` object**

Find, inside the `useMemo` building the context `value` (search for `advanceClashGuessing,` as your anchor — it should appear as a bare property shorthand in the returned object):
```typescript
      advanceClashGuessing,
```

Replace with:
```typescript
      advanceClashGuessing,
      startIdeaGame,
      submitIdea,
      startIdeaRatingRounds,
      submitIdeaRating,
      startNextIdeaRound,
      updateIdeaIncognitoMode,
```

- [ ] **Step 7: Verify**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx tsc --noEmit -p apps/web/tsconfig.json
```

Expected: exactly the 3 pre-existing baseline errors, nothing new.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/contexts/GameContext.tsx
git commit -m "$(cat <<'EOF'
Add GameContext functions for Group Ideas game mode

Six new functions mirroring basket mode's five equivalents:
startIdeaGame, submitIdea, startIdeaRatingRounds, submitIdeaRating,
startNextIdeaRound, updateIdeaIncognitoMode. Scoring is incremental —
each rating immediately adds its points to scores[authorId], same
pattern basket/clash already use for guesses — so the existing
Leaderboard component needs no changes.
EOF
)"
```

---

## Task 3: Locale strings (`packages/shared/src/locales`)

**Files:**
- Modify: `packages/shared/src/locales/en.json`
- Modify: `packages/shared/src/locales/uk.json`

**Interfaces:**
- Produces (consumed by Tasks 4-7): a `game.ui.ideas.*` key namespace, plus one new top-level `game.ui.gameTypeIdeas` key alongside the existing `gameTypeMirror`/`gameTypeBasket`/`gameTypeClash`, plus `game.ui.ideaIncognitoModeTitle`/`ideaIncognitoModeDescription` alongside the other admin-setting title/description pairs.

- [ ] **Step 1: `packages/shared/src/locales/en.json`**

Find (the game-type button labels — search for `"gameTypeClash"`):
```json
        "gameTypeClash": "Head-to-Head",
```

Replace with:
```json
        "gameTypeClash": "Head-to-Head",
        "gameTypeIdeas": "Group Ideas",
```

Find (the admin settings title/description block — search for `"showGuessResultsDescription"`):
```json
        "showGuessResultsDescription": "Show guess accuracy results to the target after guessing",
```

Replace with:
```json
        "showGuessResultsDescription": "Show guess accuracy results to the target after guessing",
        "ideaIncognitoModeTitle": "Incognito ratings",
        "ideaIncognitoModeDescription": "When on, ratings and comments stay anonymous. When off, ratings are attributed and there's no comment box — discuss out loud instead",
```

Find (the end of the `"clash"` object — its final key before the closing `}`):
```json
        "confirmSubjectGuess": "This comment is about %{name}?",
        "confirmAuthorGuess": "%{name} wrote this comment?"
      }
```

Replace with:
```json
        "confirmSubjectGuess": "This comment is about %{name}?",
        "confirmAuthorGuess": "%{name} wrote this comment?"
      },
      "ideas": {
        "yourIdeas": "Your ideas",
        "writeIdea": "Write an idea...",
        "addIdea": "Add idea",
        "submittedCount": "%{count} idea(s) submitted",
        "waitingForOthers": "Waiting for others to finish writing...",
        "startRating": "Start Rating Rounds",
        "round": "Round %{current} of %{total}",
        "rateThisIdea": "Rate this idea",
        "pointsLabel": "Points (0-5)",
        "commentPlaceholder": "Optional comment...",
        "submitRating": "Submit Rating",
        "waitingForRatings": "%{count}/%{total} rated",
        "nextRound": "Next Round",
        "finishGame": "Finish Game",
        "confirmSubmitIdea": "Submit this idea?",
        "confirmSubmitRating": "Submit this rating?"
      }
```

- [ ] **Step 2: `packages/shared/src/locales/uk.json`**

Find:
```json
      "gameTypeClash": "Стінка на стінку",
```

Replace with:
```json
      "gameTypeClash": "Стінка на стінку",
      "gameTypeIdeas": "Групові ідеї",
```

Find:
```json
      "showGuessResultsDescription": "Показувати, чи правильно цілі впізнали коментаторів",
```

Replace with:
```json
      "showGuessResultsDescription": "Показувати, чи правильно цілі впізнали коментаторів",
      "ideaIncognitoModeTitle": "Анонімні оцінки",
      "ideaIncognitoModeDescription": "Коли увімкнено, оцінки та коментарі залишаються анонімними. Коли вимкнено, оцінки підписані і немає поля для коментаря — обговорюйте вголос",
```

Find (the end of the `"clash"` object — its final key before the closing `}`):
```json
        "confirmSubjectGuess": "Цей коментар про %{name}?",
        "confirmAuthorGuess": "%{name} написав(ла) цей коментар?"
      }
```

Replace with:
```json
        "confirmSubjectGuess": "Цей коментар про %{name}?",
        "confirmAuthorGuess": "%{name} написав(ла) цей коментар?"
      },
      "ideas": {
        "yourIdeas": "Ваші ідеї",
        "writeIdea": "Напишіть ідею...",
        "addIdea": "Додати ідею",
        "submittedCount": "Подано ідей: %{count}",
        "waitingForOthers": "Очікування, поки інші закінчать писати...",
        "startRating": "Почати оцінювання",
        "round": "Раунд %{current} з %{total}",
        "rateThisIdea": "Оцініть цю ідею",
        "pointsLabel": "Бали (0-5)",
        "commentPlaceholder": "Необов'язковий коментар...",
        "submitRating": "Надіслати оцінку",
        "waitingForRatings": "Оцінено: %{count}/%{total}",
        "nextRound": "Наступний раунд",
        "finishGame": "Завершити гру",
        "confirmSubmitIdea": "Надіслати цю ідею?",
        "confirmSubmitRating": "Надіслати цю оцінку?"
      }
```

- [ ] **Step 3: Verify both files are valid JSON**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
node -e "JSON.parse(require('fs').readFileSync('packages/shared/src/locales/en.json', 'utf8')); console.log('en.json OK')"
node -e "JSON.parse(require('fs').readFileSync('packages/shared/src/locales/uk.json', 'utf8')); console.log('uk.json OK')"
npx tsc --noEmit -p apps/web/tsconfig.json
```

Expected: both print `OK`; `tsc` shows exactly the 3 pre-existing baseline errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/locales/en.json packages/shared/src/locales/uk.json
git commit -m "$(cat <<'EOF'
Add locale strings for Group Ideas game mode

New game.ui.ideas.* namespace (English + Ukrainian), plus
gameTypeIdeas and ideaIncognitoModeTitle/Description alongside the
existing settings-toggle keys.
EOF
)"
```

---

## Task 4: `WaitingPhase.tsx` integration

**Files:**
- Modify: `apps/web/src/components/game/mirror/WaitingPhase.tsx`

**Interfaces:**
- Consumes: `startIdeaGame`, `updateIdeaIncognitoMode` (Task 2); `game.ui.gameTypeIdeas`, `game.ui.ideaIncognitoModeTitle`, `game.ui.ideaIncognitoModeDescription` (Task 3).
- Produces: a 4th `game-type-button` (`data-cy-type="ideas"`), an `idea-incognito-mode-toggle` checkbox (following the existing `id`-driven `data-cy={`${id}-toggle`}` pattern), `handleStartGame` calling `startIdeaGame()` when `gameType === 'ideas'`.

- [ ] **Step 1: Import the two new context functions**

Find:
```typescript
  const {
    loading,
    startGame,
    startBasketGame,
    updateAdminWritesComments,
    updateShowSurnames,
    updateTargetSelectionMode,
    updateShowGuessResults,
    setGameType,
  } = useGame();
```

Replace with:
```typescript
  const {
    loading,
    startGame,
    startBasketGame,
    startIdeaGame,
    updateAdminWritesComments,
    updateShowSurnames,
    updateTargetSelectionMode,
    updateShowGuessResults,
    updateIdeaIncognitoMode,
    setGameType,
  } = useGame();
```

- [ ] **Step 2: Wire `handleStartGame`**

Find:
```typescript
  const handleStartGame = async () => {
    try {
      setIsStarting(true);
      if (game.gameType === 'basket') {
        await startBasketGame();
      } else {
        await startGame();
      }
    } catch (error) {
```

Replace with:
```typescript
  const handleStartGame = async () => {
    try {
      setIsStarting(true);
      if (game.gameType === 'basket') {
        await startBasketGame();
      } else if (game.gameType === 'ideas') {
        await startIdeaGame();
      } else {
        await startGame();
      }
    } catch (error) {
```

- [ ] **Step 3: Add the toggler and extend the game-type selector**

Find:
```typescript
  const handleToggleShowGuessResults = makeToggler(
    updateShowGuessResults,
    () => !(game.showGuessResults ?? false),
  );
```

Replace with:
```typescript
  const handleToggleShowGuessResults = makeToggler(
    updateShowGuessResults,
    () => !(game.showGuessResults ?? false),
  );
  const handleToggleIdeaIncognitoMode = makeToggler(
    updateIdeaIncognitoMode,
    () => !(game.ideaIncognitoMode ?? true),
  );
```

Find:
```typescript
              {(['mirror', 'basket', 'clash'] as const).map(type => (
```

Replace with:
```typescript
              {(['mirror', 'basket', 'clash', 'ideas'] as const).map(type => (
```

- [ ] **Step 4: Add the settings toggle**

The existing settings block only renders `isAdmin && (game.gameType ?? 'mirror') === 'mirror'`. Group Ideas needs its own settings block (just the one `ideaIncognitoMode` toggle — `adminWritesComments` is reused as-is, but it's rendered inside the mirror-only block, so Group Ideas needs its own small block that also surfaces `adminWritesComments`). Find:

```typescript
          {/* Admin settings */}
          {isAdmin && (game.gameType ?? 'mirror') === 'mirror' && (
            <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
              {[
                {
                  id: 'admin-writes-comments',
                  label: t('game.ui.adminWritesCommentsTitle'),
                  desc: t('game.ui.adminWritesCommentsDescription'),
                  checked: game.adminWritesComments ?? false,
                  onChange: handleToggleAdminComments,
                },
                {
                  id: 'show-surnames',
                  label: t('game.ui.showSurnamesTitle'),
                  desc: t('game.ui.showSurnamesDescription'),
                  checked: game.showSurnames ?? false,
                  onChange: handleToggleShowSurnames,
                },
                {
                  id: 'target-selection-mode',
                  label: t('game.ui.targetSelectionModeTitle'),
                  desc: t('game.ui.targetSelectionModeDescription'),
                  checked: (game.targetSelectionMode ?? 'random') === 'chronological',
                  onChange: handleToggleTargetMode,
                },
                {
                  id: 'show-guess-results',
                  label: t('game.ui.showGuessResultsTitle'),
                  desc: t('game.ui.showGuessResultsDescription'),
                  checked: game.showGuessResults ?? false,
                  onChange: handleToggleShowGuessResults,
                },
              ].map(({ id, label, desc, checked, onChange }) => (
                <label key={id} className="flex items-center justify-between gap-4 cursor-pointer">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    data-cy={`${id}-toggle`}
                    checked={checked}
                    onChange={onChange}
                    className="w-5 h-5 accent-game-green"
                  />
                </label>
              ))}
            </div>
          )}
```

Replace with:
```typescript
          {/* Admin settings */}
          {isAdmin && (game.gameType ?? 'mirror') === 'mirror' && (
            <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
              {[
                {
                  id: 'admin-writes-comments',
                  label: t('game.ui.adminWritesCommentsTitle'),
                  desc: t('game.ui.adminWritesCommentsDescription'),
                  checked: game.adminWritesComments ?? false,
                  onChange: handleToggleAdminComments,
                },
                {
                  id: 'show-surnames',
                  label: t('game.ui.showSurnamesTitle'),
                  desc: t('game.ui.showSurnamesDescription'),
                  checked: game.showSurnames ?? false,
                  onChange: handleToggleShowSurnames,
                },
                {
                  id: 'target-selection-mode',
                  label: t('game.ui.targetSelectionModeTitle'),
                  desc: t('game.ui.targetSelectionModeDescription'),
                  checked: (game.targetSelectionMode ?? 'random') === 'chronological',
                  onChange: handleToggleTargetMode,
                },
                {
                  id: 'show-guess-results',
                  label: t('game.ui.showGuessResultsTitle'),
                  desc: t('game.ui.showGuessResultsDescription'),
                  checked: game.showGuessResults ?? false,
                  onChange: handleToggleShowGuessResults,
                },
              ].map(({ id, label, desc, checked, onChange }) => (
                <label key={id} className="flex items-center justify-between gap-4 cursor-pointer">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    data-cy={`${id}-toggle`}
                    checked={checked}
                    onChange={onChange}
                    className="w-5 h-5 accent-game-green"
                  />
                </label>
              ))}
            </div>
          )}

          {/* Idea game settings */}
          {isAdmin && game.gameType === 'ideas' && (
            <div className="space-y-3 border-t border-gray-200 dark:border-gray-700 pt-4 mb-4">
              {[
                {
                  id: 'admin-writes-comments',
                  label: t('game.ui.adminWritesCommentsTitle'),
                  desc: t('game.ui.adminWritesCommentsDescription'),
                  checked: game.adminWritesComments ?? false,
                  onChange: handleToggleAdminComments,
                },
                {
                  id: 'idea-incognito-mode',
                  label: t('game.ui.ideaIncognitoModeTitle'),
                  desc: t('game.ui.ideaIncognitoModeDescription'),
                  checked: game.ideaIncognitoMode ?? true,
                  onChange: handleToggleIdeaIncognitoMode,
                },
              ].map(({ id, label, desc, checked, onChange }) => (
                <label key={id} className="flex items-center justify-between gap-4 cursor-pointer">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    data-cy={`${id}-toggle`}
                    checked={checked}
                    onChange={onChange}
                    className="w-5 h-5 accent-game-green"
                  />
                </label>
              ))}
            </div>
          )}
```

(Note: `admin-writes-comments-toggle` now appears in two conditionally-rendered blocks — this is fine, only one is ever mounted at a time since `gameType` can't be both `'mirror'` and `'ideas'` simultaneously, so there's never a duplicate `data-cy` in the live DOM.)

- [ ] **Step 5: Verify**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx tsc --noEmit -p apps/web/tsconfig.json
```

Expected: exactly the 3 pre-existing baseline errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/game/mirror/WaitingPhase.tsx
git commit -m "$(cat <<'EOF'
Wire Group Ideas into WaitingPhase's game-type selector and settings

4th game-type-button ('ideas'), a dedicated settings block (reusing
adminWritesComments, adding the new ideaIncognitoMode toggle), and
handleStartGame calling startIdeaGame() for the new type.
EOF
)"
```

---

## Task 5: `IdeaWritingPhase.tsx`

**Files:**
- Create: `apps/web/src/components/game/ideas/IdeaWritingPhase.tsx`

**Interfaces:**
- Consumes: `submitIdea`, `startIdeaRatingRounds` (Task 2); `game.ui.ideas.*` keys (Task 3); `Game` type from `@mirror/shared` (Task 1).
- Produces: `data-cy="idea-input"`, `data-cy="submit-idea-button"`, `data-cy="start-rating-rounds-button"`.

- [ ] **Step 1: Write the component**

```tsx
import { useLanguage } from '../../../contexts/LanguageContext';
import React, { useState } from 'react';
import { Game } from '@mirror/shared';
import { useGame } from '../../../contexts/GameContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useSound } from '../../../contexts/SoundContext';
import { useAlert } from '../../../hooks/useAlert';

interface Props {
  game: Game;
}

export const IdeaWritingPhase: React.FC<Props> = ({ game }) => {
  const { user } = useAuth();
  const { loading, submitIdea, startIdeaRatingRounds } = useGame();
  const { playSound } = useSound();
  const { t } = useLanguage();
  const { showAlert, AlertModal } = useAlert();
  const [ideaText, setIdeaText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const isAdmin = user?.uid === game.adminId;
  const ideaData = game.ideaData!;
  const myIdeas = ideaData.ideas.filter(i => i.authorId === user?.uid);

  const eligibleWriterIds = (game.adminWritesComments ?? false)
    ? game.participants.map(p => p.userId)
    : game.participants.filter(p => p.userId !== game.adminId).map(p => p.userId);
  const authorIdsWithIdeas = new Set(ideaData.ideas.map(i => i.authorId));
  const submittedCount = eligibleWriterIds.filter(id => authorIdsWithIdeas.has(id)).length;
  const allSubmitted = submittedCount >= eligibleWriterIds.length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ideaText.trim()) return;
    showAlert(
      t('game.alerts.confirmTitle'),
      t('game.ui.ideas.confirmSubmitIdea'),
      [
        { text: t('common.cancel'), onPress: () => {}, style: 'secondary' },
        {
          text: t('common.yes'),
          onPress: async () => {
            try {
              setIsSubmitting(true);
              await submitIdea(ideaText.trim());
              setIdeaText('');
              await playSound('success');
            } catch (err) {
              showAlert(t('common.error'), (err instanceof Error && err.message) || t('common.error'));
            } finally {
              setIsSubmitting(false);
            }
          },
          style: 'primary',
        },
      ],
    );
  };

  const handleStartRating = async () => {
    try {
      setIsStarting(true);
      await startIdeaRatingRounds();
      await playSound('gameStart');
    } catch (err) {
      setIsStarting(false);
      showAlert(t('common.error'), (err instanceof Error && err.message) || t('common.error'));
    }
  };

  return (
    <>
      {AlertModal}
      <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 space-y-4">
        {myIdeas.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{t('game.ui.ideas.yourIdeas')}</p>
            {myIdeas.map(idea => (
              <div key={idea.id} className="bg-white dark:bg-gray-800 rounded-xl p-3 text-sm text-gray-900 dark:text-white">
                {idea.text}
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <textarea
            value={ideaText}
            onChange={e => setIdeaText(e.target.value)}
            placeholder={t('game.ui.ideas.writeIdea')}
            maxLength={500}
            rows={3}
            disabled={isSubmitting}
            data-cy="idea-input"
            className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-game-blue bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none disabled:opacity-50"
          />
          <div className="flex justify-between items-center">
            <span className={`text-sm ${ideaText.length >= 450 ? 'text-red-500' : 'text-gray-400'}`}>
              {ideaText.length}/500
            </span>
            <button
              type="submit"
              disabled={!ideaText.trim() || isSubmitting}
              data-cy="submit-idea-button"
              className="bg-game-blue text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isSubmitting ? t('common.loading') : t('game.ui.ideas.addIdea')}
            </button>
          </div>
        </form>

        <p className="text-center text-sm text-gray-400">
          {t('game.ui.ideas.submittedCount', { count: submittedCount })}
        </p>

        {isAdmin && (
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-blue-200 dark:border-blue-800">
            <button
              type="button"
              onClick={handleStartRating}
              disabled={isStarting || loading || !allSubmitted}
              data-cy="start-rating-rounds-button"
              className="bg-game-orange text-white px-6 py-3 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isStarting ? t('common.loading') : t('game.ui.ideas.startRating')}
            </button>
          </div>
        )}
      </div>
    </>
  );
};
```

- [ ] **Step 2: Verify**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx tsc --noEmit -p apps/web/tsconfig.json
```

Expected: exactly the 3 pre-existing baseline errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/game/ideas/IdeaWritingPhase.tsx
git commit -m "$(cat <<'EOF'
Add IdeaWritingPhase component for Group Ideas game mode

Lets a participant submit any number of ideas (each a separate
submitIdea() call), shows their own already-submitted ideas, and lets
the admin start the rating rounds once every eligible writer has
submitted at least one. Modeled directly on BasketWritingPhase.tsx.
EOF
)"
```

---

## Task 6: `IdeaRatingPhase.tsx`

**Files:**
- Create: `apps/web/src/components/game/ideas/IdeaRatingPhase.tsx`

**Interfaces:**
- Consumes: `submitIdeaRating`, `startNextIdeaRound` (Task 2); `game.ui.ideas.*` keys (Task 3); `Game` type from `@mirror/shared` (Task 1).
- Produces: `data-cy="idea-rating-card"` (`data-cy-idea-id`), `data-cy="idea-rating-points-button"` (`data-cy-idea-id`, `data-cy-points`), `data-cy="idea-rating-comment-input"` (`data-cy-idea-id`), `data-cy="submit-idea-rating-button"` (`data-cy-idea-id`), `data-cy="next-idea-round-button"`.

- [ ] **Step 1: Write the component**

```tsx
import { useLanguage } from '../../../contexts/LanguageContext';
import React, { useState } from 'react';
import { Game } from '@mirror/shared';
import { useGame } from '../../../contexts/GameContext';
import { useAuth } from '../../../contexts/AuthContext';
import { useSound } from '../../../contexts/SoundContext';
import { useAlert } from '../../../hooks/useAlert';

interface Props {
  game: Game;
}

export const IdeaRatingPhase: React.FC<Props> = ({ game }) => {
  const { user } = useAuth();
  const { loading, submitIdeaRating, startNextIdeaRound } = useGame();
  const { playSound } = useSound();
  const { t } = useLanguage();
  const { showAlert, AlertModal } = useAlert();
  const [selectedPoints, setSelectedPoints] = useState<Record<string, number>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [submittingIdeaId, setSubmittingIdeaId] = useState<string | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const ideaData = game.ideaData!;
  const { schedule, currentRoundIndex, currentRoundRatings, incognitoMode, ideas } = ideaData;
  const isAdmin = user?.uid === game.adminId;
  const isLastRound = currentRoundIndex + 1 >= schedule.length;
  const currentAuthorId = schedule[currentRoundIndex];
  const currentIdeas = ideas.filter(i => i.authorId === currentAuthorId);

  const raterId = user?.uid ?? '';
  const myRatingsThisRound = new Set(
    currentRoundRatings.filter(r => r.raterId === raterId).map(r => r.ideaId),
  );

  const eligibleRaterIds = (game.adminWritesComments ?? false)
    ? game.participants.map(p => p.userId)
    : game.participants.filter(p => p.userId !== game.adminId).map(p => p.userId);
  const allRatersDone = eligibleRaterIds.every(id => {
    const ratedIdeaIds = new Set(currentRoundRatings.filter(r => r.raterId === id).map(r => r.ideaId));
    return currentIdeas.every(idea => ratedIdeaIds.has(idea.id));
  });

  const handleSelectPoints = (ideaId: string, points: number) => {
    setSelectedPoints(prev => ({ ...prev, [ideaId]: points }));
  };

  const handleSubmitRating = (ideaId: string) => {
    const points = selectedPoints[ideaId];
    if (points === undefined) return;
    showAlert(
      t('game.alerts.confirmTitle'),
      t('game.ui.ideas.confirmSubmitRating'),
      [
        { text: t('common.cancel'), onPress: () => {}, style: 'secondary' },
        {
          text: t('common.yes'),
          onPress: async () => {
            try {
              setSubmittingIdeaId(ideaId);
              await submitIdeaRating(ideaId, points, commentDrafts[ideaId]);
              await playSound('points');
            } catch (err) {
              showAlert(t('common.error'), (err instanceof Error && err.message) || t('common.error'));
            } finally {
              setSubmittingIdeaId(null);
            }
          },
          style: 'primary',
        },
      ],
    );
  };

  const handleNextRound = async () => {
    if (isAdvancing) return;
    try {
      setIsAdvancing(true);
      await startNextIdeaRound();
      await playSound(isLastRound ? 'gameOver' : 'roundComplete');
    } catch (err) {
      showAlert(t('common.error'), (err instanceof Error && err.message) || t('common.error'));
    } finally {
      setIsAdvancing(false);
    }
  };

  return (
    <>
      {AlertModal}
      <div className="bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">{t('game.ui.statusLabel')}</span>
          <span className="bg-game-purple text-white text-xs font-bold px-3 py-1 rounded-full">
            {t('game.ui.ideas.round', { current: currentRoundIndex + 1, total: schedule.length })}
          </span>
        </div>

        <div className="space-y-4">
          {currentIdeas.map(idea => {
            const alreadyRated = myRatingsThisRound.has(idea.id);
            return (
              <div
                key={idea.id}
                data-cy="idea-rating-card"
                data-cy-idea-id={idea.id}
                className="bg-white dark:bg-gray-800 rounded-xl p-4 space-y-3"
              >
                <p className="text-gray-900 dark:text-white">{idea.text}</p>
                {alreadyRated ? (
                  <p className="text-sm text-game-green font-semibold">{t('game.ui.ideas.waitingForRatings', {
                    count: currentRoundRatings.filter(r => r.ideaId === idea.id).length,
                    total: eligibleRaterIds.length,
                  })}</p>
                ) : (
                  <>
                    <p className="text-xs text-gray-400">{t('game.ui.ideas.pointsLabel')}</p>
                    <div className="flex gap-2">
                      {[0, 1, 2, 3, 4, 5].map(points => (
                        <button
                          key={points}
                          type="button"
                          onClick={() => handleSelectPoints(idea.id, points)}
                          disabled={submittingIdeaId === idea.id || loading}
                          data-cy="idea-rating-points-button"
                          data-cy-idea-id={idea.id}
                          data-cy-points={points}
                          className={`w-10 h-10 rounded-full border-2 font-semibold transition-all ${
                            selectedPoints[idea.id] === points
                              ? 'bg-game-blue border-game-blue text-white'
                              : 'border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white hover:border-game-blue'
                          }`}
                        >
                          {points}
                        </button>
                      ))}
                    </div>
                    {incognitoMode && (
                      <textarea
                        value={commentDrafts[idea.id] ?? ''}
                        onChange={e => setCommentDrafts(prev => ({ ...prev, [idea.id]: e.target.value }))}
                        placeholder={t('game.ui.ideas.commentPlaceholder')}
                        maxLength={500}
                        rows={2}
                        disabled={submittingIdeaId === idea.id}
                        data-cy="idea-rating-comment-input"
                        data-cy-idea-id={idea.id}
                        className="w-full px-3 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-game-purple bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none disabled:opacity-50 text-sm"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => handleSubmitRating(idea.id)}
                      disabled={selectedPoints[idea.id] === undefined || submittingIdeaId === idea.id || loading}
                      data-cy="submit-idea-rating-button"
                      data-cy-idea-id={idea.id}
                      className="bg-game-purple text-white px-6 py-2 rounded-full font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {submittingIdeaId === idea.id ? t('common.loading') : t('game.ui.ideas.submitRating')}
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {isAdmin && (
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-purple-200 dark:border-purple-800">
            {isLastRound && (
              <p className="text-sm font-semibold text-game-green">{t('game.ui.ideas.finishGame')}</p>
            )}
            <button
              type="button"
              onClick={handleNextRound}
              disabled={isAdvancing || loading || !allRatersDone}
              data-cy="next-idea-round-button"
              className={`px-6 py-3 rounded-full text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity ${
                isLastRound ? 'bg-game-green' : 'bg-game-blue'
              }`}
            >
              {isAdvancing ? t('common.loading') : t('game.ui.ideas.nextRound')}
            </button>
          </div>
        )}
      </div>
    </>
  );
};
```

- [ ] **Step 2: Verify**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx tsc --noEmit -p apps/web/tsconfig.json
```

Expected: exactly the 3 pre-existing baseline errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/game/ideas/IdeaRatingPhase.tsx
git commit -m "$(cat <<'EOF'
Add IdeaRatingPhase component for Group Ideas game mode

Shows the current round's revealed ideas (author never named — the
idea's own author rates it too, which is what preserves anonymity;
excluding them would leak who they are). 0-5 point selector per idea,
optional comment box in incognito mode only. Modeled directly on
BasketGuessingPhase.tsx.
EOF
)"
```

---

## Task 7: `IdeaScreen.tsx` and `GameScreen.tsx` routing

**Files:**
- Create: `apps/web/src/components/game/ideas/IdeaScreen.tsx`
- Modify: `apps/web/src/components/game/GameScreen.tsx`

**Interfaces:**
- Consumes: `IdeaWritingPhase` (Task 5), `IdeaRatingPhase` (Task 6).

- [ ] **Step 1: `IdeaScreen.tsx`**

```tsx
import React from 'react';
import { Game } from '@mirror/shared';
import { IdeaWritingPhase } from './IdeaWritingPhase';
import { IdeaRatingPhase } from './IdeaRatingPhase';

interface Props {
  game: Game;
}

export const IdeaScreen: React.FC<Props> = ({ game }) => {
  if (game.status === 'idea_writing') return <IdeaWritingPhase game={game} />;
  if (game.status === 'idea_rating') return <IdeaRatingPhase game={game} />;
  return null;
};
```

- [ ] **Step 2: `GameScreen.tsx` routing**

Find:
```typescript
import { BasketScreen } from './basket/BasketScreen';
import { ClashScreen } from './clash/ClashScreen';
import { ClashSetupPanel } from './clash/ClashSetupPanel';
```

Replace with:
```typescript
import { BasketScreen } from './basket/BasketScreen';
import { ClashScreen } from './clash/ClashScreen';
import { ClashSetupPanel } from './clash/ClashSetupPanel';
import { IdeaScreen } from './ideas/IdeaScreen';
```

Find:
```typescript
        {gameType === 'clash' && (
          <>
            {currentGame.status === 'waiting' && (
              <>
                <WaitingPhase game={currentGame} />
                {user?.uid === currentGame.adminId && (
                  <div className="mt-4">
                    <ClashSetupPanel game={currentGame} />
                  </div>
                )}
              </>
            )}
            {(currentGame.status === 'clash_writing' || currentGame.status === 'clash_guessing') && (
              <ClashScreen game={currentGame} />
            )}
            {currentGame.status === 'finished' && <ResultsPhase game={currentGame} />}
          </>
        )}
```

Replace with:
```typescript
        {gameType === 'clash' && (
          <>
            {currentGame.status === 'waiting' && (
              <>
                <WaitingPhase game={currentGame} />
                {user?.uid === currentGame.adminId && (
                  <div className="mt-4">
                    <ClashSetupPanel game={currentGame} />
                  </div>
                )}
              </>
            )}
            {(currentGame.status === 'clash_writing' || currentGame.status === 'clash_guessing') && (
              <ClashScreen game={currentGame} />
            )}
            {currentGame.status === 'finished' && <ResultsPhase game={currentGame} />}
          </>
        )}

        {gameType === 'ideas' && (
          <>
            {currentGame.status === 'waiting' && <WaitingPhase game={currentGame} />}
            {(currentGame.status === 'idea_writing' || currentGame.status === 'idea_rating') && (
              <IdeaScreen game={currentGame} />
            )}
            {currentGame.status === 'finished' && <ResultsPhase game={currentGame} />}
          </>
        )}
```

- [ ] **Step 3: Verify with `tsc`**

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npx tsc --noEmit -p apps/web/tsconfig.json
```

Expected: exactly the 3 pre-existing baseline errors.

- [ ] **Step 4: Manual dev-server walkthrough**

This plan has no Cypress coverage (per the design spec, deferred to a later follow-up). Verify manually:

```bash
cd /Users/macbook/Desktop/dev/in-the-mirror
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
npm run dev --workspace=apps/web
```

Using two browser sessions (or one normal + one incognito window) signed in as two different real accounts (or the existing `test1`/`test2` Cypress test accounts, credentials in `apps/web/cypress.env.json`):
1. Admin creates a game, selects "Group Ideas" as the game type, leaves `ideaIncognitoMode` on (default), both accounts join.
2. Each account submits 2 ideas each (4 total). Confirm the admin's "Start Rating Rounds" button stays disabled until both have submitted, then becomes enabled.
3. Admin starts rating rounds. Confirm round 1 shows one participant's 2 ideas (author not named anywhere in the UI).
4. Both accounts (including whoever's ideas are shown) rate each idea 0-5, with a comment on at least one.
5. Confirm the admin's "Next Round"/"Finish Game" button stays disabled until everyone has rated every idea this round.
6. Advance through both rounds to `finished`. Confirm the `ResultsPhase` leaderboard shows point totals matching the sum of ratings each account's ideas received.
7. Repeat a short game with `ideaIncognitoMode` turned off before starting — confirm the comment textarea does not appear during rating, and ratings still work.

Report the outcome of this walkthrough (pass/fail per step, screenshots if anything looks wrong) before considering this task done — do not claim the feature works without having actually run it.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/game/ideas/IdeaScreen.tsx apps/web/src/components/game/GameScreen.tsx
git commit -m "$(cat <<'EOF'
Wire Group Ideas mode into GameScreen routing

IdeaScreen.tsx routes idea_writing/idea_rating status to the two new
phase components, exactly mirroring BasketScreen.tsx's shape.
GameScreen.tsx gains a gameType === 'ideas' branch matching the
existing basket/clash branches. This completes Phase 1 (apps/web) of
the Group Ideas game mode — Phase 2 (apps/expo) is a separate future
plan.
EOF
)"
```
