# Head-to-Head Clash Game Mechanics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the full Head-to-Head Clash (Стінка на стінку) game mode — group setup with drag-and-drop, writing phase, and leader-based guessing phase with team scoring.

**Architecture:** Follows the established Basket game pattern: new `clashData` field on the Game document, seven new GameContext methods, and four new UI components under `components/game/clash/`. Group setup happens inside the `waiting` status (no extra status). Drag-and-drop uses React Native `PanResponder` + `Animated` from the RN core — no new libraries.

**Tech Stack:** Expo React Native, Firebase Firestore (arrayUnion + updateDoc), React Context, react-native-gesture-handler (already installed), TypeScript strict, i18n-js (`%{var}` interpolation), Jest + RNTL

---

### Task 1: Schedule utility — `utils/clashSchedule.ts`

**Files:**
- Create: `utils/clashSchedule.ts`
- Create: `__tests__/clashSchedule.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/clashSchedule.test.ts
import { generateClashSchedule } from '../utils/clashSchedule';

describe('generateClashSchedule', () => {
  it('returns empty array for empty groups', () => {
    expect(generateClashSchedule([], [])).toEqual([]);
  });

  it('returns N rounds for N members per group', () => {
    const rounds = generateClashSchedule(['a1','a2','a3'], ['b1','b2','b3']);
    expect(rounds).toHaveLength(3);
  });

  it('every round contains all A members as writers in assignmentsA', () => {
    const groupA = ['a1','a2','a3'];
    const rounds = generateClashSchedule(groupA, ['b1','b2','b3']);
    for (const round of rounds) {
      expect(round.assignmentsA.map(a => a.writerId).sort()).toEqual(['a1','a2','a3']);
    }
  });

  it('every round contains all B members as writers in assignmentsB', () => {
    const groupB = ['b1','b2','b3'];
    const rounds = generateClashSchedule(['a1','a2','a3'], groupB);
    for (const round of rounds) {
      expect(round.assignmentsB.map(a => a.writerId).sort()).toEqual(['b1','b2','b3']);
    }
  });

  it('each A member writes about every B member exactly once across all rounds', () => {
    const groupA = ['a1','a2'];
    const groupB = ['b1','b2'];
    const rounds = generateClashSchedule(groupA, groupB);
    for (const writer of groupA) {
      const subjects = rounds.map(r => r.assignmentsA.find(a => a.writerId === writer)!.subjectId);
      expect(subjects.sort()).toEqual(['b1','b2']);
    }
  });

  it('each B member writes about every A member exactly once across all rounds', () => {
    const groupA = ['a1','a2'];
    const groupB = ['b1','b2'];
    const rounds = generateClashSchedule(groupA, groupB);
    for (const writer of groupB) {
      const subjects = rounds.map(r => r.assignmentsB.find(a => a.writerId === writer)!.subjectId);
      expect(subjects.sort()).toEqual(['a1','a2']);
    }
  });

  it('no assignment has writerId === subjectId', () => {
    const rounds = generateClashSchedule(['a1','a2','a3'], ['b1','b2','b3']);
    for (const round of rounds) {
      for (const a of [...round.assignmentsA, ...round.assignmentsB]) {
        expect(a.writerId).not.toBe(a.subjectId);
      }
    }
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- __tests__/clashSchedule.test.ts --no-coverage
```
Expected: FAIL — "Cannot find module '../utils/clashSchedule'"

- [ ] **Step 3: Implement `utils/clashSchedule.ts`**

```typescript
// utils/clashSchedule.ts
export interface ClashAssignment {
  writerId: string;
  subjectId: string;
}

export interface ClashRound {
  assignmentsA: ClashAssignment[]; // Group A member → Group B subject
  assignmentsB: ClashAssignment[]; // Group B member → Group A subject
}

export function generateClashSchedule(groupA: string[], groupB: string[]): ClashRound[] {
  const n = groupA.length;
  if (n === 0) return [];
  const rounds: ClashRound[] = [];
  for (let r = 0; r < n; r++) {
    const assignmentsA: ClashAssignment[] = groupA.map((writerId, i) => ({
      writerId,
      subjectId: groupB[(i + r) % n],
    }));
    const assignmentsB: ClashAssignment[] = groupB.map((writerId, j) => ({
      writerId,
      subjectId: groupA[(j + r) % n],
    }));
    rounds.push({ assignmentsA, assignmentsB });
  }
  return rounds;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test -- __tests__/clashSchedule.test.ts --no-coverage
```
Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add utils/clashSchedule.ts __tests__/clashSchedule.test.ts
git commit -m "feat: add generateClashSchedule utility with tests"
```

---

### Task 2: Types, theme colors, and i18n keys

**Files:**
- Modify: `contexts/GameContext.tsx` (interfaces + GameContextType + status union + gameType union)
- Modify: `constants/theme.ts`
- Modify: `locales/en.json`
- Modify: `locales/uk.json`

- [ ] **Step 1: Add clash interfaces and extend Game/GameContextType in `contexts/GameContext.tsx`**

At line 5, add the import for clashSchedule types:
```typescript
import { ClashAssignment, ClashRound, generateClashSchedule } from '@/utils/clashSchedule';
```

After the `BasketData` interface block (after line 149), add:
```typescript
export interface ClashGroup {
  leaderId: string;
  memberIds: string[]; // includes leaderId
}

export interface ClashComment {
  writerId: string;
  subjectId: string;
  text: string;
  submittedAt: number;
}

export interface ClashGuess {
  commentWriterId: string;
  guessedSubjectId: string;
  subjectCorrect: boolean;
  guessedAuthorId?: string;
  authorCorrect?: boolean;
  pointsAwarded: number;
}

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

Extend the `Game` interface status union (line 35):
```typescript
status: "waiting" | "active" | "guessing_phase" | "finished" | "basket_writing" | "basket_guessing" | "clash_writing" | "clash_guessing";
```

Extend the `gameType` field (line 67):
```typescript
gameType?: 'mirror' | 'basket' | 'clash';
```

Add `clashData` field after `basketData` (line 68):
```typescript
clashData?: ClashData;
```

Extend `GameContextType` — replace the `setGameType` line (line 192) with:
```typescript
setGameType: (type: 'mirror' | 'basket' | 'clash') => Promise<void>;
```

After `startNextBasketRound: () => Promise<void>;` (line 198), add:
```typescript
saveClashGroups: (groupA: ClashGroup, groupB: ClashGroup) => Promise<void>;
startClashGame: () => Promise<void>;
submitClashComment: (text: string) => Promise<void>;
revealClashComments: () => Promise<void>;
submitClashGuess: (commentWriterId: string, guessedSubjectId: string) => Promise<void>;
submitClashAuthorGuess: (commentWriterId: string, guessedAuthorId: string) => Promise<void>;
advanceClashGuessing: () => Promise<void>;
```

- [ ] **Step 2: Extend `setGameType` in GameContext.tsx**

Find the `setGameType` function (around line 1724) and update its signature:
```typescript
const setGameType = async (type: 'mirror' | 'basket' | 'clash'): Promise<void> => {
  if (!currentGame) return;
  const gameRef = doc(db, 'games', currentGame.id);
  await updateDoc(gameRef, { gameType: type });
};
```

- [ ] **Step 3: Add clash colors to `constants/theme.ts`**

In `StatusColors` (after `basket_guessing: '#AF52DE'`):
```typescript
clash_writing: '#FF7800',
clash_guessing: '#FF5000',
```

In `GameColors` (after `basketGuessingTintBorder`):
```typescript
clashWritingTint: 'rgba(255,120,0,0.06)',
clashWritingTintBorder: 'rgba(255,120,0,0.15)',
clashGuessingTint: 'rgba(255,80,0,0.06)',
clashGuessingTintBorder: 'rgba(255,80,0,0.15)',
```

- [ ] **Step 4: Add i18n keys to `locales/en.json`**

After the `"basket": { ... }` block (before the closing `}` of `game.ui`), add:
```json
"clash": {
  "round": "Round %{current} of %{total}",
  "groupA": "Group A",
  "groupB": "Group B",
  "leader": "Leader",
  "assignLeader": "Tap to set as leader",
  "unassigned": "Unassigned",
  "startGame": "Start Game",
  "equalSizeWarning": "Both groups must have the same number of players",
  "yourSubject": "Write about:",
  "writeComment": "Write your comment...",
  "submit": "Submit",
  "waitingForGroup": "Group A: %{a}/%{n} · Group B: %{b}/%{n}",
  "revealComments": "Reveal Comments",
  "leaderGuessing": "%{name} is guessing…",
  "whichMember": "Which group member is this about?",
  "whoWroteIt": "Who wrote it?",
  "correct": "Correct! +1 point",
  "correctAuthor": "Right author! +1 point",
  "wrong": "Not quite.",
  "teamScore": "Group A: %{a} pts · Group B: %{b} pts",
  "nextLeader": "Next Leader",
  "nextRound": "Next Round",
  "finishGame": "Finish Game",
  "waitingForLeader": "Waiting for leader to guess…"
}
```

- [ ] **Step 5: Add i18n keys to `locales/uk.json`** (same location, after `"basket": { ... }`):

```json
"clash": {
  "round": "Раунд %{current} з %{total}",
  "groupA": "Команда А",
  "groupB": "Команда Б",
  "leader": "Капітан",
  "assignLeader": "Натисніть, щоб призначити капітаном",
  "unassigned": "Не призначено",
  "startGame": "Почати гру",
  "equalSizeWarning": "Обидві команди повинні мати однакову кількість гравців",
  "yourSubject": "Написати про:",
  "writeComment": "Ваш коментар...",
  "submit": "Надіслати",
  "waitingForGroup": "Команда А: %{a}/%{n} · Команда Б: %{b}/%{n}",
  "revealComments": "Показати коментарі",
  "leaderGuessing": "%{name} відгадує…",
  "whichMember": "Про кого з команди цей коментар?",
  "whoWroteIt": "Хто це написав?",
  "correct": "Правильно! +1 бал",
  "correctAuthor": "Автор вгаданий! +1 бал",
  "wrong": "Не вгадали.",
  "teamScore": "Команда А: %{a} б · Команда Б: %{b} б",
  "nextLeader": "Наступний капітан",
  "nextRound": "Наступний раунд",
  "finishGame": "Закінчити гру",
  "waitingForLeader": "Очікування вгадування капітана…"
}
```

- [ ] **Step 6: Commit**

```bash
git add contexts/GameContext.tsx constants/theme.ts locales/en.json locales/uk.json utils/clashSchedule.ts
git commit -m "feat: add clash types, theme colors, and i18n keys"
```

---

### Task 3: GameContext — 7 new clash methods

**Files:**
- Modify: `contexts/GameContext.tsx` (add 7 methods + export in value)

All 7 methods go after `startNextBasketRound` (around line 1722), before `setGameType`.

- [ ] **Step 1: Add `saveClashGroups`**

```typescript
const saveClashGroups = async (groupA: ClashGroup, groupB: ClashGroup): Promise<void> => {
  if (!auth.currentUser) throw new Error("You must be signed in");
  if (!currentGame || auth.currentUser.uid !== currentGame.adminId) {
    throw new Error("Only the admin can set up groups");
  }
  if (groupA.memberIds.length !== groupB.memberIds.length) {
    throw new Error("Both groups must have the same number of players");
  }
  if (groupA.memberIds.length === 0) throw new Error("Groups cannot be empty");
  if (!groupA.memberIds.includes(groupA.leaderId)) throw new Error("Group A leader must be a group member");
  if (!groupB.memberIds.includes(groupB.leaderId)) throw new Error("Group B leader must be a group member");
  const overlap = groupA.memberIds.filter(id => groupB.memberIds.includes(id));
  if (overlap.length > 0) throw new Error("Groups cannot share members");
  try {
    setLoading(true);
    const gameRef = doc(db, 'games', currentGame.id);
    await updateDoc(gameRef, { 'clashData.groupA': groupA, 'clashData.groupB': groupB });
  } catch (err) {
    console.error('Error saving clash groups:', err);
    throw err;
  } finally {
    setLoading(false);
  }
};
```

- [ ] **Step 2: Add `startClashGame`**

```typescript
const startClashGame = async (): Promise<void> => {
  if (!auth.currentUser) throw new Error("You must be signed in");
  if (!currentGame || auth.currentUser.uid !== currentGame.adminId) {
    throw new Error("Only the admin can start the game");
  }
  const cd = currentGame.clashData;
  if (!cd?.groupA || !cd?.groupB) throw new Error("Groups not set up");
  if (cd.groupA.memberIds.length !== cd.groupB.memberIds.length) {
    throw new Error("Both groups must have the same number of players");
  }
  if (cd.groupA.memberIds.length < 2) throw new Error("Each group must have at least 2 players");
  try {
    setLoading(true);
    const gameRef = doc(db, 'games', currentGame.id);
    const schedule = generateClashSchedule(cd.groupA.memberIds, cd.groupB.memberIds);
    await updateDoc(gameRef, {
      status: 'clash_writing',
      clashData: {
        ...cd,
        schedule,
        currentRoundIndex: 0,
        currentRoundCommentsA: [],
        currentRoundCommentsB: [],
        lastGroupToFinish: null,
        currentGuessingGroup: null,
        currentRoundGuessesA: [],
        currentRoundGuessesB: [],
        teamScores: { a: 0, b: 0 },
      },
    });
  } catch (err) {
    console.error('Error starting clash game:', err);
    throw err;
  } finally {
    setLoading(false);
  }
};
```

- [ ] **Step 3: Add `submitClashComment`**

```typescript
const submitClashComment = async (text: string): Promise<void> => {
  if (!auth.currentUser) throw new Error("You must be signed in");
  const cd = currentGame?.clashData;
  if (!cd) throw new Error("No active clash game");
  if (!text.trim()) throw new Error("Comment cannot be empty");
  const uid = auth.currentUser.uid;
  const isGroupA = cd.groupA.memberIds.includes(uid);
  const isGroupB = cd.groupB.memberIds.includes(uid);
  if (!isGroupA && !isGroupB) throw new Error("Player not in any group");
  const assignments = isGroupA
    ? cd.schedule[cd.currentRoundIndex].assignmentsA
    : cd.schedule[cd.currentRoundIndex].assignmentsB;
  const assignment = assignments.find((a: ClashAssignment) => a.writerId === uid);
  if (!assignment) throw new Error("No assignment found for this player");
  const comment: ClashComment = {
    writerId: uid,
    subjectId: assignment.subjectId,
    text: text.trim(),
    submittedAt: Date.now(),
  };
  const commentKey = isGroupA ? 'clashData.currentRoundCommentsA' : 'clashData.currentRoundCommentsB';
  const groupSize = cd.groupA.memberIds.length;
  const newCount = (isGroupA ? cd.currentRoundCommentsA.length : cd.currentRoundCommentsB.length) + 1;
  const updates: Record<string, unknown> = { [commentKey]: arrayUnion(comment) };
  if (newCount >= groupSize) {
    updates['clashData.lastGroupToFinish'] = isGroupA ? 'a' : 'b';
  }
  try {
    setLoading(true);
    const gameRef = doc(db, 'games', currentGame!.id);
    await updateDoc(gameRef, updates);
  } catch (err) {
    console.error('Error submitting clash comment:', err);
    throw err;
  } finally {
    setLoading(false);
  }
};
```

- [ ] **Step 4: Add `revealClashComments`**

```typescript
const revealClashComments = async (): Promise<void> => {
  if (!auth.currentUser) throw new Error("You must be signed in");
  if (!currentGame || auth.currentUser.uid !== currentGame.adminId) {
    throw new Error("Only the admin can reveal comments");
  }
  const cd = currentGame.clashData;
  if (!cd) throw new Error("No active clash game");
  const groupSize = cd.groupA.memberIds.length;
  if (cd.currentRoundCommentsA.length < groupSize) {
    throw new Error(`Group A hasn't finished submitting (${cd.currentRoundCommentsA.length}/${groupSize})`);
  }
  if (cd.currentRoundCommentsB.length < groupSize) {
    throw new Error(`Group B hasn't finished submitting (${cd.currentRoundCommentsB.length}/${groupSize})`);
  }
  try {
    setLoading(true);
    const gameRef = doc(db, 'games', currentGame.id);
    await updateDoc(gameRef, {
      status: 'clash_guessing',
      'clashData.currentGuessingGroup': cd.lastGroupToFinish ?? 'a',
    });
  } catch (err) {
    console.error('Error revealing clash comments:', err);
    throw err;
  } finally {
    setLoading(false);
  }
};
```

- [ ] **Step 5: Add `submitClashGuess`**

```typescript
const submitClashGuess = async (commentWriterId: string, guessedSubjectId: string): Promise<void> => {
  if (!auth.currentUser) throw new Error("You must be signed in");
  const cd = currentGame?.clashData;
  if (!cd) throw new Error("No active clash game");
  const uid = auth.currentUser.uid;
  const currentGroup = cd.currentGuessingGroup;
  if (!currentGroup) throw new Error("Not in guessing phase");
  const activeLeaderId = currentGroup === 'a' ? cd.groupA.leaderId : cd.groupB.leaderId;
  if (uid !== activeLeaderId) throw new Error("Only the active leader can submit guesses");
  const oppositeComments = currentGroup === 'a' ? cd.currentRoundCommentsB : cd.currentRoundCommentsA;
  const comment = oppositeComments.find((c: ClashComment) => c.writerId === commentWriterId);
  if (!comment) throw new Error("Comment not found");
  const subjectCorrect = comment.subjectId === guessedSubjectId;
  const guess: ClashGuess = { commentWriterId, guessedSubjectId, subjectCorrect, pointsAwarded: subjectCorrect ? 1 : 0 };
  const guessKey = currentGroup === 'a' ? 'clashData.currentRoundGuessesA' : 'clashData.currentRoundGuessesB';
  const updates: Record<string, unknown> = { [guessKey]: arrayUnion(guess) };
  if (subjectCorrect) {
    updates[`clashData.teamScores.${currentGroup}`] = (cd.teamScores[currentGroup] ?? 0) + 1;
  }
  try {
    setLoading(true);
    const gameRef = doc(db, 'games', currentGame!.id);
    await updateDoc(gameRef, updates);
  } catch (err) {
    console.error('Error submitting clash guess:', err);
    throw err;
  } finally {
    setLoading(false);
  }
};
```

- [ ] **Step 6: Add `submitClashAuthorGuess`**

```typescript
const submitClashAuthorGuess = async (commentWriterId: string, guessedAuthorId: string): Promise<void> => {
  if (!auth.currentUser) throw new Error("You must be signed in");
  const cd = currentGame?.clashData;
  if (!cd) throw new Error("No active clash game");
  const uid = auth.currentUser.uid;
  const currentGroup = cd.currentGuessingGroup;
  if (!currentGroup) throw new Error("Not in guessing phase");
  const activeLeaderId = currentGroup === 'a' ? cd.groupA.leaderId : cd.groupB.leaderId;
  if (uid !== activeLeaderId) throw new Error("Only the active leader can submit guesses");
  const guesses = currentGroup === 'a' ? cd.currentRoundGuessesA : cd.currentRoundGuessesB;
  const existing = guesses.find((g: ClashGuess) => g.commentWriterId === commentWriterId);
  if (!existing?.subjectCorrect) throw new Error("Cannot guess author without a correct subject guess");
  if (existing.guessedAuthorId !== undefined) throw new Error("Author already guessed");
  const authorCorrect = guessedAuthorId === commentWriterId;
  const updatedGuesses = guesses.map((g: ClashGuess) =>
    g.commentWriterId === commentWriterId
      ? { ...g, guessedAuthorId, authorCorrect, pointsAwarded: g.pointsAwarded + (authorCorrect ? 1 : 0) }
      : g
  );
  const guessKey = currentGroup === 'a' ? 'clashData.currentRoundGuessesA' : 'clashData.currentRoundGuessesB';
  const updates: Record<string, unknown> = { [guessKey]: updatedGuesses };
  if (authorCorrect) {
    updates[`clashData.teamScores.${currentGroup}`] = (cd.teamScores[currentGroup] ?? 0) + 1;
  }
  try {
    setLoading(true);
    const gameRef = doc(db, 'games', currentGame!.id);
    await updateDoc(gameRef, updates);
  } catch (err) {
    console.error('Error submitting clash author guess:', err);
    throw err;
  } finally {
    setLoading(false);
  }
};
```

- [ ] **Step 7: Add `advanceClashGuessing`**

```typescript
const advanceClashGuessing = async (): Promise<void> => {
  if (!auth.currentUser) throw new Error("You must be signed in");
  if (!currentGame || auth.currentUser.uid !== currentGame.adminId) {
    throw new Error("Only the admin can advance guessing");
  }
  const cd = currentGame.clashData;
  if (!cd || currentGame.status !== 'clash_guessing') throw new Error("Not in guessing phase");
  const currentGroup = cd.currentGuessingGroup!;
  const otherGroup: 'a' | 'b' = currentGroup === 'a' ? 'b' : 'a';
  const otherGuessCount = otherGroup === 'a' ? cd.currentRoundGuessesA.length : cd.currentRoundGuessesB.length;
  const otherCommentCount = otherGroup === 'a' ? cd.currentRoundCommentsB.length : cd.currentRoundCommentsA.length;
  const otherGroupDone = otherCommentCount > 0 && otherGuessCount >= otherCommentCount;
  try {
    setLoading(true);
    const gameRef = doc(db, 'games', currentGame.id);
    if (!otherGroupDone) {
      await updateDoc(gameRef, { 'clashData.currentGuessingGroup': otherGroup });
    } else if (cd.currentRoundIndex + 1 >= cd.schedule.length) {
      await updateDoc(gameRef, { status: 'finished' });
    } else {
      await updateDoc(gameRef, {
        status: 'clash_writing',
        'clashData.currentRoundIndex': cd.currentRoundIndex + 1,
        'clashData.currentRoundCommentsA': [],
        'clashData.currentRoundCommentsB': [],
        'clashData.currentRoundGuessesA': [],
        'clashData.currentRoundGuessesB': [],
        'clashData.lastGroupToFinish': null,
        'clashData.currentGuessingGroup': null,
      });
    }
  } catch (err) {
    console.error('Error advancing clash guessing:', err);
    throw err;
  } finally {
    setLoading(false);
  }
};
```

- [ ] **Step 8: Add all 7 methods to the `value` useMemo (after `startNextBasketRound`)**

```typescript
saveClashGroups,
startClashGame,
submitClashComment,
revealClashComments,
submitClashGuess,
submitClashAuthorGuess,
advanceClashGuessing,
```

- [ ] **Step 9: Commit**

```bash
git add contexts/GameContext.tsx
git commit -m "feat: add 7 clash GameContext methods"
```

---

### Task 4: `ClashScoreboard.tsx` — team score display

**Files:**
- Create: `components/game/clash/ClashScoreboard.tsx`

- [ ] **Step 1: Create the component**

```typescript
// components/game/clash/ClashScoreboard.tsx
import { ThemedText } from '@/components/themed-text';
import { Fonts, GameColors } from '@/constants/theme';
import { t } from '@/i18n';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface Props {
  scoreA: number;
  scoreB: number;
  locale: string;
}

export const ClashScoreboard: React.FC<Props> = ({ scoreA, scoreB, locale }) => (
  <View style={styles.row}>
    <ThemedText style={styles.score}>
      {t('game.ui.clash.teamScore', { locale, a: scoreA, b: scoreB })}
    </ThemedText>
  </View>
);

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: GameColors.clashWritingTint,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GameColors.clashWritingTintBorder,
  },
  score: { fontSize: 14, fontWeight: '700', fontFamily: Fonts.sans },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/game/clash/ClashScoreboard.tsx
git commit -m "feat: add ClashScoreboard component"
```

---

### Task 5: `ClashWritingPhase.tsx` + tests

**Files:**
- Create: `components/game/clash/ClashWritingPhase.tsx`
- Create: `__tests__/ClashWritingPhase.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/ClashWritingPhase.test.tsx
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@/i18n', () => ({
  t: (key: string, opts?: Record<string, unknown>) => {
    const extras = opts ? Object.entries(opts).filter(([k]) => k !== 'locale').map(([,v]) => String(v)).join(':') : '';
    return extras ? `${key}[${extras}]` : key;
  },
}));

let mockSubmitClashComment = jest.fn().mockResolvedValue(undefined);
let mockRevealClashComments = jest.fn().mockResolvedValue(undefined);

jest.mock('@/contexts/GameContext', () => ({
  useGame: () => ({ submitClashComment: mockSubmitClashComment, revealClashComments: mockRevealClashComments }),
}));
jest.mock('@/contexts/SoundContext', () => ({ useSound: () => ({ playSound: jest.fn().mockResolvedValue(undefined) }) }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));
jest.mock('@/components/themed-text', () => { const { Text } = require('react-native'); return { ThemedText: ({ children, ...p }: any) => <Text {...p}>{children}</Text> }; });
jest.mock('@/components/ui/icon-symbol', () => { const { Text } = require('react-native'); return { IconSymbol: ({ name }: any) => <Text>{name}</Text> }; });
jest.mock('@/components/game/GameHeader', () => ({}));
jest.mock('@/components/game/gameStyles', () => ({ gameStyles: { statusLabel: {}, statusBadge: {}, statusText: {}, buttonDisabled: {}, gameFlowContainer: {} } }));
jest.mock('@/components/game/clash/ClashScoreboard', () => { const { Text } = require('react-native'); return { ClashScoreboard: () => <Text>scoreboard</Text> }; });
jest.mock('@/constants/theme', () => ({
  Fonts: { sans: 'System' },
  GameColors: { white: '#fff', blue: '#007AFF', admin: '#FF9500', shadow: '#000', cardBg: '#fafafa', cardBorder: '#eee', clashWritingTint: 'rgba(255,120,0,0.06)', clashWritingTintBorder: 'rgba(255,120,0,0.15)' },
  StatusColors: { clash_writing: '#FF7800' },
  themedInput: () => ({ style: {}, placeholderTextColor: '#ccc' }),
}));

const { ClashWritingPhase } = require('../components/game/clash/ClashWritingPhase');

const SCHEDULE = [{
  assignmentsA: [{ writerId: 'u1', subjectId: 'u3' }, { writerId: 'u2', subjectId: 'u4' }],
  assignmentsB: [{ writerId: 'u3', subjectId: 'u1' }, { writerId: 'u4', subjectId: 'u2' }],
}];

const baseGame = {
  id: 'G1', adminId: 'u1', status: 'clash_writing',
  participants: [
    { userId: 'u1', userName: 'Alice', joinedAt: 0 },
    { userId: 'u2', userName: 'Bob', joinedAt: 1 },
    { userId: 'u3', userName: 'Carol', joinedAt: 2 },
    { userId: 'u4', userName: 'Dave', joinedAt: 3 },
  ],
  clashData: {
    groupA: { leaderId: 'u1', memberIds: ['u1', 'u2'] },
    groupB: { leaderId: 'u3', memberIds: ['u3', 'u4'] },
    schedule: SCHEDULE,
    currentRoundIndex: 0,
    currentRoundCommentsA: [],
    currentRoundCommentsB: [],
    lastGroupToFinish: null,
    currentGuessingGroup: null,
    currentRoundGuessesA: [],
    currentRoundGuessesB: [],
    teamScores: { a: 0, b: 0 },
  },
};

function renderPhase(overrides = {}, isAdmin = true, userId = 'u1') {
  return render(
    <ClashWritingPhase
      game={{ ...baseGame, ...overrides }}
      user={{ uid: userId }}
      isAdmin={isAdmin}
      locale="en"
      isDark={false}
      getDisplayName={(n: string) => n}
    />
  );
}

beforeEach(() => {
  mockSubmitClashComment = jest.fn().mockResolvedValue(undefined);
  mockRevealClashComments = jest.fn().mockResolvedValue(undefined);
});

describe('ClashWritingPhase', () => {
  it('shows the assigned subject name for user u1 (writes about u3 = Carol)', () => {
    const { queryByText } = renderPhase({}, true, 'u1');
    expect(queryByText('Carol')).toBeTruthy();
  });

  it('submit button calls submitClashComment with entered text', async () => {
    const { getByPlaceholderText, getByText } = renderPhase({}, true, 'u1');
    fireEvent.changeText(getByPlaceholderText('game.ui.clash.writeComment'), 'nice person');
    await act(async () => { fireEvent.press(getByText('game.ui.clash.submit')); });
    expect(mockSubmitClashComment).toHaveBeenCalledWith('nice person');
  });

  it('shows waiting card after submitting', async () => {
    const { getByPlaceholderText, getByText, queryByText } = renderPhase({}, true, 'u1');
    fireEvent.changeText(getByPlaceholderText('game.ui.clash.writeComment'), 'hi');
    await act(async () => { fireEvent.press(getByText('game.ui.clash.submit')); });
    expect(queryByText('game.ui.clash.writeComment')).toBeNull();
  });

  it('admin sees reveal button', () => {
    const { queryByText } = renderPhase({}, true);
    expect(queryByText('game.ui.clash.revealComments')).toBeTruthy();
  });

  it('non-admin does not see reveal button', () => {
    const { queryByText } = renderPhase({}, false);
    expect(queryByText('game.ui.clash.revealComments')).toBeNull();
  });

  it('reveal button calls revealClashComments when all submitted', async () => {
    const allSubmitted = {
      clashData: {
        ...baseGame.clashData,
        currentRoundCommentsA: [
          { writerId: 'u1', subjectId: 'u3', text: 'a', submittedAt: 1 },
          { writerId: 'u2', subjectId: 'u4', text: 'b', submittedAt: 2 },
        ],
        currentRoundCommentsB: [
          { writerId: 'u3', subjectId: 'u1', text: 'c', submittedAt: 3 },
          { writerId: 'u4', subjectId: 'u2', text: 'd', submittedAt: 4 },
        ],
      },
    };
    const { getByText } = renderPhase(allSubmitted, true);
    await act(async () => { fireEvent.press(getByText('game.ui.clash.revealComments')); });
    expect(mockRevealClashComments).toHaveBeenCalled();
  });

  it('reveal button does nothing when not all submitted', async () => {
    const { getByText } = renderPhase({}, true);
    await act(async () => { fireEvent.press(getByText('game.ui.clash.revealComments')); });
    expect(mockRevealClashComments).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- __tests__/ClashWritingPhase.test.tsx --no-coverage
```
Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement `ClashWritingPhase.tsx`**

```typescript
// components/game/clash/ClashWritingPhase.tsx
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ShowFancyAlertFn } from '@/components/game/GameHeader';
import { gameStyles } from '@/components/game/gameStyles';
import { ClashScoreboard } from './ClashScoreboard';
import { Fonts, GameColors, StatusColors, themedInput } from '@/constants/theme';
import type { Game, ClashAssignment } from '@/contexts/GameContext';
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

export const ClashWritingPhase: React.FC<Props> = ({
  game, user, isAdmin, locale, isDark, getDisplayName, showFancyAlert,
}) => {
  const { submitClashComment, revealClashComments } = useGame();
  const { playSound } = useSound();
  const inputTheme = themedInput(isDark);
  const [commentText, setCommentText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);

  const cd = game.clashData!;
  const { schedule, currentRoundIndex, currentRoundCommentsA, currentRoundCommentsB, teamScores } = cd;
  const totalRounds = schedule.length;
  const uid = user?.uid ?? '';
  const isGroupA = cd.groupA.memberIds.includes(uid);
  const myAssignments = isGroupA
    ? schedule[currentRoundIndex].assignmentsA
    : schedule[currentRoundIndex].assignmentsB;
  const myAssignment = myAssignments.find((a: ClashAssignment) => a.writerId === uid);
  const subjectParticipant = game.participants.find(p => p.userId === myAssignment?.subjectId);
  const subjectName = subjectParticipant ? getDisplayName(subjectParticipant.userName) : '?';

  const groupSize = cd.groupA.memberIds.length;
  const alreadySubmitted = submitted
    || (isGroupA ? currentRoundCommentsA : currentRoundCommentsB).some(c => c.writerId === uid);
  const countA = currentRoundCommentsA.length;
  const countB = currentRoundCommentsB.length;
  const allSubmitted = countA >= groupSize && countB >= groupSize;

  const handleSubmit = async () => {
    if (!commentText.trim()) return;
    try {
      setIsSubmitting(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await submitClashComment(commentText.trim());
      setSubmitted(true);
      setCommentText('');
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

  const handleReveal = async () => {
    try {
      setIsRevealing(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await revealClashComments();
      await playSound('success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert?.(t('common.error', { locale }), (err instanceof Error && err.message) || t('common.error', { locale }));
    } finally {
      setIsRevealing(false);
    }
  };

  return (
    <View style={styles.phaseWrapper}>
      <View style={styles.statusRow}>
        <ThemedText style={gameStyles.statusLabel}>{t('game.ui.statusLabel', { locale })}</ThemedText>
        <View style={[gameStyles.statusBadge, { backgroundColor: StatusColors.clash_writing }]}>
          <ThemedText style={gameStyles.statusText}>
            {t('game.ui.clash.round', { locale, current: currentRoundIndex + 1, total: totalRounds })}
          </ThemedText>
        </View>
      </View>

      <View style={gameStyles.gameFlowContainer}>
        {alreadySubmitted ? (
          <View style={styles.waitingCard}>
            <ThemedText style={styles.waitingText}>
              {t('game.ui.clash.waitingForGroup', { locale, a: countA, b: countB, n: groupSize })}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.writeSection}>
            <View style={styles.subjectCard}>
              <ThemedText style={styles.subjectLabel}>{t('game.ui.clash.yourSubject', { locale })}</ThemedText>
              <ThemedText style={styles.subjectName}>{subjectName}</ThemedText>
            </View>
            <TextInput
              style={[styles.input, inputTheme.style]}
              value={commentText}
              onChangeText={setCommentText}
              placeholder={t('game.ui.clash.writeComment', { locale })}
              placeholderTextColor={inputTheme.placeholderTextColor}
              multiline
              numberOfLines={4}
              maxLength={500}
              textAlignVertical="top"
            />
            <ThemedText style={[styles.charCounter, commentText.length >= 450 && styles.charCounterWarn]}>
              {commentText.length}/500
            </ThemedText>
            <TouchableOpacity
              style={[styles.wideButton, { backgroundColor: GameColors.blue, shadowColor: GameColors.shadow }, (!commentText.trim() || isSubmitting) && gameStyles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={!commentText.trim() || isSubmitting}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              {isSubmitting
                ? <ActivityIndicator size="small" color={GameColors.white} />
                : <IconSymbol name="paperplane.fill" size={16} color={GameColors.white} />}
              <ThemedText style={styles.wideButtonText}>{t('game.ui.clash.submit', { locale })}</ThemedText>
            </TouchableOpacity>
          </View>
        )}

        {isAdmin && (
          <View style={styles.adminSection}>
            <ClashScoreboard scoreA={teamScores.a} scoreB={teamScores.b} locale={locale} />
            <ThemedText style={styles.adminCount}>{countA}/{groupSize} · {countB}/{groupSize}</ThemedText>
            <TouchableOpacity
              style={[styles.wideButton, { backgroundColor: GameColors.admin, shadowColor: GameColors.shadow }, (isRevealing || !allSubmitted) && gameStyles.buttonDisabled]}
              onPress={handleReveal}
              disabled={isRevealing || !allSubmitted}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              {isRevealing
                ? <ActivityIndicator size="small" color={GameColors.white} />
                : <IconSymbol name="eye.fill" size={16} color={GameColors.white} />}
              <ThemedText style={styles.wideButtonText}>{t('game.ui.clash.revealComments', { locale })}</ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  phaseWrapper: { backgroundColor: 'rgba(255,120,0,0.06)', borderWidth: 1, borderColor: 'rgba(255,120,0,0.15)', borderRadius: 16, padding: 16, marginBottom: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  writeSection: { gap: 8 },
  subjectCard: { padding: 16, borderRadius: 8, backgroundColor: GameColors.cardBg, marginBottom: 8, alignItems: 'center' },
  subjectLabel: { fontSize: 13, opacity: 0.6, marginBottom: 4, fontFamily: Fonts.sans },
  subjectName: { fontSize: 22, fontWeight: '700', fontFamily: Fonts.sans },
  input: { minHeight: 100, borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 4, borderWidth: 1, textAlignVertical: 'top', fontFamily: Fonts.sans, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 }, android: { elevation: 2 } }) },
  charCounter: { fontSize: 12, opacity: 0.5, textAlign: 'right', marginBottom: 8, fontFamily: Fonts.sans },
  charCounterWarn: { opacity: 1, color: '#e53935' },
  waitingCard: { padding: 24, borderRadius: 8, backgroundColor: GameColors.cardBg, alignItems: 'center' },
  waitingText: { textAlign: 'center', opacity: 0.7, fontSize: 16, fontFamily: Fonts.sans },
  adminSection: { marginTop: 24, alignItems: 'center', gap: 6 },
  adminCount: { fontSize: 13, opacity: 0.6, fontFamily: Fonts.sans },
  wideButton: { flexDirection: 'row', borderRadius: 999, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', gap: 8, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  wideButtonText: { color: GameColors.white, fontWeight: '600', fontSize: 15, fontFamily: Fonts.sans },
});
```

- [ ] **Step 4: Run tests**

```bash
npm test -- __tests__/ClashWritingPhase.test.tsx --no-coverage
```
Expected: PASS — 7 tests

- [ ] **Step 5: Commit**

```bash
git add components/game/clash/ClashWritingPhase.tsx __tests__/ClashWritingPhase.test.tsx
git commit -m "feat: add ClashWritingPhase with tests"
```

---

### Task 6: `ClashGuessingPhase.tsx` + tests

**Files:**
- Create: `components/game/clash/ClashGuessingPhase.tsx`
- Create: `__tests__/ClashGuessingPhase.test.tsx`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/ClashGuessingPhase.test.tsx
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

jest.mock('@/i18n', () => ({
  t: (key: string, opts?: Record<string, unknown>) => {
    const extras = opts ? Object.entries(opts).filter(([k]) => k !== 'locale').map(([,v]) => String(v)).join(':') : '';
    return extras ? `${key}[${extras}]` : key;
  },
}));

let mockSubmitClashGuess = jest.fn().mockResolvedValue(undefined);
let mockSubmitClashAuthorGuess = jest.fn().mockResolvedValue(undefined);
let mockAdvanceClashGuessing = jest.fn().mockResolvedValue(undefined);

jest.mock('@/contexts/GameContext', () => ({
  useGame: () => ({
    submitClashGuess: mockSubmitClashGuess,
    submitClashAuthorGuess: mockSubmitClashAuthorGuess,
    advanceClashGuessing: mockAdvanceClashGuessing,
  }),
}));
jest.mock('@/contexts/SoundContext', () => ({ useSound: () => ({ playSound: jest.fn().mockResolvedValue(undefined) }) }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error' },
}));
jest.mock('@/components/themed-text', () => { const { Text } = require('react-native'); return { ThemedText: ({ children, ...p }: any) => <Text {...p}>{children}</Text> }; });
jest.mock('@/components/ui/icon-symbol', () => { const { Text } = require('react-native'); return { IconSymbol: ({ name }: any) => <Text>{name}</Text> }; });
jest.mock('@/components/game/GameHeader', () => ({}));
jest.mock('@/components/game/gameStyles', () => ({ gameStyles: { statusLabel: {}, statusBadge: {}, statusText: {}, buttonDisabled: {}, gameFlowContainer: {} } }));
jest.mock('@/components/game/clash/ClashScoreboard', () => { const { Text } = require('react-native'); return { ClashScoreboard: () => <Text>scoreboard</Text> }; });
jest.mock('@/constants/theme', () => ({
  Fonts: { sans: 'System' },
  GameColors: { white: '#fff', blue: '#007AFF', green: '#34C759', correct: '#34C759', incorrect: '#FF3B30', shadow: '#000', cardBg: '#fafafa', cardBorder: '#eee', neutral: '#8E8E93' },
  StatusColors: { clash_guessing: '#FF5000' },
}));

const { ClashGuessingPhase } = require('../components/game/clash/ClashGuessingPhase');

// Group A: u1 (leader), u2 — Group B: u3 (leader), u4
// Group A wrote comments ABOUT group B members (stored in commentsA)
// Group B wrote comments ABOUT group A members (stored in commentsB)
// currentGuessingGroup = 'a': leader u1 guesses about commentsB (written BY group B, ABOUT group A)
const COMMENTS_B = [
  { writerId: 'u3', subjectId: 'u1', text: 'Comment about u1 by u3', submittedAt: 1 },
  { writerId: 'u4', subjectId: 'u2', text: 'Comment about u2 by u4', submittedAt: 2 },
];

const baseGame = {
  id: 'G1', adminId: 'u1', status: 'clash_guessing',
  participants: [
    { userId: 'u1', userName: 'Alice', joinedAt: 0 },
    { userId: 'u2', userName: 'Bob', joinedAt: 1 },
    { userId: 'u3', userName: 'Carol', joinedAt: 2 },
    { userId: 'u4', userName: 'Dave', joinedAt: 3 },
  ],
  clashData: {
    groupA: { leaderId: 'u1', memberIds: ['u1', 'u2'] },
    groupB: { leaderId: 'u3', memberIds: ['u3', 'u4'] },
    schedule: [{ assignmentsA: [], assignmentsB: [] }],
    currentRoundIndex: 0,
    currentRoundCommentsA: [],
    currentRoundCommentsB: COMMENTS_B,
    lastGroupToFinish: 'b',
    currentGuessingGroup: 'a',
    currentRoundGuessesA: [],
    currentRoundGuessesB: [],
    teamScores: { a: 0, b: 0 },
  },
};

function renderPhase(overrides = {}, isAdmin = true, userId = 'u1') {
  return render(
    <ClashGuessingPhase
      game={{ ...baseGame, ...overrides }}
      user={{ uid: userId }}
      isAdmin={isAdmin}
      locale="en"
      isDark={false}
      getDisplayName={(n: string) => n}
    />
  );
}

beforeEach(() => {
  mockSubmitClashGuess = jest.fn().mockResolvedValue(undefined);
  mockSubmitClashAuthorGuess = jest.fn().mockResolvedValue(undefined);
  mockAdvanceClashGuessing = jest.fn().mockResolvedValue(undefined);
});

describe('ClashGuessingPhase', () => {
  it('active leader (u1) sees comment cards from opposite group', () => {
    const { queryByText } = renderPhase({}, true, 'u1');
    expect(queryByText('Comment about u1 by u3')).toBeTruthy();
    expect(queryByText('Comment about u2 by u4')).toBeTruthy();
  });

  it('non-leader sees waiting message', () => {
    const { queryByText } = renderPhase({}, false, 'u2');
    expect(queryByText(/clash\.leaderGuessing/)).toBeTruthy();
    expect(queryByText('Comment about u1 by u3')).toBeNull();
  });

  it('tapping a comment card shows subject picker with own group members', async () => {
    const { getByText, queryByText } = renderPhase({}, true, 'u1');
    await act(async () => { fireEvent.press(getByText('Comment about u1 by u3')); });
    // Subject picker shows Group A members (Alice, Bob)
    expect(queryByText('game.ui.clash.whichMember')).toBeTruthy();
    expect(queryByText('Alice')).toBeTruthy();
    expect(queryByText('Bob')).toBeTruthy();
  });

  it('correct subject guess calls submitClashGuess and shows author picker', async () => {
    const { getByText, queryByText } = renderPhase({}, true, 'u1');
    await act(async () => { fireEvent.press(getByText('Comment about u1 by u3')); });
    // Alice (u1) is the correct subject for the first comment
    await act(async () => { fireEvent.press(getByText('Alice')); });
    expect(mockSubmitClashGuess).toHaveBeenCalledWith('u3', 'u1');
    expect(queryByText('game.ui.clash.whoWroteIt')).toBeTruthy();
    // Author picker shows Group B members
    expect(queryByText('Carol')).toBeTruthy();
    expect(queryByText('Dave')).toBeTruthy();
  });

  it('wrong subject guess shows wrong feedback', async () => {
    const { getByText, queryByText } = renderPhase({}, true, 'u1');
    await act(async () => { fireEvent.press(getByText('Comment about u1 by u3')); });
    // Bob (u2) is wrong subject for first comment (correct is u1)
    await act(async () => { fireEvent.press(getByText('Bob')); });
    expect(queryByText('game.ui.clash.wrong')).toBeTruthy();
    expect(queryByText('game.ui.clash.whoWroteIt')).toBeNull();
  });

  it('author guess calls submitClashAuthorGuess', async () => {
    const { getByText } = renderPhase({}, true, 'u1');
    await act(async () => { fireEvent.press(getByText('Comment about u1 by u3')); });
    await act(async () => { fireEvent.press(getByText('Alice')); }); // correct subject
    await act(async () => { fireEvent.press(getByText('Carol')); }); // guess author
    expect(mockSubmitClashAuthorGuess).toHaveBeenCalledWith('u3', 'u3');
  });

  it('admin sees the advance button', () => {
    const { queryByText } = renderPhase({}, true, 'u1');
    expect(queryByText(/clash\.(nextLeader|nextRound|finishGame)/)).toBeTruthy();
  });

  it('advance button calls advanceClashGuessing', async () => {
    const { getByText } = renderPhase({}, true, 'u1');
    // Find the button by matching any of the advance labels
    const btn = getByText(/game\.ui\.clash\.(nextLeader|nextRound|finishGame)/);
    await act(async () => { fireEvent.press(btn); });
    expect(mockAdvanceClashGuessing).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test -- __tests__/ClashGuessingPhase.test.tsx --no-coverage
```
Expected: FAIL — "Cannot find module"

- [ ] **Step 3: Implement `ClashGuessingPhase.tsx`**

```typescript
// components/game/clash/ClashGuessingPhase.tsx
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ShowFancyAlertFn } from '@/components/game/GameHeader';
import { gameStyles } from '@/components/game/gameStyles';
import { ClashScoreboard } from './ClashScoreboard';
import { Fonts, GameColors, StatusColors } from '@/constants/theme';
import type { Game, ClashComment, ClashGuess } from '@/contexts/GameContext';
import { useGame } from '@/contexts/GameContext';
import { useSound } from '@/contexts/SoundContext';
import { t } from '@/i18n';
import * as Haptics from 'expo-haptics';
import React, { useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

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

type CardPhase = 'idle' | 'subject_picking' | 'correct' | 'wrong' | 'author_picking' | 'done';

export const ClashGuessingPhase: React.FC<Props> = ({
  game, user, isAdmin, locale, getDisplayName, showFancyAlert,
}) => {
  const { submitClashGuess, submitClashAuthorGuess, advanceClashGuessing } = useGame();
  const { playSound } = useSound();

  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [cardPhases, setCardPhases] = useState<Record<string, CardPhase>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);

  const cd = game.clashData!;
  const { currentRoundIndex, teamScores } = cd;
  const totalRounds = cd.schedule.length;
  const uid = user?.uid ?? '';
  const currentGroup = cd.currentGuessingGroup!;
  const activeLeaderId = currentGroup === 'a' ? cd.groupA.leaderId : cd.groupB.leaderId;
  const isActiveLeader = uid === activeLeaderId;

  const activeLeaderParticipant = game.participants.find(p => p.userId === activeLeaderId);
  const activeLeaderName = activeLeaderParticipant ? getDisplayName(activeLeaderParticipant.userName) : '?';

  // Comments written BY the opposite group (which the active leader guesses about)
  const commentsToGuess: ClashComment[] = currentGroup === 'a' ? cd.currentRoundCommentsB : cd.currentRoundCommentsA;
  // Own group members (subjects to pick from)
  const ownGroupIds = currentGroup === 'a' ? cd.groupA.memberIds : cd.groupB.memberIds;
  // Opposite group members (authors to pick from)
  const oppositeGroupIds = currentGroup === 'a' ? cd.groupB.memberIds : cd.groupA.memberIds;

  const existingGuesses: ClashGuess[] = currentGroup === 'a' ? cd.currentRoundGuessesA : cd.currentRoundGuessesB;

  const isLastRound = currentRoundIndex + 1 >= totalRounds;
  const otherGroup: 'a' | 'b' = currentGroup === 'a' ? 'b' : 'a';
  const otherGuessCount = otherGroup === 'a' ? cd.currentRoundGuessesA.length : cd.currentRoundGuessesB.length;
  const otherCommentCount = otherGroup === 'a' ? cd.currentRoundCommentsB.length : cd.currentRoundCommentsA.length;
  const otherGroupDone = otherCommentCount > 0 && otherGuessCount >= otherCommentCount;

  const advanceLabel = otherGroupDone
    ? (isLastRound ? t('game.ui.clash.finishGame', { locale }) : t('game.ui.clash.nextRound', { locale }))
    : t('game.ui.clash.nextLeader', { locale });

  const getCardPhase = (writerId: string): CardPhase => {
    const local = cardPhases[writerId];
    if (local) return local;
    const existing = existingGuesses.find(g => g.commentWriterId === writerId);
    if (!existing) return 'idle';
    if (!existing.subjectCorrect) return 'wrong';
    if (existing.guessedAuthorId !== undefined) return 'done';
    return 'correct';
  };

  const handleCardPress = (writerId: string) => {
    if (!isActiveLeader || isSubmitting) return;
    const phase = getCardPhase(writerId);
    if (phase !== 'idle') return;
    setExpandedCard(expandedCard === writerId ? null : writerId);
    setCardPhases(p => ({ ...p, [writerId]: expandedCard === writerId ? 'idle' : 'subject_picking' }));
  };

  const handleSubjectSelect = async (commentWriterId: string, guessedSubjectId: string) => {
    if (isSubmitting) return;
    const comment = commentsToGuess.find(c => c.writerId === commentWriterId);
    if (!comment) return;
    const correct = comment.subjectId === guessedSubjectId;
    try {
      setIsSubmitting(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await submitClashGuess(commentWriterId, guessedSubjectId);
      setCardPhases(p => ({ ...p, [commentWriterId]: correct ? 'correct' : 'wrong' }));
      if (correct) {
        await playSound('correctGuess');
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        await playSound('wrongGuess');
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    } catch (err: unknown) {
      await playSound('error');
      showFancyAlert?.(t('common.error', { locale }), (err instanceof Error && err.message) || t('common.error', { locale }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAuthorSelect = async (commentWriterId: string, guessedAuthorId: string) => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await submitClashAuthorGuess(commentWriterId, guessedAuthorId);
      setCardPhases(p => ({ ...p, [commentWriterId]: 'done' }));
      await playSound('success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      await playSound('error');
      showFancyAlert?.(t('common.error', { locale }), (err instanceof Error && err.message) || t('common.error', { locale }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdvance = async () => {
    try {
      setIsAdvancing(true);
      await playSound('click');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await advanceClashGuessing();
      await playSound(isLastRound && otherGroupDone ? 'gameOver' : 'roundComplete');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      await playSound('error');
      showFancyAlert?.(t('common.error', { locale }), (err instanceof Error && err.message) || t('common.error', { locale }));
    } finally {
      setIsAdvancing(false);
    }
  };

  return (
    <View style={styles.phaseWrapper}>
      <View style={styles.statusRow}>
        <ThemedText style={gameStyles.statusLabel}>{t('game.ui.statusLabel', { locale })}</ThemedText>
        <View style={[gameStyles.statusBadge, { backgroundColor: StatusColors.clash_guessing }]}>
          <ThemedText style={gameStyles.statusText}>
            {t('game.ui.clash.round', { locale, current: currentRoundIndex + 1, total: totalRounds })}
          </ThemedText>
        </View>
      </View>

      <ClashScoreboard scoreA={teamScores.a} scoreB={teamScores.b} locale={locale} />

      <View style={gameStyles.gameFlowContainer}>
        {!isActiveLeader ? (
          <View style={styles.waitingCard}>
            <ThemedText style={styles.waitingText}>
              {t('game.ui.clash.leaderGuessing', { locale, name: activeLeaderName })}
            </ThemedText>
          </View>
        ) : (
          <View>
            {commentsToGuess.map(comment => {
              const phase = getCardPhase(comment.writerId);
              const isExpanded = expandedCard === comment.writerId;
              return (
                <View key={comment.writerId} style={styles.commentBlock}>
                  <TouchableOpacity
                    style={[styles.commentCard, phase === 'wrong' && styles.commentCardWrong, (phase === 'done' || phase === 'correct') && styles.commentCardCorrect]}
                    onPress={() => handleCardPress(comment.writerId)}
                    disabled={phase !== 'idle' || isSubmitting}
                    activeOpacity={0.8}
                  >
                    <ThemedText style={styles.commentText}>{comment.text}</ThemedText>
                  </TouchableOpacity>

                  {(isExpanded || phase === 'subject_picking') && phase === 'subject_picking' && (
                    <View style={styles.pickerSection}>
                      <ThemedText style={styles.pickerLabel}>{t('game.ui.clash.whichMember', { locale })}</ThemedText>
                      {ownGroupIds.map(memberId => {
                        const p = game.participants.find(p => p.userId === memberId);
                        return (
                          <TouchableOpacity
                            key={memberId}
                            style={styles.choiceCard}
                            onPress={() => handleSubjectSelect(comment.writerId, memberId)}
                            disabled={isSubmitting}
                            activeOpacity={0.8}
                          >
                            <ThemedText style={styles.choiceName}>{p ? getDisplayName(p.userName) : memberId}</ThemedText>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  {phase === 'wrong' && (
                    <ThemedText style={styles.wrongText}>{t('game.ui.clash.wrong', { locale })}</ThemedText>
                  )}

                  {phase === 'correct' && (
                    <View style={styles.pickerSection}>
                      <ThemedText style={styles.correctText}>{t('game.ui.clash.correct', { locale })}</ThemedText>
                      <ThemedText style={styles.pickerLabel}>{t('game.ui.clash.whoWroteIt', { locale })}</ThemedText>
                      {oppositeGroupIds.map(authorId => {
                        const p = game.participants.find(p => p.userId === authorId);
                        return (
                          <TouchableOpacity
                            key={authorId}
                            style={styles.choiceCard}
                            onPress={() => handleAuthorSelect(comment.writerId, authorId)}
                            disabled={isSubmitting}
                            activeOpacity={0.8}
                          >
                            <ThemedText style={styles.choiceName}>{p ? getDisplayName(p.userName) : authorId}</ThemedText>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}

                  {phase === 'done' && (
                    <ThemedText style={styles.doneText}>{t('game.ui.clash.correctAuthor', { locale })}</ThemedText>
                  )}
                </View>
              );
            })}
            {isSubmitting && <ActivityIndicator style={{ marginTop: 8 }} color={GameColors.blue} />}
          </View>
        )}

        {isAdmin && (
          <View style={styles.adminSection}>
            <TouchableOpacity
              style={[styles.wideButton, { backgroundColor: otherGroupDone && isLastRound ? GameColors.green : GameColors.blue, shadowColor: GameColors.shadow }, isAdvancing && gameStyles.buttonDisabled]}
              onPress={handleAdvance}
              disabled={isAdvancing}
              activeOpacity={0.8}
              accessibilityRole="button"
            >
              {isAdvancing
                ? <ActivityIndicator size="small" color={GameColors.white} />
                : <IconSymbol name={otherGroupDone && isLastRound ? 'flag.checkered' : 'forward.end.fill'} size={16} color={GameColors.white} />}
              <ThemedText style={styles.wideButtonText}>{advanceLabel}</ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  phaseWrapper: { backgroundColor: 'rgba(255,80,0,0.06)', borderWidth: 1, borderColor: 'rgba(255,80,0,0.15)', borderRadius: 16, padding: 16, marginBottom: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  commentBlock: { marginBottom: 12 },
  commentCard: { padding: 16, borderRadius: 8, backgroundColor: GameColors.cardBg, borderWidth: 1, borderColor: GameColors.cardBorder, ...Platform.select({ ios: { shadowColor: GameColors.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4 }, android: { elevation: 2 } }) },
  commentCardCorrect: { borderColor: GameColors.correct, borderWidth: 2 },
  commentCardWrong: { borderColor: GameColors.incorrect, borderWidth: 2, opacity: 0.6 },
  commentText: { fontSize: 16, lineHeight: 22, fontFamily: Fonts.sans },
  pickerSection: { marginTop: 8, gap: 6 },
  pickerLabel: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.sans, marginBottom: 4 },
  choiceCard: { padding: 12, borderRadius: 8, backgroundColor: GameColors.cardBg, borderWidth: 1, borderColor: GameColors.cardBorder },
  choiceName: { fontSize: 15, fontWeight: '500', fontFamily: Fonts.sans },
  correctText: { color: GameColors.correct, fontWeight: '700', fontSize: 14, fontFamily: Fonts.sans },
  wrongText: { color: GameColors.incorrect, fontWeight: '700', fontSize: 14, fontFamily: Fonts.sans, marginTop: 4 },
  doneText: { color: GameColors.correct, fontWeight: '700', fontSize: 14, fontFamily: Fonts.sans, marginTop: 4 },
  waitingCard: { padding: 24, borderRadius: 8, backgroundColor: GameColors.cardBg, alignItems: 'center' },
  waitingText: { textAlign: 'center', opacity: 0.7, fontSize: 16, fontFamily: Fonts.sans },
  adminSection: { marginTop: 24, alignItems: 'center' },
  wideButton: { flexDirection: 'row', borderRadius: 999, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', gap: 8, ...Platform.select({ ios: { shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  wideButtonText: { color: GameColors.white, fontWeight: '600', fontSize: 15, fontFamily: Fonts.sans },
});
```

- [ ] **Step 4: Run tests**

```bash
npm test -- __tests__/ClashGuessingPhase.test.tsx --no-coverage
```
Expected: PASS — 8 tests

- [ ] **Step 5: Commit**

```bash
git add components/game/clash/ClashGuessingPhase.tsx __tests__/ClashGuessingPhase.test.tsx
git commit -m "feat: add ClashGuessingPhase with tests"
```

---

### Task 7: `ClashSetupPanel.tsx` — drag-and-drop group assignment

**Files:**
- Create: `components/game/clash/ClashSetupPanel.tsx`

This component uses React Native's built-in `PanResponder` and `Animated` — no external library needed.

- [ ] **Step 1: Implement `ClashSetupPanel.tsx`**

```typescript
// components/game/clash/ClashSetupPanel.tsx
import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ShowFancyAlertFn } from '@/components/game/GameHeader';
import { Fonts, GameColors } from '@/constants/theme';
import type { Game, ClashGroup, Participant } from '@/contexts/GameContext';
import { useGame } from '@/contexts/GameContext';
import { useSound } from '@/contexts/SoundContext';
import { t } from '@/i18n';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useRef, useState } from 'react';
import {
  Animated, LayoutRectangle, PanResponder, Platform,
  StyleSheet, TouchableOpacity, View,
} from 'react-native';

interface Props {
  game: Game;
  locale: string;
  isDark: boolean;
  getDisplayName: (name: string) => string;
  isAdmin: boolean;
  showFancyAlert?: ShowFancyAlertFn;
}

function isInBounds(x: number, y: number, bounds: LayoutRectangle): boolean {
  return x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height;
}

export const ClashSetupPanel: React.FC<Props> = ({
  game, locale, getDisplayName, isAdmin, showFancyAlert,
}) => {
  const { saveClashGroups, startClashGame } = useGame();
  const { playSound } = useSound();

  const [groupAIds, setGroupAIds] = useState<string[]>(game.clashData?.groupA?.memberIds ?? []);
  const [groupBIds, setGroupBIds] = useState<string[]>(game.clashData?.groupB?.memberIds ?? []);
  const [leaderAId, setLeaderAId] = useState<string | null>(game.clashData?.groupA?.leaderId ?? null);
  const [leaderBId, setLeaderBId] = useState<string | null>(game.clashData?.groupB?.leaderId ?? null);
  const [isSaving, setIsSaving] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const allIds = game.participants.map(p => p.userId);
  const unassignedIds = allIds.filter(id => !groupAIds.includes(id) && !groupBIds.includes(id));

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const dragAnim = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dragStartPage = useRef({ x: 0, y: 0 });

  // Column layout refs (absolute page coordinates)
  const colABounds = useRef<LayoutRectangle | null>(null);
  const colBBounds = useRef<LayoutRectangle | null>(null);
  const colARef = useRef<View>(null);
  const colBRef = useRef<View>(null);

  const measureColumns = useCallback(() => {
    colARef.current?.measure((_x, _y, width, height, pageX, pageY) => {
      colABounds.current = { x: pageX, y: pageY, width, height };
    });
    colBRef.current?.measure((_x, _y, width, height, pageX, pageY) => {
      colBBounds.current = { x: pageX, y: pageY, width, height };
    });
  }, []);

  const assignToGroup = useCallback(async (playerId: string, group: 'a' | 'b' | null) => {
    let newA = groupAIds.filter(id => id !== playerId);
    let newB = groupBIds.filter(id => id !== playerId);
    let newLeaderA = leaderAId === playerId ? null : leaderAId;
    let newLeaderB = leaderBId === playerId ? null : leaderBId;
    if (group === 'a') newA = [...newA, playerId];
    if (group === 'b') newB = [...newB, playerId];
    setGroupAIds(newA);
    setGroupBIds(newB);
    setLeaderAId(newLeaderA);
    setLeaderBId(newLeaderB);
    if (!isAdmin) return;
    if (newA.length > 0 && newB.length > 0 && newA.length === newB.length && newLeaderA && newLeaderB) {
      try {
        setIsSaving(true);
        await saveClashGroups(
          { leaderId: newLeaderA, memberIds: newA },
          { leaderId: newLeaderB, memberIds: newB },
        );
      } catch (_) { /* non-blocking */ } finally {
        setIsSaving(false);
      }
    }
  }, [groupAIds, groupBIds, leaderAId, leaderBId, isAdmin, saveClashGroups]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => dragId !== null,
      onMoveShouldSetPanResponder: () => dragId !== null,
      onPanResponderMove: (evt) => {
        dragAnim.setValue({
          x: evt.nativeEvent.pageX - dragStartPage.current.x,
          y: evt.nativeEvent.pageY - dragStartPage.current.y,
        });
      },
      onPanResponderRelease: (evt) => {
        const { pageX, pageY } = evt.nativeEvent;
        const id = dragId;
        setDragId(null);
        dragAnim.setValue({ x: 0, y: 0 });
        if (!id) return;
        if (colABounds.current && isInBounds(pageX, pageY, colABounds.current)) {
          assignToGroup(id, 'a');
        } else if (colBBounds.current && isInBounds(pageX, pageY, colBBounds.current)) {
          assignToGroup(id, 'b');
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderTerminate: () => {
        setDragId(null);
        dragAnim.setValue({ x: 0, y: 0 });
      },
    })
  ).current;

  const startDrag = (playerId: string, pageX: number, pageY: number) => {
    dragStartPage.current = { x: pageX, y: pageY };
    dragAnim.setValue({ x: 0, y: 0 });
    setDragId(playerId);
    measureColumns();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const toggleLeader = async (playerId: string, group: 'a' | 'b') => {
    const newLeaderA = group === 'a' ? (leaderAId === playerId ? null : playerId) : leaderAId;
    const newLeaderB = group === 'b' ? (leaderBId === playerId ? null : playerId) : leaderBId;
    setLeaderAId(newLeaderA);
    setLeaderBId(newLeaderB);
    if (!isAdmin) return;
    if (groupAIds.length === groupBIds.length && groupAIds.length > 0 && newLeaderA && newLeaderB) {
      try {
        setIsSaving(true);
        await saveClashGroups(
          { leaderId: newLeaderA, memberIds: groupAIds },
          { leaderId: newLeaderB, memberIds: groupBIds },
        );
      } catch (_) { /* non-blocking */ } finally {
        setIsSaving(false);
      }
    }
  };

  const canStart = isAdmin
    && groupAIds.length > 0
    && groupAIds.length === groupBIds.length
    && leaderAId !== null
    && leaderBId !== null;

  const handleStart = async () => {
    try {
      setIsStarting(true);
      await playSound('gameStart');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await startClashGame();
      await playSound('success');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      await playSound('error');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showFancyAlert?.(t('common.error', { locale }), (err instanceof Error && err.message) || t('common.error', { locale }));
    } finally {
      setIsStarting(false);
    }
  };

  const renderPlayerCard = (participant: Participant, group: 'a' | 'b' | 'pool') => {
    const playerId = participant.userId;
    const isLeader = (group === 'a' && leaderAId === playerId) || (group === 'b' && leaderBId === playerId);
    const isDragging = dragId === playerId;

    return (
      <TouchableOpacity
        key={playerId}
        style={[styles.playerCard, isLeader && styles.playerCardLeader, isDragging && styles.playerCardDragging]}
        onLongPress={(e) => {
          if (!isAdmin) return;
          startDrag(playerId, e.nativeEvent.pageX, e.nativeEvent.pageY);
        }}
        onPress={() => {
          if (!isAdmin) return;
          if (group !== 'pool') toggleLeader(playerId, group);
        }}
        delayLongPress={300}
        activeOpacity={0.8}
      >
        <ThemedText style={styles.playerName}>{getDisplayName(participant.userName)}</ThemedText>
        {isLeader && <IconSymbol name="crown.fill" size={14} color={GameColors.gold} />}
        {group !== 'pool' && !isLeader && isAdmin && (
          <ThemedText style={styles.tapLeaderHint}>{t('game.ui.clash.assignLeader', { locale })}</ThemedText>
        )}
      </TouchableOpacity>
    );
  };

  const draggedParticipant = dragId ? game.participants.find(p => p.userId === dragId) : null;

  return (
    <View style={styles.container} {...(dragId ? panResponder.panHandlers : {})}>
      {/* Unassigned pool */}
      {unassignedIds.length > 0 && (
        <View style={styles.pool}>
          <ThemedText style={styles.poolLabel}>{t('game.ui.clash.unassigned', { locale })}</ThemedText>
          <View style={styles.poolRow}>
            {unassignedIds.map(id => {
              const p = game.participants.find(pt => pt.userId === id)!;
              return renderPlayerCard(p, 'pool');
            })}
          </View>
        </View>
      )}

      {/* Two columns */}
      <View style={styles.columnsRow}>
        <View
          ref={colARef}
          style={[styles.column, styles.columnA]}
          onLayout={measureColumns}
        >
          <ThemedText style={styles.columnLabel}>{t('game.ui.clash.groupA', { locale })}</ThemedText>
          {groupAIds.map(id => {
            const p = game.participants.find(pt => pt.userId === id)!;
            return renderPlayerCard(p, 'a');
          })}
          {groupAIds.length === 0 && (
            <ThemedText style={styles.emptyHint}>↑ drag here</ThemedText>
          )}
        </View>

        <View
          ref={colBRef}
          style={[styles.column, styles.columnB]}
          onLayout={measureColumns}
        >
          <ThemedText style={styles.columnLabel}>{t('game.ui.clash.groupB', { locale })}</ThemedText>
          {groupBIds.map(id => {
            const p = game.participants.find(pt => pt.userId === id)!;
            return renderPlayerCard(p, 'b');
          })}
          {groupBIds.length === 0 && (
            <ThemedText style={styles.emptyHint}>↑ drag here</ThemedText>
          )}
        </View>
      </View>

      {/* Equal size warning */}
      {groupAIds.length !== groupBIds.length && groupAIds.length > 0 && groupBIds.length > 0 && (
        <ThemedText style={styles.warning}>{t('game.ui.clash.equalSizeWarning', { locale })}</ThemedText>
      )}

      {/* Start button */}
      {isAdmin && (
        <View style={styles.startWrapper}>
          <TouchableOpacity
            style={[styles.startButton, !canStart && styles.startButtonDisabled]}
            onPress={handleStart}
            disabled={!canStart || isStarting}
            activeOpacity={0.8}
            accessibilityRole="button"
          >
            <IconSymbol name="arrow.right.circle.fill" size={16} color={GameColors.white} />
            <ThemedText style={styles.startButtonText}>{t('game.ui.clash.startGame', { locale })}</ThemedText>
          </TouchableOpacity>
          {isSaving && <ThemedText style={styles.savingHint}>saving…</ThemedText>}
        </View>
      )}

      {/* Drag ghost card */}
      {dragId && draggedParticipant && (
        <Animated.View
          style={[
            styles.ghostCard,
            { transform: dragAnim.getTranslateTransform() },
          ]}
          pointerEvents="none"
        >
          <ThemedText style={styles.ghostName}>{getDisplayName(draggedParticipant.userName)}</ThemedText>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { position: 'relative' },
  pool: { marginBottom: 16 },
  poolLabel: { fontSize: 12, opacity: 0.6, fontFamily: Fonts.sans, marginBottom: 6 },
  poolRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  columnsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  column: { flex: 1, borderRadius: 12, padding: 10, minHeight: 80, borderWidth: 1 },
  columnA: { backgroundColor: 'rgba(0,122,255,0.06)', borderColor: 'rgba(0,122,255,0.2)' },
  columnB: { backgroundColor: 'rgba(175,82,222,0.06)', borderColor: 'rgba(175,82,222,0.2)' },
  columnLabel: { fontSize: 13, fontWeight: '700', fontFamily: Fonts.sans, marginBottom: 8, textAlign: 'center' },
  emptyHint: { textAlign: 'center', opacity: 0.4, fontSize: 12, fontFamily: Fonts.sans, marginTop: 8 },
  playerCard: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 10, borderRadius: 8, backgroundColor: GameColors.cardBg, borderWidth: 1, borderColor: GameColors.cardBorder, marginBottom: 6 },
  playerCardLeader: { borderColor: GameColors.gold, borderWidth: 2 },
  playerCardDragging: { opacity: 0.3 },
  playerName: { fontSize: 14, fontWeight: '600', fontFamily: Fonts.sans, flex: 1 },
  tapLeaderHint: { fontSize: 10, opacity: 0.5, fontFamily: Fonts.sans },
  warning: { color: GameColors.danger, fontSize: 12, textAlign: 'center', marginBottom: 8, fontFamily: Fonts.sans },
  startWrapper: { alignItems: 'center', marginTop: 8, gap: 4 },
  startButton: { flexDirection: 'row', borderRadius: 999, paddingVertical: 14, paddingHorizontal: 24, backgroundColor: GameColors.green, alignItems: 'center', gap: 8, ...Platform.select({ ios: { shadowColor: GameColors.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  startButtonDisabled: { opacity: 0.4 },
  startButtonText: { color: GameColors.white, fontWeight: '600', fontSize: 15, fontFamily: Fonts.sans },
  savingHint: { fontSize: 11, opacity: 0.5, fontFamily: Fonts.sans },
  ghostCard: { position: 'absolute', top: 0, left: 0, padding: 10, borderRadius: 8, backgroundColor: GameColors.blue, zIndex: 999, minWidth: 80 },
  ghostName: { color: GameColors.white, fontWeight: '700', fontFamily: Fonts.sans },
});
```

- [ ] **Step 2: Commit**

```bash
git add components/game/clash/ClashSetupPanel.tsx
git commit -m "feat: add ClashSetupPanel with drag-and-drop group assignment"
```

---

### Task 8: `ClashScreen.tsx` + wire up GameScreen and WaitingPhase

**Files:**
- Create: `components/game/clash/ClashScreen.tsx`
- Modify: `components/game/GameScreen.tsx`
- Modify: `components/game/mirror/WaitingPhase.tsx`

- [ ] **Step 1: Create `ClashScreen.tsx`**

```typescript
// components/game/clash/ClashScreen.tsx
import type { Game } from '@/contexts/GameContext';
import React from 'react';
import { ClashGuessingPhase } from './ClashGuessingPhase';
import { ClashWritingPhase } from './ClashWritingPhase';

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

export const ClashScreen: React.FC<Props> = (props) => {
  const { game } = props;
  if (game.status === 'clash_writing') return <ClashWritingPhase {...props} />;
  if (game.status === 'clash_guessing') return <ClashGuessingPhase {...props} />;
  return null;
};
```

- [ ] **Step 2: Add `ClashScreen` routing in `GameScreen.tsx`**

Add the import at the top of `GameScreen.tsx` (after the `BasketScreen` import):
```typescript
import { ClashScreen } from '@/components/game/clash/ClashScreen';
```

After the `BasketScreen` block (around line 206), add:
```tsx
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
```

- [ ] **Step 3: Update `WaitingPhase.tsx` to support clash gameType**

In `WaitingPhase.tsx`, add the `ClashSetupPanel` import at the top:
```typescript
import { ClashSetupPanel } from '@/components/game/clash/ClashSetupPanel';
```

Update the destructure from `useGame()` (line 50) to add `startClashGame`:
```typescript
const { playSound } = useSound();
const { loading, startGame, startBasketGame, startClashGame, updateAdminWritesComments, updateShowSurnames, updateTargetSelectionMode, updateShowGuessResults, setGameType } = useGame();
```

Update `handleStartGame` to handle the `clash` type:
```typescript
const handleStartGame = async () => {
  try {
    await playSound('gameStart');
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (game.gameType === 'basket') {
      await startBasketGame();
    } else if (game.gameType === 'clash') {
      await startClashGame();
    } else {
      await startGame();
    }
    await playSound('success');
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch (error: unknown) {
    await playSound('error');
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    showFancyAlert(t('common.error', { locale }), (error instanceof Error && error.message) || t('game.alerts.startGameFailed', { locale }));
  }
};
```

Replace the disabled "clash" `View` button in the game type selector with a real `TouchableOpacity`:
```tsx
<TouchableOpacity
  style={[
    styles.gameTypeButton,
    game.gameType === 'clash' && styles.gameTypeButtonActive,
  ]}
  onPress={() => setGameType('clash')}
  activeOpacity={0.8}
>
  <ThemedText style={[
    styles.gameTypeButtonText,
    game.gameType === 'clash' && styles.gameTypeButtonTextActive,
  ]}>
    {t('game.ui.gameTypeClash', { locale })}
  </ThemedText>
</TouchableOpacity>
```

Remove the `gameTypeButtonDisabled`, `gameTypeButtonTextDisabled`, and `gameTypeSoon` styles (they're no longer used).

After the admin settings toggles block (after the `TargetControlPanel` block, around line 313), add the `ClashSetupPanel` — shown only when `gameType === 'clash'` and admin:
```tsx
{isAdmin && game.gameType === 'clash' && (
  <ClashSetupPanel
    game={game}
    locale={locale}
    isDark={isDark}
    getDisplayName={getDisplayName}
    isAdmin={isAdmin}
    showFancyAlert={showFancyAlert}
  />
)}
```

Hide the regular start button when `gameType === 'clash'` (ClashSetupPanel has its own):
```tsx
{isAdmin && game.gameType !== 'clash' && (
  <View style={styles.buttonWrapper}>
    <TouchableOpacity
      style={[...]}
      onPress={handleStartGame}
      ...
    >
```

- [ ] **Step 4: Run all basket + clash tests to confirm nothing broke**

```bash
npm test -- __tests__/BasketWritingPhase.test.tsx __tests__/BasketGuessingPhase.test.tsx __tests__/ClashWritingPhase.test.tsx __tests__/ClashGuessingPhase.test.tsx __tests__/clashSchedule.test.ts --no-coverage
```
Expected: PASS — all tests green

- [ ] **Step 5: Commit**

```bash
git add components/game/clash/ClashScreen.tsx components/game/GameScreen.tsx components/game/mirror/WaitingPhase.tsx
git commit -m "feat: wire up ClashScreen routing and ClashSetupPanel in WaitingPhase"
```

---

## Self-Review

**Spec coverage check:**
- ✅ `generateClashSchedule` — Task 1
- ✅ ClashData interfaces, status/gameType union, theme colors, i18n — Task 2
- ✅ All 7 GameContext methods — Task 3
- ✅ `ClashScoreboard` — Task 4
- ✅ `ClashWritingPhase` + tests — Task 5
- ✅ `ClashGuessingPhase` + tests — Task 6
- ✅ `ClashSetupPanel` drag-and-drop — Task 7
- ✅ `ClashScreen` router, GameScreen routing, WaitingPhase wiring — Task 8
- ✅ Reveal button blocked until both groups 100% — Task 5 (`!allSubmitted`)
- ✅ `lastGroupToFinish` sets `currentGuessingGroup` on reveal — Task 3
- ✅ Team scoring in `clashData.teamScores` separate from `game.scores` — Task 3
- ✅ Equal group size enforced in `saveClashGroups` and `startClashGame` — Task 3

**Type consistency:** All methods use `ClashAssignment`, `ClashComment`, `ClashGuess`, `ClashGroup`, `ClashData` as defined in Task 2. `ClashGuessingPhase` imports `ClashComment` and `ClashGuess` from `GameContext`. `ClashWritingPhase` imports `ClashAssignment`. `ClashSetupPanel` imports `ClashGroup` and `Participant`. All consistent.

**No placeholders found.**
