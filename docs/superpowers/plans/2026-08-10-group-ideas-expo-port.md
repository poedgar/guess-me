# Group Ideas apps/expo Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the Group Ideas game mode (already shipped in `apps/web` + `packages/shared`) to `apps/expo`, so mobile users get the same mode.

**Architecture:** `apps/expo` duplicates rather than shares code with `apps/web`/`packages/shared` for every existing mode (its own local `Game`/`GameContextType`, its own copies of `basketSchedule.ts`/`clashSchedule.ts`). This port follows that established convention rather than introducing a one-off exception — a local `ideaSchedule.ts`, local `Idea`/`IdeaRating`/`IdeaGameData` interfaces, and six context functions ported from `apps/web`'s **current, already-hardened** implementations (not the original versions — `apps/web`'s own final security review found and fixed a scoring race, a missing eligibility guard, a weak server-side check, and a dropped comments-display requirement; this port starts from the corrected code).

**Tech Stack:** React Native (Expo SDK), Firebase JS SDK (`firebase/firestore`), Jest + React Native Testing Library.

## Global Constraints

- Full context: `docs/superpowers/specs/2026-08-10-group-ideas-expo-port-design.md` — read it if anything below is ambiguous.
- `apps/expo/contexts/GameContext.tsx` has its own local `Game`/`GameContextType`/`Participant` interfaces, entirely separate from `packages/shared/src/types.ts` and from `apps/web`'s local copy. All new types/fields go into `apps/expo`'s local copy — never touch `packages/shared` or `apps/web` in this plan.
- The six new context functions must be ported from `apps/web/src/contexts/GameContext.tsx`'s **current** implementations (as quoted verbatim in Task 3 below), not redesigned. In particular, `submitIdeaRating` MUST use `runTransaction` with a fresh in-transaction read for the eligibility check, the idea lookup, and the `alreadyRated` guard — never a plain `updateDoc` read-modify-write against local state (that was a real, already-fixed bug in `apps/web`'s first version).
- `apps/expo` has no `data-cy`/`testID` convention for game components (confirmed: `testID` appears in only 2 files total, neither game-related). Jest component tests query by text/role via React Native Testing Library, matching `BasketWritingPhase.test.tsx`/`BasketGuessingPhase.test.tsx`. Do not add `testID` props as part of this plan.
- Locale strings live in `apps/expo/locales/en.json` / `apps/expo/locales/uk.json` — separate files from `packages/shared/src/locales/`. Do not touch the shared locale files.
- Every new/changed file must type-check: run `cd apps/expo && npx tsc --noEmit` (from repo root, with `npm`/`node` on PATH via `export NVM_DIR="$HOME/.nvm"; [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"` first if commands fail with "command not found"). Baseline is currently 92 pre-existing errors unrelated to this work — confirm your change doesn't add to that count, don't chase unrelated pre-existing errors.
- Run tests with `cd apps/expo && npx jest <path>` (or `npm test -- <path>` from `apps/expo`).

---

### Task 1: Delete stale `.bak` files

**Files:**
- Delete: `apps/expo/contexts/GameContext.tsx.bak`
- Delete: `apps/expo/components/game/ActivePhase.tsx.bak`

**Interfaces:** None — pure housekeeping, unrelated to the port itself.

- [ ] **Step 1: Delete both files**

```bash
git rm apps/expo/contexts/GameContext.tsx.bak apps/expo/components/game/ActivePhase.tsx.bak
```

- [ ] **Step 2: Confirm nothing references them**

```bash
grep -rn "GameContext.tsx.bak\|ActivePhase.tsx.bak" apps/expo --include="*.ts" --include="*.tsx" --include="*.json"
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git commit -m "Remove stale .bak backup files from apps/expo

Noticed during research for the Group Ideas port — dated well before
this work, unrelated to it, pure cleanup."
```

---

### Task 2: Local types + `ideaSchedule.ts` util

**Files:**
- Modify: `apps/expo/contexts/GameContext.tsx`
- Create: `apps/expo/utils/ideaSchedule.ts`
- Create: `apps/expo/__tests__/ideaSchedule.test.ts`

**Interfaces:**
- Produces: `Idea`, `IdeaRating`, `IdeaGameData` interfaces (exported from `GameContext.tsx`); `Game.ideaData?: IdeaGameData`; `Game.ideaIncognitoMode?: boolean`; `Game.status` widened; `Game.gameType` widened; `GameContextType.setGameType` parameter widened; `generateIdeaSchedule(participantIds: string[]): string[]` (exported from `utils/ideaSchedule.ts`). Later tasks depend on these exact names and shapes.

- [ ] **Step 1: Add `Idea`/`IdeaRating`/`IdeaGameData` interfaces and widen `Game`**

In `apps/expo/contexts/GameContext.tsx`, find:

```typescript
export interface Game {
  id: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  participants: Participant[];
```

Replace with:

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

export interface Game {
  id: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  participants: Participant[];
```

- [ ] **Step 2: Widen `status`, `gameType`, add `ideaData`/`ideaIncognitoMode` fields**

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
  // Whether ratings/comments in Group Ideas mode stay anonymous (default: true)
  ideaIncognitoMode?: boolean;
```

- [ ] **Step 3: Widen `GameContextType.setGameType` and add the six new function signatures**

Find:

```typescript
  setGameType: (type: 'mirror' | 'basket' | 'clash') => Promise<void>;
```

Replace with:

```typescript
  setGameType: (type: 'mirror' | 'basket' | 'clash' | 'ideas') => Promise<void>;
```

Find (the end of the interface, right before its closing brace):

```typescript
  awardPointsToPlayers: (
    awards: { recipientId: string; points: number }[],
  ) => Promise<void>;
  skipPostCommentPhase: () => Promise<void>;
}
```

Replace with:

```typescript
  awardPointsToPlayers: (
    awards: { recipientId: string; points: number }[],
  ) => Promise<void>;
  skipPostCommentPhase: () => Promise<void>;
  startIdeaGame: () => Promise<void>;
  submitIdea: (text: string) => Promise<void>;
  startIdeaRatingRounds: () => Promise<void>;
  submitIdeaRating: (ideaId: string, points: number, comment?: string) => Promise<void>;
  startNextIdeaRound: () => Promise<void>;
  updateIdeaIncognitoMode: (ideaIncognitoMode: boolean) => Promise<void>;
}
```

- [ ] **Step 4: Create `apps/expo/utils/ideaSchedule.ts`**

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

(Fisher-Yates shuffle — identical technique to `apps/expo/utils/basketSchedule.ts`'s own shuffle and to `packages/shared/src/utils/ideaSchedule.ts`. No per-round pairing needed, just an ordering.)

- [ ] **Step 5: Write `apps/expo/__tests__/ideaSchedule.test.ts`**

```typescript
import { generateIdeaSchedule } from '../utils/ideaSchedule';

describe('generateIdeaSchedule', () => {
  it('returns an array of the same length as the input', () => {
    const ids = ['a', 'b', 'c', 'd'];
    expect(generateIdeaSchedule(ids)).toHaveLength(4);
  });

  it('contains exactly the same participant ids, no duplicates or omissions', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const schedule = generateIdeaSchedule(ids);
    expect(new Set(schedule)).toEqual(new Set(ids));
    expect(schedule).toHaveLength(ids.length);
  });

  it('does not mutate the input array', () => {
    const ids = ['a', 'b', 'c'];
    const copy = [...ids];
    generateIdeaSchedule(ids);
    expect(ids).toEqual(copy);
  });

  it('handles a single participant', () => {
    expect(generateIdeaSchedule(['solo'])).toEqual(['solo']);
  });

  it('handles an empty array', () => {
    expect(generateIdeaSchedule([])).toEqual([]);
  });
});
```

- [ ] **Step 6: Run the test and type-check**

```bash
cd apps/expo && npx jest ideaSchedule.test.ts
cd apps/expo && npx tsc --noEmit
```

Expected: all 5 tests pass; `tsc` shows no new errors beyond the known 92-error baseline (the new interfaces/fields are additive and shouldn't introduce any — if `tsc` shows errors specifically in the lines you just added, fix them before proceeding).

- [ ] **Step 7: Commit**

```bash
git add apps/expo/contexts/GameContext.tsx apps/expo/utils/ideaSchedule.ts apps/expo/__tests__/ideaSchedule.test.ts
git commit -m "Add Idea types and ideaSchedule.ts util to apps/expo

Local duplication matching the existing basket/clash pattern in this
file, not a @mirror/shared import."
```

---

### Task 3: GameContext functions

**Files:**
- Modify: `apps/expo/contexts/GameContext.tsx`
- Create: `apps/expo/__tests__/GameContext.ideas.test.ts`

**Interfaces:**
- Consumes: `Idea`, `IdeaRating`, `IdeaGameData`, `generateIdeaSchedule` (Task 2).
- Produces: the six functions below, added to `GameProvider`'s return value (the context's `value={{ ...(existing), startIdeaGame, submitIdea, startIdeaRatingRounds, submitIdeaRating, startNextIdeaRound, updateIdeaIncognitoMode }}` object) — find that object in the file (search for `skipPostCommentPhase,` inside the provider's returned value, which is the last existing function in `GameContextType`) and add the six new function names there too, in the same order as the interface.

- [ ] **Step 1: Import `generateIdeaSchedule`**

Find:

```typescript
import { BasketAssignment, BasketRound, generateBasketSchedule } from '@/utils/basketSchedule';
import { ClashAssignment, ClashRound, generateClashSchedule } from '@/utils/clashSchedule';
```

Replace with:

```typescript
import { BasketAssignment, BasketRound, generateBasketSchedule } from '@/utils/basketSchedule';
import { ClashAssignment, ClashRound, generateClashSchedule } from '@/utils/clashSchedule';
import { generateIdeaSchedule } from '@/utils/ideaSchedule';
```

- [ ] **Step 2: Add the six functions**

Find (the end of `skipPostCommentPhase`'s implementation — the last function defined before the provider's `return`/`value` block; confirm by locating `const skipPostCommentPhase = async` in the file and finding its closing `};`):

```typescript
  const setGameType = async (type: 'mirror' | 'basket' | 'clash'): Promise<void> => {
    if (!currentGame || !user || user.uid !== currentGame.adminId) {
      throw new Error("Only the admin can update this setting");
    }
    const gameRef = doc(db, 'games', currentGame.id);
    await updateDoc(gameRef, { gameType: type });
  };
```

Replace with:

```typescript
  const setGameType = async (type: 'mirror' | 'basket' | 'clash' | 'ideas'): Promise<void> => {
    if (!currentGame || !user || user.uid !== currentGame.adminId) {
      throw new Error("Only the admin can update this setting");
    }
    const gameRef = doc(db, 'games', currentGame.id);
    await updateDoc(gameRef, { gameType: type });
  };

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
    const eligibleWriters = (currentGame.adminWritesComments ?? false)
      ? currentGame.participants.map((p: Participant) => p.userId)
      : currentGame.participants.filter((p: Participant) => p.userId !== currentGame.adminId).map((p: Participant) => p.userId);
    const missingWriters = eligibleWriters.filter(id => !authorIdsWithIdeas.includes(id));
    if (eligibleWriters.length < 2 || missingWriters.length > 0) {
      throw new Error("Every eligible participant must submit at least one idea before rating rounds can start");
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

    const raterId = auth.currentUser.uid;
    const gameRef = doc(db, 'games', currentGame.id);

    try {
      setLoading(true);
      await runTransaction(db, async (transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game not found");
        const gameData = gameDoc.data() as Game;
        const ideaData = gameData.ideaData;
        if (!ideaData) throw new Error("No active Group Ideas game");

        const eligibleRaters = (gameData.adminWritesComments ?? false)
          ? gameData.participants.map((p: Participant) => p.userId)
          : gameData.participants.filter((p: Participant) => p.userId !== gameData.adminId).map((p: Participant) => p.userId);
        if (!eligibleRaters.includes(raterId)) {
          throw new Error("You are not eligible to rate ideas in this game");
        }

        const idea = ideaData.ideas.find((i: Idea) => i.id === ideaId);
        if (!idea) throw new Error("Idea not found");

        const alreadyRated = ideaData.currentRoundRatings.some(
          (r: IdeaRating) => r.raterId === raterId && r.ideaId === ideaId,
        );
        if (alreadyRated) throw new Error("You have already rated this idea");

        const rating: IdeaRating = {
          raterId, ideaId, points,
          ...(ideaData.incognitoMode && comment?.trim() ? { comment: comment.trim() } : {}),
        };

        transaction.update(gameRef, {
          'ideaData.currentRoundRatings': [...ideaData.currentRoundRatings, rating],
          [`scores.${idea.authorId}`]: (gameData.scores?.[idea.authorId] ?? 0) + points,
        });
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

- [ ] **Step 3: Expose the six functions on the context value**

Find (the exact line will be inside the `<GameContext.Provider value={{ ... skipPostCommentPhase, }}>` block or a `const value = { ... skipPostCommentPhase };` object — locate the literal text `skipPostCommentPhase,` where it appears as a shorthand-property entry in that value object, not in its own function definition):

```typescript
    skipPostCommentPhase,
```

Replace with:

```typescript
    skipPostCommentPhase,
    startIdeaGame,
    submitIdea,
    startIdeaRatingRounds,
    submitIdeaRating,
    startNextIdeaRound,
    updateIdeaIncognitoMode,
```

(If `skipPostCommentPhase,` appears more than once in the file — once in its own `const skipPostCommentPhase = async () => {...}` definition and once as a shorthand property in the returned value object — only edit the second occurrence, inside the returned/provided value. Verify by checking the surrounding lines: the value-object occurrence is inside a `{ currentGame, loading, createGame, ... }`-shaped object literal being returned or passed to `.Provider value={...}`.)

- [ ] **Step 4: Type-check**

```bash
cd apps/expo && npx tsc --noEmit
```

Expected: no new errors beyond the 92-error baseline.

- [ ] **Step 5: Write `apps/expo/__tests__/GameContext.ideas.test.ts`**

Modeled on `GameContext.basket.test.ts` (plain `updateDoc` functions) and `GameContext.givePointsToTarget.test.tsx` (the `runTransaction` pattern, for `submitIdeaRating`):

```typescript
import { act, renderHook } from '@testing-library/react-native';
import React from 'react';
import { GameProvider, useGame } from '../contexts/GameContext';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'user-1', displayName: 'Alice', email: 'alice@example.com' },
    isSignedIn: true,
  }),
}));

const PLAYERS = [
  { userId: 'user-1', userName: 'Alice', userEmail: 'alice@example.com', joinedAt: new Date() },
  { userId: 'user-2', userName: 'Bob',   userEmail: 'bob@example.com',   joinedAt: new Date() },
  { userId: 'user-3', userName: 'Carol', userEmail: 'carol@example.com', joinedAt: new Date() },
];

const BASE_GAME = {
  adminId: 'user-1', adminName: 'Alice', adminEmail: 'alice@example.com',
  status: 'waiting', participants: PLAYERS,
  rounds: [], scores: {}, guessingData: { commentsByTarget: {}, possibleAuthors: [] },
  guessResults: {}, createdAt: new Date(), currentRound: null, gameType: 'ideas',
};

function makeSnap(data: Record<string, unknown>, id = 'game-abc') {
  return { exists: () => true, id, data: () => data };
}

beforeEach(() => {
  const config = require('@/config/firebase');
  config.auth.currentUser = { uid: 'user-1', displayName: 'Alice', email: 'alice@example.com', photoURL: null };
  const f = require('firebase/firestore');
  f.doc.mockReturnValue({ path: 'games/game-abc' });
  f.getDoc.mockResolvedValue({ exists: () => false, data: () => ({}) });
  f.setDoc.mockResolvedValue(undefined);
  f.updateDoc.mockResolvedValue(undefined);
  f.onSnapshot.mockReturnValue(jest.fn());
  f.arrayUnion.mockImplementation((val: any) => val);
  f.serverTimestamp.mockReturnValue(new Date());
});

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(GameProvider, null, children);

async function enterWithGame(gameData: object) {
  const f = require('firebase/firestore');
  const gameDoc = { id: 'game-abc', path: 'games/game-abc' };
  f.doc.mockReturnValue(gameDoc);
  f.getDoc
    .mockResolvedValueOnce({ exists: () => true, data: () => ({ password: 'SECRET' }) })
    .mockResolvedValueOnce({ exists: () => false });
  f.onSnapshot.mockImplementationOnce((_ref: any, cb: (s: any) => void) => {
    cb({ exists: () => true, id: 'game-abc', data: () => gameData });
    return jest.fn();
  });
  const { result } = renderHook(() => useGame(), { wrapper });
  await act(async () => {
    try { await result.current.enterGame('SECRET'); } catch (_) {}
  });
  return { result, gameDoc };
}

// ── startIdeaGame ────────────────────────────────────────────────────────────
describe('startIdeaGame', () => {
  it('is exposed by useGame', () => {
    const { result } = renderHook(() => useGame(), { wrapper });
    expect(typeof result.current.startIdeaGame).toBe('function');
  });

  it('sets status idea_writing with ideaData initialized from ideaIncognitoMode', async () => {
    const { result, gameDoc } = await enterWithGame({ ...BASE_GAME, ideaIncognitoMode: false });
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.startIdeaGame(); });

    expect(f.updateDoc).toHaveBeenCalledWith(
      gameDoc,
      expect.objectContaining({
        status: 'idea_writing',
        ideaData: expect.objectContaining({
          incognitoMode: false,
          ideas: [],
          schedule: [],
          currentRoundIndex: 0,
          currentRoundRatings: [],
        }),
      }),
    );
  });

  it('defaults incognitoMode to true when ideaIncognitoMode is unset', async () => {
    const { result } = await enterWithGame(BASE_GAME);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.startIdeaGame(); });

    const arg = f.updateDoc.mock.calls[0][1];
    expect(arg.ideaData.incognitoMode).toBe(true);
  });

  it('throws when fewer than 2 eligible writers (admin excluded, adminWritesComments off)', async () => {
    const onePlayerGame = { ...BASE_GAME, participants: [PLAYERS[0], PLAYERS[1]], adminWritesComments: false };
    // Only user-2 is eligible (user-1 is admin, excluded) — 1 eligible writer, below the minimum of 2.
    const { result } = await enterWithGame(onePlayerGame);
    await expect(
      act(async () => { await result.current.startIdeaGame(); })
    ).rejects.toThrow();
  });
});

// ── submitIdea ───────────────────────────────────────────────────────────────
describe('submitIdea', () => {
  const gameWithIdeas = {
    ...BASE_GAME, status: 'idea_writing',
    ideaData: { incognitoMode: true, ideas: [], schedule: [], currentRoundIndex: 0, currentRoundRatings: [] },
  };

  it('appends an idea with the caller as authorId', async () => {
    const { result, gameDoc } = await enterWithGame(gameWithIdeas);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.submitIdea('My idea'); });

    expect(f.updateDoc).toHaveBeenCalledWith(
      gameDoc,
      expect.objectContaining({
        'ideaData.ideas': expect.objectContaining({
          authorId: 'user-1',
          text: 'My idea',
        }),
      }),
    );
  });

  it('throws for an empty idea', async () => {
    const { result } = await enterWithGame(gameWithIdeas);
    await expect(
      act(async () => { await result.current.submitIdea('   '); })
    ).rejects.toThrow();
  });
});

// ── startIdeaRatingRounds ────────────────────────────────────────────────────
describe('startIdeaRatingRounds', () => {
  it('sets status idea_rating with a schedule covering every author', async () => {
    const game = {
      ...BASE_GAME, status: 'idea_writing', adminWritesComments: false,
      ideaData: {
        incognitoMode: true,
        ideas: [
          { id: 'i1', authorId: 'user-2', text: 'a', submittedAt: 1 },
          { id: 'i2', authorId: 'user-3', text: 'b', submittedAt: 2 },
        ],
        schedule: [], currentRoundIndex: 0, currentRoundRatings: [],
      },
    };
    const { result, gameDoc } = await enterWithGame(game);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.startIdeaRatingRounds(); });

    expect(f.updateDoc).toHaveBeenCalledWith(
      gameDoc,
      expect.objectContaining({
        status: 'idea_rating',
        'ideaData.currentRoundIndex': 0,
        'ideaData.currentRoundRatings': [],
      }),
    );
    const arg = f.updateDoc.mock.calls[0][1];
    expect(new Set(arg['ideaData.schedule'])).toEqual(new Set(['user-2', 'user-3']));
  });

  it('throws when an eligible writer has not submitted an idea', async () => {
    const game = {
      ...BASE_GAME, status: 'idea_writing', adminWritesComments: false,
      ideaData: {
        incognitoMode: true,
        // Only user-2 submitted — user-3 is also eligible (non-admin) but missing.
        ideas: [{ id: 'i1', authorId: 'user-2', text: 'a', submittedAt: 1 }],
        schedule: [], currentRoundIndex: 0, currentRoundRatings: [],
      },
    };
    const { result } = await enterWithGame(game);
    await expect(
      act(async () => { await result.current.startIdeaRatingRounds(); })
    ).rejects.toThrow('Every eligible participant must submit at least one idea before rating rounds can start');
  });
});

// ── submitIdeaRating (runTransaction) ────────────────────────────────────────
describe('submitIdeaRating', () => {
  const ROUND_GAME = {
    ...BASE_GAME, status: 'idea_rating', adminWritesComments: false,
    scores: { 'user-2': 0 },
    ideaData: {
      incognitoMode: true,
      ideas: [{ id: 'i1', authorId: 'user-2', text: 'idea text', submittedAt: 1 }],
      schedule: ['user-2', 'user-3'], currentRoundIndex: 0, currentRoundRatings: [],
    },
  };

  function setupTransaction(firestore: ReturnType<typeof require>, gameData: Record<string, unknown>) {
    const txnUpdate = jest.fn();
    firestore.runTransaction.mockImplementation(
      async (_db: unknown, cb: (t: { get: jest.Mock; update: jest.Mock }) => Promise<void>) => {
        const txn = { get: jest.fn().mockResolvedValue(makeSnap(gameData)), update: txnUpdate };
        await cb(txn);
      },
    );
    return { txnUpdate };
  }

  it('writes the rating and increments scores[authorId] by points', async () => {
    const { result } = await enterWithGame(ROUND_GAME);
    const f = require('firebase/firestore');
    const { txnUpdate } = setupTransaction(f, ROUND_GAME);

    await act(async () => { await result.current.submitIdeaRating('i1', 4); });

    expect(txnUpdate).toHaveBeenCalledTimes(1);
    const written = txnUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(written['scores.user-2']).toBe(4);
    expect(written['ideaData.currentRoundRatings']).toEqual([
      expect.objectContaining({ raterId: 'user-1', ideaId: 'i1', points: 4 }),
    ]);
  });

  it('includes the comment only when incognitoMode is true', async () => {
    const { result } = await enterWithGame(ROUND_GAME);
    const f = require('firebase/firestore');
    const { txnUpdate } = setupTransaction(f, ROUND_GAME);

    await act(async () => { await result.current.submitIdeaRating('i1', 3, 'nice idea'); });

    const written = txnUpdate.mock.calls[0][1] as Record<string, unknown>;
    const ratings = written['ideaData.currentRoundRatings'] as Array<{ comment?: string }>;
    expect(ratings[0].comment).toBe('nice idea');
  });

  it('omits the comment when incognitoMode is false, even if provided', async () => {
    const openGame = { ...ROUND_GAME, ideaData: { ...ROUND_GAME.ideaData, incognitoMode: false } };
    const { result } = await enterWithGame(openGame);
    const f = require('firebase/firestore');
    const { txnUpdate } = setupTransaction(f, openGame);

    await act(async () => { await result.current.submitIdeaRating('i1', 3, 'should be dropped'); });

    const written = txnUpdate.mock.calls[0][1] as Record<string, unknown>;
    const ratings = written['ideaData.currentRoundRatings'] as Array<{ comment?: string }>;
    expect(ratings[0].comment).toBeUndefined();
  });

  it('rejects a caller not in eligibleRaters (server-side, from the fresh transaction read)', async () => {
    // user-1 is admin; adminWritesComments is off in ROUND_GAME, so user-1 is not eligible.
    const { result } = await enterWithGame(ROUND_GAME);
    const f = require('firebase/firestore');
    setupTransaction(f, ROUND_GAME);

    let caught: Error | null = null;
    await act(async () => {
      try { await result.current.submitIdeaRating('i1', 2); }
      catch (e) { caught = e as Error; }
    });

    expect(caught?.message).toBe('You are not eligible to rate ideas in this game');
  });

  it('rejects a duplicate rating using the fresh transaction read, not stale local state', async () => {
    const { result } = await enterWithGame(ROUND_GAME);
    const f = require('firebase/firestore');
    // Server state already has user-1's rating for i1, even though local state (ROUND_GAME) doesn't.
    const serverGame = {
      ...ROUND_GAME,
      ideaData: {
        ...ROUND_GAME.ideaData,
        currentRoundRatings: [{ raterId: 'user-1', ideaId: 'i1', points: 5 }],
      },
      adminWritesComments: true, // make user-1 eligible so the duplicate check is what's actually tested
    };
    setupTransaction(f, serverGame);

    let caught: Error | null = null;
    await act(async () => {
      try { await result.current.submitIdeaRating('i1', 3); }
      catch (e) { caught = e as Error; }
    });

    expect(caught?.message).toBe('You have already rated this idea');
  });
});

// ── startNextIdeaRound ───────────────────────────────────────────────────────
describe('startNextIdeaRound', () => {
  it('increments currentRoundIndex and clears currentRoundRatings when rounds remain', async () => {
    const game = {
      ...BASE_GAME, status: 'idea_rating',
      ideaData: { incognitoMode: true, ideas: [], schedule: ['user-2', 'user-3'], currentRoundIndex: 0, currentRoundRatings: [{ raterId: 'x', ideaId: 'y', points: 1 }] },
    };
    const { result, gameDoc } = await enterWithGame(game);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.startNextIdeaRound(); });

    expect(f.updateDoc).toHaveBeenCalledWith(gameDoc, {
      'ideaData.currentRoundIndex': 1,
      'ideaData.currentRoundRatings': [],
    });
  });

  it('sets status finished on the last round', async () => {
    const game = {
      ...BASE_GAME, status: 'idea_rating',
      ideaData: { incognitoMode: true, ideas: [], schedule: ['user-2', 'user-3'], currentRoundIndex: 1, currentRoundRatings: [] },
    };
    const { result, gameDoc } = await enterWithGame(game);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.startNextIdeaRound(); });

    expect(f.updateDoc).toHaveBeenCalledWith(gameDoc, { status: 'finished' });
  });
});

// ── updateIdeaIncognitoMode ──────────────────────────────────────────────────
describe('updateIdeaIncognitoMode', () => {
  it('updates ideaIncognitoMode while status is waiting', async () => {
    const { result, gameDoc } = await enterWithGame(BASE_GAME);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.updateIdeaIncognitoMode(false); });

    expect(f.updateDoc).toHaveBeenCalledWith(gameDoc, { ideaIncognitoMode: false });
  });

  it('throws once the game has started', async () => {
    const { result } = await enterWithGame({ ...BASE_GAME, status: 'idea_writing' });
    await expect(
      act(async () => { await result.current.updateIdeaIncognitoMode(false); })
    ).rejects.toThrow('This setting can only be updated before the game starts');
  });
});
```

- [ ] **Step 6: Run the test**

```bash
cd apps/expo && npx jest GameContext.ideas.test.ts
```

Expected: all tests pass. If `startIdeaGame`'s "throws when fewer than 2 eligible writers" test fails because the mock game has 2 total participants but only 1 eligible (admin excluded) — double check the eligibility math matches the function's actual logic (admin excluded when `adminWritesComments` is off/unset).

- [ ] **Step 7: Commit**

```bash
git add apps/expo/contexts/GameContext.tsx apps/expo/__tests__/GameContext.ideas.test.ts
git commit -m "Add Group Ideas GameContext functions to apps/expo

Ported from apps/web's current, already-hardened implementations —
submitIdeaRating uses runTransaction with a fresh in-transaction
eligibility check, idea lookup, and alreadyRated guard, matching the
fix apps/web's own final security review produced (not the original,
vulnerable read-modify-write version)."
```

---

### Task 4: Locale strings

**Files:**
- Modify: `apps/expo/locales/en.json`
- Modify: `apps/expo/locales/uk.json`

**Interfaces:** Produces the `game.ui.gameTypeIdeas`, `game.ui.ideaIncognitoModeTitle`/`Description`, and `game.ui.ideas.*` keys later tasks (WaitingPhase, IdeaWritingPhase, IdeaRatingPhase) read via `t('game.ui.ideas.<key>', { locale, ...params })`.

- [ ] **Step 1: Add `gameTypeIdeas` to `en.json`**

Find:

```json
      "gameTypeClash": "Head-to-Head",
      "gameTypeSoon": "Soon",
```

Replace with:

```json
      "gameTypeClash": "Head-to-Head",
      "gameTypeIdeas": "Group Ideas",
      "gameTypeSoon": "Soon",
```

- [ ] **Step 2: Add the `ideas` namespace to `en.json`**

Find:

```json
        "confirmSubjectGuess": "This comment is about %{name}?",
        "confirmAuthorGuess": "%{name} wrote this comment?"
      }
    }
  },
```

Replace with:

```json
        "confirmSubjectGuess": "This comment is about %{name}?",
        "confirmAuthorGuess": "%{name} wrote this comment?"
      },
      "ideas": {
        "yourIdeas": "Your ideas",
        "writeIdea": "Write your idea...",
        "addIdea": "Add idea",
        "submittedCount": "%{count} participant(s) have submitted",
        "startRating": "Start Rating Rounds",
        "round": "Round %{current} of %{total}",
        "pointsLabel": "Points",
        "commentPlaceholder": "Optional anonymous comment...",
        "submitRating": "Submit Rating",
        "waitingForRatings": "%{count}/%{total} rated",
        "nextRound": "Next Round",
        "finishGame": "Finish Game",
        "notEligibleToRate": "You are not participating in ratings this game.",
        "commentsHeading": "Comments",
        "confirmSubmitIdea": "Submit this idea?",
        "confirmSubmitRating": "Submit this rating?",
        "ideaIncognitoModeTitle": "Anonymous ratings",
        "ideaIncognitoModeDescription": "If enabled, ratings and comments stay anonymous. If disabled, only attributed points are given — discussion happens out loud."
      }
    }
  },
```

- [ ] **Step 3: Add `gameTypeIdeas` to `uk.json`**

Find:

```json
      "gameTypeClash": "Стінка на стінку",
      "gameTypeSoon": "Незабаром",
```

Replace with:

```json
      "gameTypeClash": "Стінка на стінку",
      "gameTypeIdeas": "Групові ідеї",
      "gameTypeSoon": "Незабаром",
```

- [ ] **Step 4: Add the `ideas` namespace to `uk.json`**

Find:

```json
        "confirmSubjectGuess": "Цей коментар про %{name}?",
        "confirmAuthorGuess": "%{name} написав(ла) цей коментар?"
      }
    }
  },
```

Replace with:

```json
        "confirmSubjectGuess": "Цей коментар про %{name}?",
        "confirmAuthorGuess": "%{name} написав(ла) цей коментар?"
      },
      "ideas": {
        "yourIdeas": "Ваші ідеї",
        "writeIdea": "Напишіть свою ідею...",
        "addIdea": "Додати ідею",
        "submittedCount": "Надіслали ідеї: %{count} учасник(ів)",
        "startRating": "Почати оцінювання",
        "round": "Раунд %{current} з %{total}",
        "pointsLabel": "Бали",
        "commentPlaceholder": "Необов'язковий анонімний коментар...",
        "submitRating": "Надіслати оцінку",
        "waitingForRatings": "Оцінили: %{count}/%{total}",
        "nextRound": "Наступний раунд",
        "finishGame": "Закінчити гру",
        "notEligibleToRate": "Ви не берете участі в оцінюванні цієї гри.",
        "commentsHeading": "Коментарі",
        "confirmSubmitIdea": "Надіслати цю ідею?",
        "confirmSubmitRating": "Надіслати цю оцінку?",
        "ideaIncognitoModeTitle": "Анонімне оцінювання",
        "ideaIncognitoModeDescription": "Якщо увімкнено, оцінки та коментарі залишаються анонімними. Якщо вимкнено, надаються лише іменні бали — обговорення відбувається усно."
      }
    }
  },
```

**Note:** `en.json`'s `confirmSubjectGuess`/`confirmAuthorGuess` block in Step 2's find-text does NOT end with a trailing comma before its closing `}` (it's the last key in the `clash` object) — this must change to end with a comma once `"ideas": {...}` is appended after it, exactly as shown in the replace-text above. Same for `uk.json` in Step 4. Verify with a JSON validator after editing (Step 5).

- [ ] **Step 5: Validate JSON syntax**

```bash
cd apps/expo && node -e "JSON.parse(require('fs').readFileSync('locales/en.json', 'utf8')); console.log('en.json OK')"
cd apps/expo && node -e "JSON.parse(require('fs').readFileSync('locales/uk.json', 'utf8')); console.log('uk.json OK')"
```

Expected: both print `OK` with no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/expo/locales/en.json apps/expo/locales/uk.json
git commit -m "Add Group Ideas locale strings to apps/expo (en + uk)"
```

---

### Task 5: `WaitingPhase.tsx` integration

**Files:**
- Modify: `apps/expo/components/game/mirror/WaitingPhase.tsx`

**Interfaces:**
- Consumes: `startIdeaGame`, `updateIdeaIncognitoMode` (Task 3); `game.ui.gameTypeIdeas`, `game.ui.ideas.ideaIncognitoModeTitle`/`Description` (Task 4).

- [ ] **Step 1: Import the two new context functions**

Find:

```typescript
  const { loading, startGame, startBasketGame, startClashGame, updateAdminWritesComments, updateShowSurnames, updateTargetSelectionMode, updateShowGuessResults, setGameType } = useGame();
```

Replace with:

```typescript
  const { loading, startGame, startBasketGame, startClashGame, startIdeaGame, updateAdminWritesComments, updateShowSurnames, updateTargetSelectionMode, updateShowGuessResults, updateIdeaIncognitoMode, setGameType } = useGame();
```

- [ ] **Step 2: Add the idea-game branch to `handleStartGame`**

Find:

```typescript
      if (game.gameType === 'basket') {
        await startBasketGame();
      } else if (game.gameType === 'clash') {
        await startClashGame();
      } else {
        await startGame();
      }
```

Replace with:

```typescript
      if (game.gameType === 'basket') {
        await startBasketGame();
      } else if (game.gameType === 'clash') {
        await startClashGame();
      } else if (game.gameType === 'ideas') {
        await startIdeaGame();
      } else {
        await startGame();
      }
```

- [ ] **Step 3: Add the `handleToggleIdeaIncognitoMode` handler**

Find:

```typescript
  const handleToggleShowGuessResults = makeSettingToggler(
    () => !(game.showGuessResults ?? false),
    updateShowGuessResults
  );
```

Replace with:

```typescript
  const handleToggleShowGuessResults = makeSettingToggler(
    () => !(game.showGuessResults ?? false),
    updateShowGuessResults
  );

  const handleToggleIdeaIncognitoMode = makeSettingToggler(
    () => !(game.ideaIncognitoMode ?? true),
    updateIdeaIncognitoMode
  );
```

- [ ] **Step 4: Add the 4th game-type button**

Find:

```typescript
              <TouchableOpacity
                style={[
                  styles.gameTypeButton,
                  game.gameType === 'clash' && styles.gameTypeButtonActive,
                ]}
                onPress={() => setGameType('clash').catch(() => {})}
                activeOpacity={0.8}
              >
                <ThemedText style={[
                  styles.gameTypeButtonText,
                  game.gameType === 'clash' && styles.gameTypeButtonTextActive,
                ]}>
                  {t('game.ui.gameTypeClash', { locale })}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
```

Replace with:

```typescript
              <TouchableOpacity
                style={[
                  styles.gameTypeButton,
                  game.gameType === 'clash' && styles.gameTypeButtonActive,
                ]}
                onPress={() => setGameType('clash').catch(() => {})}
                activeOpacity={0.8}
              >
                <ThemedText style={[
                  styles.gameTypeButtonText,
                  game.gameType === 'clash' && styles.gameTypeButtonTextActive,
                ]}>
                  {t('game.ui.gameTypeClash', { locale })}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.gameTypeButton,
                  game.gameType === 'ideas' && styles.gameTypeButtonActive,
                ]}
                onPress={() => setGameType('ideas').catch(() => {})}
                activeOpacity={0.8}
              >
                <ThemedText style={[
                  styles.gameTypeButtonText,
                  game.gameType === 'ideas' && styles.gameTypeButtonTextActive,
                ]}>
                  {t('game.ui.gameTypeIdeas', { locale })}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          {game.gameType === 'ideas' && (
            <View style={styles.toggleContainer}>
              <View style={styles.toggleInfo}>
                <ThemedText style={styles.toggleLabel}>
                  {t('game.ui.ideas.ideaIncognitoModeTitle', { locale })}
                </ThemedText>
                <ThemedText style={styles.toggleDescription}>
                  {t('game.ui.ideas.ideaIncognitoModeDescription', { locale })}
                </ThemedText>
              </View>
              <Switch
                value={game.ideaIncognitoMode ?? true}
                onValueChange={handleToggleIdeaIncognitoMode}
                trackColor={{ false: GameColors.neutral, true: GameColors.green }}
                thumbColor={GameColors.white}
                ios_backgroundColor={GameColors.neutral}
              />
            </View>
          )}
        </>
      )}
```

(This adds the incognito-mode toggle as a new block shown only when `gameType === 'ideas'`, placed right after the game-type selector's closing `</View>`, mirroring how `adminWritesComments`/other settings toggles are already structured in this file. `Switch` and `GameColors` are already imported at the top of this file.)

- [ ] **Step 5: Type-check**

```bash
cd apps/expo && npx tsc --noEmit
```

Expected: no new errors beyond the 92-error baseline.

- [ ] **Step 6: Commit**

```bash
git add apps/expo/components/game/mirror/WaitingPhase.tsx
git commit -m "Wire Group Ideas into apps/expo's WaitingPhase

4th game-type button, incognito-mode toggle (shown only when
gameType is 'ideas'), and the startIdeaGame branch in handleStartGame."
```

---

### Task 6: `IdeaWritingPhase.tsx`

**Files:**
- Create: `apps/expo/components/game/ideas/IdeaWritingPhase.tsx`
- Create: `apps/expo/__tests__/IdeaWritingPhase.test.tsx`

**Interfaces:**
- Consumes: `Game`, `Idea` (Task 2); `submitIdea`, `startIdeaRatingRounds` (Task 3); `game.ui.ideas.*` locale keys (Task 4).
- Produces: `IdeaWritingPhase` component, consumed by `IdeaScreen.tsx` (Task 8).

- [ ] **Step 1: Write `apps/expo/components/game/ideas/IdeaWritingPhase.tsx`**

Modeled on `BasketWritingPhase.tsx`'s structure and styling conventions:

```typescript
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ShowFancyAlertFn } from '@/components/game/GameHeader';
import { gameStyles } from '@/components/game/gameStyles';
import { Fonts, GameColors, themedInput } from '@/constants/theme';
import type { Game } from '@/contexts/GameContext';
import { useGame } from '@/contexts/GameContext';
import { useSound } from '@/contexts/SoundContext';
import { t } from '@/i18n';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

interface Props {
  game: Game;
  user: { uid: string } | null;
  isAdmin: boolean;
  locale: string;
  isDark: boolean;
  getDisplayName: (name: string) => string;
  showFancyAlert?: ShowFancyAlertFn;
  showFaceMessage?: (message: string, face?: string) => void;
}

export const IdeaWritingPhase: React.FC<Props> = ({
  game, user, isAdmin, locale, isDark, showFancyAlert,
}) => {
  const { submitIdea, startIdeaRatingRounds } = useGame();
  const { playSound } = useSound();
  const inputTheme = themedInput(isDark);

  const [ideaText, setIdeaText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const ideaData = game.ideaData!;
  const myIdeas = ideaData.ideas.filter(i => i.authorId === user?.uid);

  const eligibleWriterIds = (game.adminWritesComments ?? false)
    ? game.participants.map(p => p.userId)
    : game.participants.filter(p => p.userId !== game.adminId).map(p => p.userId);
  const authorIdsWithIdeas = new Set(ideaData.ideas.map(i => i.authorId));
  const submittedCount = eligibleWriterIds.filter(id => authorIdsWithIdeas.has(id)).length;
  const allSubmitted = submittedCount >= eligibleWriterIds.length;

  const confirmSubmit = () => {
    if (!ideaText.trim()) return;
    showFancyAlert?.(
      t('game.alerts.confirmTitle', { locale }),
      t('game.ui.ideas.confirmSubmitIdea', { locale }),
      [
        { text: t('common.cancel', { locale }), style: 'cancel' },
        { text: t('common.yes', { locale }), onPress: async () => { await handleSubmit(); } },
      ],
    );
  };

  const handleSubmit = async () => {
    if (!ideaText.trim() || isSubmitting) return;
    try {
      setIsSubmitting(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await submitIdea(ideaText.trim());
      setIdeaText('');
      await playSound('success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert?.(t('common.error', { locale }), (err instanceof Error && err.message) || t('common.error', { locale }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartRating = async () => {
    try {
      setIsStarting(true);
      await playSound('gameStart');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await startIdeaRatingRounds();
      await playSound('success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      await playSound('error');
      showFancyAlert?.(t('common.error', { locale }), (err instanceof Error && err.message) || t('common.error', { locale }));
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <View style={styles.phaseWrapper}>
      {myIdeas.length > 0 && (
        <View style={styles.myIdeasSection}>
          <ThemedText style={styles.myIdeasLabel}>{t('game.ui.ideas.yourIdeas', { locale })}</ThemedText>
          {myIdeas.map(idea => (
            <View key={idea.id} style={styles.ideaCard}>
              <ThemedText style={styles.ideaCardText}>{idea.text}</ThemedText>
            </View>
          ))}
        </View>
      )}

      <TextInput
        style={[styles.input, inputTheme.style]}
        value={ideaText}
        onChangeText={setIdeaText}
        placeholder={t('game.ui.ideas.writeIdea', { locale })}
        placeholderTextColor={inputTheme.placeholderTextColor}
        multiline
        numberOfLines={3}
        maxLength={500}
        textAlignVertical="top"
      />
      <ThemedText style={[styles.charCounter, ideaText.length >= 450 && styles.charCounterWarn]}>
        {ideaText.length}/500
      </ThemedText>
      <TouchableOpacity
        style={[
          styles.wideButton,
          { backgroundColor: GameColors.blue, shadowColor: GameColors.shadow },
          (!ideaText.trim() || isSubmitting) && gameStyles.buttonDisabled,
        ]}
        onPress={confirmSubmit}
        disabled={!ideaText.trim() || isSubmitting}
        activeOpacity={0.8}
        accessibilityRole="button"
      >
        {isSubmitting
          ? <ActivityIndicator size="small" color={GameColors.white} />
          : <IconSymbol name="plus.circle.fill" size={16} color={GameColors.white} />}
        <ThemedText style={styles.wideButtonText}>{t('game.ui.ideas.addIdea', { locale })}</ThemedText>
      </TouchableOpacity>

      <ThemedText style={styles.submittedCount}>
        {t('game.ui.ideas.submittedCount', { locale, count: submittedCount })}
      </ThemedText>

      {isAdmin && (
        <View style={styles.adminSection}>
          <TouchableOpacity
            style={[
              styles.wideButton,
              { backgroundColor: GameColors.admin, shadowColor: GameColors.shadow },
              (isStarting || !allSubmitted) && gameStyles.buttonDisabled,
            ]}
            onPress={handleStartRating}
            disabled={isStarting || !allSubmitted}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            {isStarting
              ? <ActivityIndicator size="small" color={GameColors.white} />
              : <IconSymbol name="star.fill" size={16} color={GameColors.white} />}
            <ThemedText style={styles.wideButtonText}>{t('game.ui.ideas.startRating', { locale })}</ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  phaseWrapper: {
    backgroundColor: 'rgba(0,122,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,122,255,0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  myIdeasSection: { marginBottom: 12, gap: 6 },
  myIdeasLabel: { fontSize: 12, opacity: 0.6, textTransform: 'uppercase', fontFamily: Fonts.sans },
  ideaCard: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: GameColors.cardBg,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2 },
      android: { elevation: 1 },
    }),
  },
  ideaCardText: { fontSize: 14, fontFamily: Fonts.sans },
  input: {
    minHeight: 90,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 4,
    borderWidth: 1,
    textAlignVertical: 'top',
    fontFamily: Fonts.sans,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  charCounter: { fontSize: 12, opacity: 0.5, textAlign: 'right', marginBottom: 8, fontFamily: Fonts.sans },
  charCounterWarn: { opacity: 1, color: '#e53935' },
  wideButton: {
    flexDirection: 'row',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: 8,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  wideButtonText: { color: GameColors.white, fontWeight: '600', fontSize: 15, fontFamily: Fonts.sans },
  submittedCount: { textAlign: 'center', fontSize: 13, opacity: 0.6, marginTop: 8, fontFamily: Fonts.sans },
  adminSection: { marginTop: 20, alignItems: 'center' },
});
```

- [ ] **Step 2: Write `apps/expo/__tests__/IdeaWritingPhase.test.tsx`**

Modeled on `BasketWritingPhase.test.tsx`'s RTL-query-by-text conventions:

```typescript
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { IdeaWritingPhase } from '../components/game/ideas/IdeaWritingPhase';

const mockSubmitIdea = jest.fn().mockResolvedValue(undefined);
const mockStartIdeaRatingRounds = jest.fn().mockResolvedValue(undefined);

jest.mock('@/contexts/GameContext', () => ({
  useGame: () => ({
    submitIdea: mockSubmitIdea,
    startIdeaRatingRounds: mockStartIdeaRatingRounds,
  }),
}));

jest.mock('@/contexts/SoundContext', () => ({
  useSound: () => ({ playSound: jest.fn().mockResolvedValue(undefined) }),
}));

const PARTICIPANTS = [
  { userId: 'admin-1', userName: 'Admin', userEmail: 'a@test.com', joinedAt: new Date() },
  { userId: 'user-2', userName: 'Bob', userEmail: 'b@test.com', joinedAt: new Date() },
  { userId: 'user-3', userName: 'Carol', userEmail: 'c@test.com', joinedAt: new Date() },
];

function baseGame(overrides: Record<string, unknown> = {}) {
  return {
    id: 'game-1', adminId: 'admin-1', adminName: 'Admin', adminEmail: 'a@test.com',
    participants: PARTICIPANTS, status: 'idea_writing', createdAt: new Date(),
    adminWritesComments: false,
    ideaData: { incognitoMode: true, ideas: [], schedule: [], currentRoundIndex: 0, currentRoundRatings: [] },
    ...overrides,
  };
}

const defaultProps = {
  user: { uid: 'user-2' },
  isAdmin: false,
  locale: 'en',
  isDark: false,
  getDisplayName: (name: string) => name,
  showFancyAlert: jest.fn((title, message, buttons) => {
    const confirmButton = buttons?.find((b: { text: string }) => b.text === 'Yes');
    confirmButton?.onPress?.();
  }),
};

beforeEach(() => {
  mockSubmitIdea.mockClear();
  mockStartIdeaRatingRounds.mockClear();
});

describe('IdeaWritingPhase', () => {
  it('renders the idea input and add button', () => {
    render(<IdeaWritingPhase game={baseGame() as any} {...defaultProps} />);
    expect(screen.getByPlaceholderText('Write your idea...')).toBeTruthy();
    expect(screen.getByText('Add idea')).toBeTruthy();
  });

  it('shows the user\'s own already-submitted ideas', () => {
    const game = baseGame({
      ideaData: {
        incognitoMode: true, schedule: [], currentRoundIndex: 0, currentRoundRatings: [],
        ideas: [{ id: 'i1', authorId: 'user-2', text: 'My first idea', submittedAt: 1 }],
      },
    });
    render(<IdeaWritingPhase game={game as any} {...defaultProps} />);
    expect(screen.getByText('My first idea')).toBeTruthy();
  });

  it('submits an idea after confirming, and clears the input', async () => {
    render(<IdeaWritingPhase game={baseGame() as any} {...defaultProps} />);
    fireEvent.changeText(screen.getByPlaceholderText('Write your idea...'), 'A new idea');
    fireEvent.press(screen.getByText('Add idea'));

    await waitFor(() => expect(mockSubmitIdea).toHaveBeenCalledWith('A new idea'));
  });

  it('does not show the Start Rating Rounds button for non-admins', () => {
    render(<IdeaWritingPhase game={baseGame() as any} {...defaultProps} isAdmin={false} />);
    expect(screen.queryByText('Start Rating Rounds')).toBeNull();
  });

  it('disables Start Rating Rounds for the admin until every eligible writer has submitted', () => {
    const game = baseGame({
      ideaData: {
        incognitoMode: true, schedule: [], currentRoundIndex: 0, currentRoundRatings: [],
        ideas: [{ id: 'i1', authorId: 'user-2', text: 'idea', submittedAt: 1 }], // user-3 hasn't submitted
      },
    });
    render(<IdeaWritingPhase game={game as any} {...defaultProps} isAdmin />);
    const button = screen.getByText('Start Rating Rounds');
    expect(button.parent?.props.accessibilityState?.disabled ?? true).toBeTruthy();
  });

  it('enables Start Rating Rounds and calls startIdeaRatingRounds once every eligible writer has submitted', async () => {
    const game = baseGame({
      ideaData: {
        incognitoMode: true, schedule: [], currentRoundIndex: 0, currentRoundRatings: [],
        ideas: [
          { id: 'i1', authorId: 'user-2', text: 'idea A', submittedAt: 1 },
          { id: 'i2', authorId: 'user-3', text: 'idea B', submittedAt: 2 },
        ],
      },
    });
    render(<IdeaWritingPhase game={game as any} {...defaultProps} isAdmin user={{ uid: 'admin-1' }} />);
    fireEvent.press(screen.getByText('Start Rating Rounds'));

    await waitFor(() => expect(mockStartIdeaRatingRounds).toHaveBeenCalled());
  });
});
```

- [ ] **Step 3: Run the test and type-check**

```bash
cd apps/expo && npx jest IdeaWritingPhase.test.tsx
cd apps/expo && npx tsc --noEmit
```

Expected: all tests pass; no new `tsc` errors. If the "disables Start Rating Rounds" test's disabled-state assertion doesn't match how `TouchableOpacity`'s `disabled` prop surfaces in this RTL setup, check how an equivalent existing test (e.g. in `BasketWritingPhase.test.tsx`) asserts a disabled button and match that pattern instead.

- [ ] **Step 4: Commit**

```bash
git add apps/expo/components/game/ideas/IdeaWritingPhase.tsx apps/expo/__tests__/IdeaWritingPhase.test.tsx
git commit -m "Add IdeaWritingPhase.tsx to apps/expo"
```

---

### Task 7: `IdeaRatingPhase.tsx`

**Files:**
- Create: `apps/expo/components/game/ideas/IdeaRatingPhase.tsx`
- Create: `apps/expo/__tests__/IdeaRatingPhase.test.tsx`

**Interfaces:**
- Consumes: `Game`, `Idea`, `IdeaRating` (Task 2); `submitIdeaRating`, `startNextIdeaRound` (Task 3); `game.ui.ideas.*` locale keys (Task 4).
- Produces: `IdeaRatingPhase` component, consumed by `IdeaScreen.tsx` (Task 8).

- [ ] **Step 1: Write `apps/expo/components/game/ideas/IdeaRatingPhase.tsx`**

Modeled on `BasketGuessingPhase.tsx`'s structure, with the per-idea 0–5 point-selector row from the design spec, the eligibility gate, and the unattributed-comments display (both fixes from `apps/web`'s final review, included as part of the baseline here, not added later):

```typescript
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ShowFancyAlertFn } from '@/components/game/GameHeader';
import { gameStyles } from '@/components/game/gameStyles';
import { Fonts, GameColors, StatusColors, themedInput } from '@/constants/theme';
import type { Game, Idea } from '@/contexts/GameContext';
import { useGame } from '@/contexts/GameContext';
import { useSound } from '@/contexts/SoundContext';
import { t } from '@/i18n';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

interface Props {
  game: Game;
  user: { uid: string } | null;
  isAdmin: boolean;
  locale: string;
  isDark: boolean;
  getDisplayName: (name: string) => string;
  showFancyAlert?: ShowFancyAlertFn;
  showFaceMessage?: (message: string, face?: string) => void;
}

export const IdeaRatingPhase: React.FC<Props> = ({
  game, user, isAdmin, locale, isDark, showFancyAlert,
}) => {
  const { submitIdeaRating, startNextIdeaRound } = useGame();
  const { playSound } = useSound();
  const inputTheme = themedInput(isDark);

  const [selectedPoints, setSelectedPoints] = useState<Record<string, number>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [submittingIdeaId, setSubmittingIdeaId] = useState<string | null>(null);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const ideaData = game.ideaData!;
  const { schedule, currentRoundIndex, currentRoundRatings, incognitoMode, ideas } = ideaData;
  const isLastRound = currentRoundIndex + 1 >= schedule.length;
  const currentAuthorId = schedule[currentRoundIndex];
  const currentIdeas = ideas.filter((i: Idea) => i.authorId === currentAuthorId);

  const raterId = user?.uid ?? '';
  const myRatingsThisRound = new Set(
    currentRoundRatings.filter(r => r.raterId === raterId).map(r => r.ideaId),
  );

  const eligibleRaterIds = (game.adminWritesComments ?? false)
    ? game.participants.map(p => p.userId)
    : game.participants.filter(p => p.userId !== game.adminId).map(p => p.userId);
  const isEligible = eligibleRaterIds.includes(raterId);
  const allRatersDone = eligibleRaterIds.every(id => {
    const ratedIdeaIds = new Set(currentRoundRatings.filter(r => r.raterId === id).map(r => r.ideaId));
    return currentIdeas.every(idea => ratedIdeaIds.has(idea.id));
  });

  const confirmSubmitRating = (ideaId: string) => {
    const points = selectedPoints[ideaId];
    if (points === undefined) return;
    showFancyAlert?.(
      t('game.alerts.confirmTitle', { locale }),
      t('game.ui.ideas.confirmSubmitRating', { locale }),
      [
        { text: t('common.cancel', { locale }), style: 'cancel' },
        { text: t('common.yes', { locale }), onPress: async () => { await handleSubmitRating(ideaId, points); } },
      ],
    );
  };

  const handleSubmitRating = async (ideaId: string, points: number) => {
    try {
      setSubmittingIdeaId(ideaId);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await submitIdeaRating(ideaId, points, commentDrafts[ideaId]);
      await playSound('points');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      await playSound('error');
      showFancyAlert?.(t('common.error', { locale }), (err instanceof Error && err.message) || t('common.error', { locale }));
    } finally {
      setSubmittingIdeaId(null);
    }
  };

  const handleNextRound = async () => {
    if (isAdvancing) return;
    try {
      setIsAdvancing(true);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await startNextIdeaRound();
      await playSound(isLastRound ? 'gameOver' : 'roundComplete');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: unknown) {
      playSound('error').catch(() => {});
      showFancyAlert?.(t('common.error', { locale }), (err instanceof Error && err.message) || t('common.error', { locale }));
    } finally {
      setIsAdvancing(false);
    }
  };

  return (
    <View style={styles.phaseWrapper}>
      <View style={styles.statusRow}>
        <ThemedText style={gameStyles.statusLabel}>{t('game.ui.statusLabel', { locale })}</ThemedText>
        <View style={[gameStyles.statusBadge, { backgroundColor: StatusColors.guessing_phase }]}>
          <ThemedText style={gameStyles.statusText}>
            {t('game.ui.ideas.round', { locale, current: currentRoundIndex + 1, total: schedule.length })}
          </ThemedText>
        </View>
      </View>

      {currentIdeas.map(idea => {
        const alreadyRated = myRatingsThisRound.has(idea.id);
        const comments = incognitoMode
          ? currentRoundRatings.filter(r => r.ideaId === idea.id && r.comment)
          : [];
        return (
          <View key={idea.id} style={styles.ideaCard}>
            <ThemedText style={styles.ideaText}>{idea.text}</ThemedText>

            {alreadyRated ? (
              <ThemedText style={styles.waitingText}>
                {t('game.ui.ideas.waitingForRatings', {
                  locale,
                  count: currentRoundRatings.filter(r => r.ideaId === idea.id).length,
                  total: eligibleRaterIds.length,
                })}
              </ThemedText>
            ) : isEligible ? (
              <>
                <ThemedText style={styles.pointsLabel}>{t('game.ui.ideas.pointsLabel', { locale })}</ThemedText>
                <View style={styles.pointsRow}>
                  {[0, 1, 2, 3, 4, 5].map(points => (
                    <TouchableOpacity
                      key={points}
                      style={[
                        styles.pointButton,
                        selectedPoints[idea.id] === points && styles.pointButtonSelected,
                      ]}
                      onPress={() => setSelectedPoints(prev => ({ ...prev, [idea.id]: points }))}
                      disabled={submittingIdeaId === idea.id}
                      activeOpacity={0.8}
                    >
                      <ThemedText style={[
                        styles.pointButtonText,
                        selectedPoints[idea.id] === points && styles.pointButtonTextSelected,
                      ]}>
                        {points}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
                {incognitoMode && (
                  <TextInput
                    style={[styles.commentInput, inputTheme.style]}
                    value={commentDrafts[idea.id] ?? ''}
                    onChangeText={text => setCommentDrafts(prev => ({ ...prev, [idea.id]: text }))}
                    placeholder={t('game.ui.ideas.commentPlaceholder', { locale })}
                    placeholderTextColor={inputTheme.placeholderTextColor}
                    multiline
                    numberOfLines={2}
                    maxLength={500}
                  />
                )}
                <TouchableOpacity
                  style={[
                    styles.wideButton,
                    { backgroundColor: GameColors.purple, shadowColor: GameColors.shadow },
                    (selectedPoints[idea.id] === undefined || submittingIdeaId === idea.id) && gameStyles.buttonDisabled,
                  ]}
                  onPress={() => confirmSubmitRating(idea.id)}
                  disabled={selectedPoints[idea.id] === undefined || submittingIdeaId === idea.id}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                >
                  {submittingIdeaId === idea.id
                    ? <ActivityIndicator size="small" color={GameColors.white} />
                    : <IconSymbol name="checkmark.circle.fill" size={16} color={GameColors.white} />}
                  <ThemedText style={styles.wideButtonText}>{t('game.ui.ideas.submitRating', { locale })}</ThemedText>
                </TouchableOpacity>
              </>
            ) : (
              <ThemedText style={styles.notEligibleText}>{t('game.ui.ideas.notEligibleToRate', { locale })}</ThemedText>
            )}

            {comments.length > 0 && (
              <View style={styles.commentsSection}>
                <ThemedText style={styles.commentsHeading}>{t('game.ui.ideas.commentsHeading', { locale })}</ThemedText>
                {comments.map((r, i) => (
                  <ThemedText key={i} style={styles.commentItem}>&ldquo;{r.comment}&rdquo;</ThemedText>
                ))}
              </View>
            )}
          </View>
        );
      })}

      {isAdmin && (
        <View style={styles.adminSection}>
          {isLastRound && (
            <ThemedText style={styles.finishLabel}>{t('game.ui.ideas.finishGame', { locale })}</ThemedText>
          )}
          <TouchableOpacity
            style={[
              styles.wideButton,
              { backgroundColor: isLastRound ? GameColors.green : GameColors.blue, shadowColor: GameColors.shadow },
              (isAdvancing || !allRatersDone) && gameStyles.buttonDisabled,
            ]}
            onPress={handleNextRound}
            disabled={isAdvancing || !allRatersDone}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            {isAdvancing
              ? <ActivityIndicator size="small" color={GameColors.white} />
              : <IconSymbol name={isLastRound ? 'flag.checkered' : 'forward.end.fill'} size={16} color={GameColors.white} />}
            <ThemedText style={styles.wideButtonText}>{t('game.ui.ideas.nextRound', { locale })}</ThemedText>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  phaseWrapper: {
    backgroundColor: 'rgba(175,82,222,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(175,82,222,0.15)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 8,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  ideaCard: {
    padding: 14,
    borderRadius: 8,
    backgroundColor: GameColors.cardBg,
    borderWidth: 1,
    borderColor: GameColors.cardBorder,
    marginBottom: 12,
    gap: 8,
    ...Platform.select({
      ios: { shadowColor: GameColors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  ideaText: { fontSize: 16, lineHeight: 22, fontFamily: Fonts.sans },
  waitingText: { fontSize: 14, color: GameColors.green, fontWeight: '600', fontFamily: Fonts.sans },
  notEligibleText: { fontSize: 13, opacity: 0.6, fontStyle: 'italic', fontFamily: Fonts.sans },
  pointsLabel: { fontSize: 12, opacity: 0.6, fontFamily: Fonts.sans },
  pointsRow: { flexDirection: 'row', gap: 8 },
  pointButton: {
    width: 40, height: 40, borderRadius: 20,
    borderWidth: 2, borderColor: GameColors.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  pointButtonSelected: { backgroundColor: GameColors.blue, borderColor: GameColors.blue },
  pointButtonText: { fontSize: 15, fontWeight: '600', fontFamily: Fonts.sans },
  pointButtonTextSelected: { color: GameColors.white },
  commentInput: {
    minHeight: 60, borderRadius: 8, padding: 10, fontSize: 14,
    borderWidth: 1, textAlignVertical: 'top', fontFamily: Fonts.sans,
  },
  wideButton: {
    flexDirection: 'row', borderRadius: 999, paddingVertical: 12, paddingHorizontal: 20,
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center', gap: 8,
    ...Platform.select({
      ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 4 },
    }),
  },
  wideButtonText: { color: GameColors.white, fontWeight: '600', fontSize: 14, fontFamily: Fonts.sans },
  commentsSection: { marginTop: 4, gap: 2 },
  commentsHeading: { fontSize: 11, opacity: 0.5, fontFamily: Fonts.sans },
  commentItem: { fontSize: 13, opacity: 0.75, fontStyle: 'italic', fontFamily: Fonts.sans },
  adminSection: { marginTop: 8, alignItems: 'center', gap: 6 },
  finishLabel: { fontSize: 13, color: GameColors.green, fontWeight: '600', opacity: 0.85, fontFamily: Fonts.sans },
});
```

- [ ] **Step 2: Write `apps/expo/__tests__/IdeaRatingPhase.test.tsx`**

```typescript
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { IdeaRatingPhase } from '../components/game/ideas/IdeaRatingPhase';

const mockSubmitIdeaRating = jest.fn().mockResolvedValue(undefined);
const mockStartNextIdeaRound = jest.fn().mockResolvedValue(undefined);

jest.mock('@/contexts/GameContext', () => ({
  useGame: () => ({
    submitIdeaRating: mockSubmitIdeaRating,
    startNextIdeaRound: mockStartNextIdeaRound,
  }),
}));

jest.mock('@/contexts/SoundContext', () => ({
  useSound: () => ({ playSound: jest.fn().mockResolvedValue(undefined) }),
}));

const PARTICIPANTS = [
  { userId: 'admin-1', userName: 'Admin', userEmail: 'a@test.com', joinedAt: new Date() },
  { userId: 'user-2', userName: 'Bob', userEmail: 'b@test.com', joinedAt: new Date() },
  { userId: 'user-3', userName: 'Carol', userEmail: 'c@test.com', joinedAt: new Date() },
];

function baseGame(overrides: Record<string, unknown> = {}) {
  return {
    id: 'game-1', adminId: 'admin-1', adminName: 'Admin', adminEmail: 'a@test.com',
    participants: PARTICIPANTS, status: 'idea_rating', createdAt: new Date(),
    adminWritesComments: false,
    ideaData: {
      incognitoMode: true,
      ideas: [{ id: 'i1', authorId: 'user-3', text: 'The current round idea', submittedAt: 1 }],
      schedule: ['user-3', 'user-2'], currentRoundIndex: 0, currentRoundRatings: [],
    },
    ...overrides,
  };
}

const defaultProps = {
  isAdmin: false,
  locale: 'en',
  isDark: false,
  getDisplayName: (name: string) => name,
  showFancyAlert: jest.fn((title, message, buttons) => {
    const confirmButton = buttons?.find((b: { text: string }) => b.text === 'Yes');
    confirmButton?.onPress?.();
  }),
};

beforeEach(() => {
  mockSubmitIdeaRating.mockClear();
  mockStartNextIdeaRound.mockClear();
});

describe('IdeaRatingPhase', () => {
  it('renders the current round\'s idea and point buttons for an eligible rater', () => {
    render(<IdeaRatingPhase game={baseGame() as any} {...defaultProps} user={{ uid: 'user-2' }} />);
    expect(screen.getByText('The current round idea')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
  });

  it('shows the idea to its own author too, without singling them out', () => {
    // user-3 is the current round's author — should see the same rating UI as anyone else.
    render(<IdeaRatingPhase game={baseGame() as any} {...defaultProps} user={{ uid: 'user-3' }} />);
    expect(screen.getByText('The current round idea')).toBeTruthy();
    expect(screen.getByText('Submit Rating')).toBeTruthy();
  });

  it('hides rating controls for a non-eligible viewer (e.g. admin with adminWritesComments off)', () => {
    render(<IdeaRatingPhase game={baseGame() as any} {...defaultProps} user={{ uid: 'admin-1' }} isAdmin />);
    expect(screen.queryByText('Submit Rating')).toBeNull();
    expect(screen.getByText('You are not participating in ratings this game.')).toBeTruthy();
  });

  it('submits a rating with the selected points after confirming', async () => {
    render(<IdeaRatingPhase game={baseGame() as any} {...defaultProps} user={{ uid: 'user-2' }} />);
    fireEvent.press(screen.getByText('4'));
    fireEvent.press(screen.getByText('Submit Rating'));

    await waitFor(() => expect(mockSubmitIdeaRating).toHaveBeenCalledWith('i1', 4, undefined));
  });

  it('shows the comment textarea only in incognito mode', () => {
    const openGame = baseGame({ ideaData: { ...baseGame().ideaData, incognitoMode: false } });
    render(<IdeaRatingPhase game={openGame as any} {...defaultProps} user={{ uid: 'user-2' }} />);
    expect(screen.queryByPlaceholderText('Optional anonymous comment...')).toBeNull();
  });

  it('shows unattributed comments from ratings already submitted this round', () => {
    const game = baseGame({
      ideaData: {
        ...baseGame().ideaData,
        currentRoundRatings: [{ raterId: 'user-2', ideaId: 'i1', points: 5, comment: 'Great idea!' }],
      },
    });
    render(<IdeaRatingPhase game={game as any} {...defaultProps} user={{ uid: 'admin-1' }} isAdmin />);
    expect(screen.getByText('"Great idea!"')).toBeTruthy();
  });

  it('disables Next Round for the admin until every eligible rater has rated every idea', () => {
    render(<IdeaRatingPhase game={baseGame() as any} {...defaultProps} user={{ uid: 'admin-1' }} isAdmin />);
    const button = screen.getByText('Next Round');
    expect(button.parent?.props.accessibilityState?.disabled ?? true).toBeTruthy();
  });

  it('calls startNextIdeaRound once every eligible rater has rated', async () => {
    const game = baseGame({
      ideaData: {
        ...baseGame().ideaData,
        currentRoundRatings: [
          { raterId: 'user-2', ideaId: 'i1', points: 5 },
          { raterId: 'user-3', ideaId: 'i1', points: 4 },
        ],
      },
    });
    render(<IdeaRatingPhase game={game as any} {...defaultProps} user={{ uid: 'admin-1' }} isAdmin />);
    fireEvent.press(screen.getByText('Next Round'));

    await waitFor(() => expect(mockStartNextIdeaRound).toHaveBeenCalled());
  });
});
```

- [ ] **Step 3: Run the test and type-check**

```bash
cd apps/expo && npx jest IdeaRatingPhase.test.tsx
cd apps/expo && npx tsc --noEmit
```

Expected: all tests pass; no new `tsc` errors.

- [ ] **Step 4: Commit**

```bash
git add apps/expo/components/game/ideas/IdeaRatingPhase.tsx apps/expo/__tests__/IdeaRatingPhase.test.tsx
git commit -m "Add IdeaRatingPhase.tsx to apps/expo

Includes both fixes from apps/web's final security review as part of
the baseline (not added later): the eligibility guard hiding rating
controls from non-eligible viewers, and the unattributed-comments
display."
```

---

### Task 8: `IdeaScreen.tsx` + `GameScreen.tsx` routing + status colors

**Files:**
- Create: `apps/expo/components/game/ideas/IdeaScreen.tsx`
- Modify: `apps/expo/components/game/GameScreen.tsx`
- Modify: `apps/expo/constants/theme.ts`

**Interfaces:**
- Consumes: `IdeaWritingPhase` (Task 6), `IdeaRatingPhase` (Task 7).
- Produces: `IdeaScreen`, routed by `GameScreen.tsx` — the final integration point making the mode reachable in the app.

- [ ] **Step 1: Write `apps/expo/components/game/ideas/IdeaScreen.tsx`**

Matching `BasketScreen.tsx`'s exact router structure:

```typescript
import type { Game } from '@/contexts/GameContext';
import React from 'react';
import { IdeaRatingPhase } from './IdeaRatingPhase';
import { IdeaWritingPhase } from './IdeaWritingPhase';

interface Props {
  game: Game;
  user: { uid: string } | null;
  isAdmin: boolean;
  locale: string;
  isDark: boolean;
  getDisplayName: (name: string) => string;
  showFancyAlert: (title: string, message?: string | null, buttons?: any[], customContent?: React.ReactNode) => void;
  showFaceMessage: (message: string, face?: React.ReactNode) => void;
}

export const IdeaScreen: React.FC<Props> = (props) => {
  const { game } = props;
  if (game.status === 'idea_writing') return <IdeaWritingPhase {...props} />;
  if (game.status === 'idea_rating') return <IdeaRatingPhase {...props} />;
  return null;
};
```

- [ ] **Step 2: Add the `idea_writing`/`idea_rating` StatusColors entries**

In `apps/expo/constants/theme.ts`, find:

```typescript
export const StatusColors: Record<string, string> = {
  waiting: '#FF9500',
  active: '#34C759',
  guessing_phase: '#AF52DE',
  finished: '#8E8E93',
  basket_writing: '#007AFF',
  basket_guessing: '#AF52DE',
  clash_writing: '#FF7800',
  clash_guessing: '#FF5000',
};
```

Replace with:

```typescript
export const StatusColors: Record<string, string> = {
  waiting: '#FF9500',
  active: '#34C759',
  guessing_phase: '#AF52DE',
  finished: '#8E8E93',
  basket_writing: '#007AFF',
  basket_guessing: '#AF52DE',
  clash_writing: '#FF7800',
  clash_guessing: '#FF5000',
  idea_writing: '#007AFF',
  idea_rating: '#AF52DE',
};
```

(Reusing the same two colors `basket_writing`/`basket_guessing` already use, matching the apps/web equivalent's own choice — no new color introduced.)

- [ ] **Step 3: Wire `IdeaScreen` into `GameScreen.tsx`**

Find:

```typescript
import { BasketScreen } from '@/components/game/basket/BasketScreen';
import { ClashScreen } from '@/components/game/clash/ClashScreen';
```

Replace with:

```typescript
import { BasketScreen } from '@/components/game/basket/BasketScreen';
import { ClashScreen } from '@/components/game/clash/ClashScreen';
import { IdeaScreen } from '@/components/game/ideas/IdeaScreen';
```

Find:

```typescript
                {(currentGame.status === 'clash_writing' || currentGame.status === 'clash_guessing') && (
                  <ClashScreen
                    game={currentGame}
                    user={user}
                    isAdmin={isAdmin}
                    locale={locale}
                    isDark={isDark}
                    getDisplayName={getDisplayName}
                    showFancyAlert={showFancyAlert}
                    showFaceMessage={showFaceMessage}
                  />
                )}

                {currentGame.status === 'active' && currentGame.currentRound && (
```

Replace with:

```typescript
                {(currentGame.status === 'clash_writing' || currentGame.status === 'clash_guessing') && (
                  <ClashScreen
                    game={currentGame}
                    user={user}
                    isAdmin={isAdmin}
                    locale={locale}
                    isDark={isDark}
                    getDisplayName={getDisplayName}
                    showFancyAlert={showFancyAlert}
                    showFaceMessage={showFaceMessage}
                  />
                )}

                {(currentGame.status === 'idea_writing' || currentGame.status === 'idea_rating') && (
                  <IdeaScreen
                    game={currentGame}
                    user={user}
                    isAdmin={isAdmin}
                    locale={locale}
                    isDark={isDark}
                    getDisplayName={getDisplayName}
                    showFancyAlert={showFancyAlert}
                    showFaceMessage={showFaceMessage}
                  />
                )}

                {currentGame.status === 'active' && currentGame.currentRound && (
```

- [ ] **Step 4: Type-check**

```bash
cd apps/expo && npx tsc --noEmit
```

Expected: no new errors beyond the 92-error baseline.

- [ ] **Step 5: Run the full test suite**

```bash
cd apps/expo && npx jest
```

Expected: all tests pass, including every test added in Tasks 2/3/6/7, and no regressions in the existing 52+ test files.

- [ ] **Step 6: Commit**

```bash
git add apps/expo/components/game/ideas/IdeaScreen.tsx apps/expo/components/game/GameScreen.tsx apps/expo/constants/theme.ts
git commit -m "Route Group Ideas into apps/expo's GameScreen

Final integration step — IdeaScreen.tsx router, GameScreen.tsx branch
matching basket/clash's shape, and StatusColors entries for
idea_writing/idea_rating. Group Ideas is now fully reachable in
apps/expo."
```

---

## Out of Scope (matches the design spec)

- Any redesign of game mechanics, data model, or scoring.
- Adopting `@mirror/shared` for Group Ideas or any other mode.
- Any change to `apps/web`'s implementation.
- E2E/integration testing beyond Jest.
