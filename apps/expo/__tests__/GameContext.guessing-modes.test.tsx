// TDD – 5.5: Per-round vs final guessing mode.
//
// startGuessingPhase has two branches:
//   A) Per-round:  currentRound is completed (commentsVisible && pointsGiven)
//                  → writes guessingData.singleRoundTargetId
//                  → commentsByTarget contains only that round's comments
//
//   B) Final:      currentRound is NOT completed (legacy / multi-round guessing)
//                  → no singleRoundTargetId
//                  → commentsByTarget contains ALL completed rounds' comments
//
// finalizeGuessingPhase has two branches:
//   A) Per-round:  singleRoundTargetId is set → status returns to 'active'
//                  → only that round's guessesFinalized is set to true
//
//   B) Final:      no singleRoundTargetId → status becomes 'finished'
//                  → all rounds get guessesFinalized: true
//
// The integration test covers branch B for both functions (but is currently broken
// for unrelated reasons). This file covers branch A.
import { act, renderHook } from '@testing-library/react-native';
import React from 'react';
import { GameProvider, useGame } from '../contexts/GameContext';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'admin-uid', displayName: 'Admin', email: 'admin@test.com', photoURL: null },
    isSignedIn: true,
  }),
}));

jest.mock('@/config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'admin-uid' }, signOut: jest.fn(() => Promise.resolve()) },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <GameProvider>{children}</GameProvider>
);

const ADMIN  = { userId: 'admin-uid',  userName: 'Admin',    userEmail: 'admin@test.com', joinedAt: new Date(1000) };
const PLAYER = { userId: 'player-uid', userName: 'Player',   userEmail: 'p@test.com',     joinedAt: new Date(2000) };

const COMMENT = { id: 'c1', authorId: 'admin-uid', text: 'Nice work', submittedAt: new Date() };

const COMPLETED_ROUND = {
  roundNumber: 1,
  targetUserId: 'player-uid',
  targetUserName: 'Player',
  comments: [COMMENT],
  commentsVisible: true,
  pointsGiven: true,
  startedAt: new Date(),
};

function makeGameDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'game-x',
    adminId: 'admin-uid',
    adminName: 'Admin',
    adminEmail: 'admin@test.com',
    status: 'active',
    participants: [ADMIN, PLAYER],
    rounds: [],
    scores: {},
    guessingData: { commentsByTarget: {}, possibleAuthors: [], playersWhoSubmittedGuesses: [], allPlayersSubmitted: false },
    guessResults: {},
    createdAt: new Date(),
    currentRound: null,
    adminWritesComments: false,
    showSurnames: false,
    showGuessResults: false,
    targetSelectionMode: 'random',
    adminSkippedTargets: [],
    adminNextTargetPreference: null,
    playersWhoCompletedPostCommentPhase: [],
    ...overrides,
  };
}

function makeSnap(data: Record<string, unknown>, id = 'game-x') {
  return { exists: () => true, id, data: () => data };
}

function setupEnterGame(
  firestore: ReturnType<typeof require>,
  gameDoc: Record<string, unknown>,
) {
  firestore.doc.mockReturnValue({ path: 'games/game-x' });
  firestore.setDoc.mockResolvedValue(undefined);
  firestore.updateDoc.mockResolvedValue(undefined);
  firestore.serverTimestamp.mockReturnValue(new Date());
  firestore.arrayUnion.mockImplementation((v: unknown) => v);
  firestore.onSnapshot.mockReturnValue(jest.fn());

  firestore.getDoc
    .mockResolvedValueOnce({ exists: () => true, data: () => ({ password: 'SECRET' }) })
    .mockResolvedValueOnce({ exists: () => false });

  firestore.onSnapshot.mockImplementationOnce((_ref: unknown, cb: (s: unknown) => void) => {
    cb(makeSnap(gameDoc));
    return jest.fn();
  });
}

// ─── startGuessingPhase — per-round path ──────────────────────────────────────

describe('startGuessingPhase — 5.5 per-round path (completed currentRound)', () => {
  // Game state: one completed round, currentRound is marked commentsVisible && pointsGiven.
  // startGuessingPhase should take the per-round branch.
  const gameDoc = makeGameDoc({
    status: 'active',
    currentRound: COMPLETED_ROUND,
    rounds: [COMPLETED_ROUND],
  });

  it('writes singleRoundTargetId into guessingData', async () => {
    const firestore = require('firebase/firestore');
    setupEnterGame(firestore, gameDoc);
    // getDoc called inside startGuessingPhase to fetch fresh game state
    firestore.getDoc.mockResolvedValueOnce(makeSnap(gameDoc));

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.startGuessingPhase(); });

    const guessingWrite = firestore.updateDoc.mock.calls.find(
      (call: unknown[]) => (call[1] as Record<string, unknown>).guessingData != null &&
        (call[1] as Record<string, unknown>).status === 'guessing_phase',
    );
    expect(guessingWrite).toBeDefined();
    const written = (guessingWrite![1] as { guessingData: { singleRoundTargetId: string } }).guessingData;
    expect(written.singleRoundTargetId).toBe('player-uid');
  });

  it('sets commentsByTarget to only the completed round\'s target', async () => {
    const firestore = require('firebase/firestore');
    setupEnterGame(firestore, gameDoc);
    firestore.getDoc.mockResolvedValueOnce(makeSnap(gameDoc));

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.startGuessingPhase(); });

    const guessingWrite = firestore.updateDoc.mock.calls.find(
      (call: unknown[]) => (call[1] as Record<string, unknown>).status === 'guessing_phase',
    );
    const commentsByTarget = (
      guessingWrite![1] as { guessingData: { commentsByTarget: Record<string, unknown[]> } }
    ).guessingData.commentsByTarget;
    // Only the current round's target key should exist
    expect(Object.keys(commentsByTarget)).toEqual(['player-uid']);
    expect(commentsByTarget['player-uid']).toHaveLength(1);
  });
});

// ─── startGuessingPhase — final path ─────────────────────────────────────────

describe('startGuessingPhase — 5.5 final path (no completed currentRound)', () => {
  // Game: two completed rounds saved in `rounds`, currentRound = null.
  const ROUND_2 = {
    roundNumber: 2,
    targetUserId: 'admin-uid',
    targetUserName: 'Admin',
    comments: [{ id: 'c2', authorId: 'player-uid', text: 'Good leader', submittedAt: new Date() }],
    commentsVisible: true,
    pointsGiven: true,
    startedAt: new Date(),
  };
  const gameDoc = makeGameDoc({
    status: 'active',
    currentRound: null,  // NOT a completed round in-place → final path
    rounds: [COMPLETED_ROUND, ROUND_2],
    adminWritesComments: true, // so admin is also a non-target player (needed for check to pass)
    playersWhoCompletedPostCommentPhase: ['admin-uid', 'player-uid'],
  });

  it('does NOT write singleRoundTargetId in the final path', async () => {
    const firestore = require('firebase/firestore');
    setupEnterGame(firestore, gameDoc);
    firestore.getDoc.mockResolvedValueOnce(makeSnap(gameDoc));

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.startGuessingPhase(); });

    const guessingWrite = firestore.updateDoc.mock.calls.find(
      (call: unknown[]) => (call[1] as Record<string, unknown>).status === 'guessing_phase',
    );
    expect(guessingWrite).toBeDefined();
    const guessingData = (guessingWrite![1] as { guessingData: Record<string, unknown> }).guessingData;
    expect(guessingData.singleRoundTargetId).toBeUndefined();
  });

  it('sets commentsByTarget for all completed rounds in the final path', async () => {
    const firestore = require('firebase/firestore');
    setupEnterGame(firestore, gameDoc);
    firestore.getDoc.mockResolvedValueOnce(makeSnap(gameDoc));

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.startGuessingPhase(); });

    const guessingWrite = firestore.updateDoc.mock.calls.find(
      (call: unknown[]) => (call[1] as Record<string, unknown>).status === 'guessing_phase',
    );
    const commentsByTarget = (
      guessingWrite![1] as { guessingData: { commentsByTarget: Record<string, unknown[]> } }
    ).guessingData.commentsByTarget;
    // Both rounds' targets should be present
    expect(Object.keys(commentsByTarget).sort()).toEqual(['admin-uid', 'player-uid']);
  });
});

// ─── finalizeGuessingPhase — per-round path ───────────────────────────────────

describe('finalizeGuessingPhase — 5.5 per-round path (singleRoundTargetId set)', () => {
  const ROUND_A = {
    roundNumber: 1,
    targetUserId: 'player-uid',
    targetUserName: 'Player',
    comments: [COMMENT],
    commentsVisible: true,
    pointsGiven: true,
    startedAt: new Date(),
    guesses: [
      { commentId: 'c1', guesserId: 'player-uid', guessedAuthorId: 'admin-uid', correct: true, guessedAt: new Date() },
    ],
  };
  const ROUND_B = {
    roundNumber: 2,
    targetUserId: 'admin-uid',
    targetUserName: 'Admin',
    comments: [],
    commentsVisible: false,
    pointsGiven: false,
    startedAt: new Date(),
  };

  const enterGameDoc = makeGameDoc({
    status: 'guessing_phase',
    currentRound: null,
    rounds: [ROUND_A, ROUND_B],
    guessingData: {
      commentsByTarget: { 'player-uid': [COMMENT] },
      possibleAuthors: [{ userId: 'admin-uid', userName: 'Admin' }],
      playersWhoSubmittedGuesses: ['player-uid'],
      allPlayersSubmitted: true,
      singleRoundTargetId: 'player-uid', // per-round marker
    },
  });

  it('sets status back to active (not finished)', async () => {
    const firestore = require('firebase/firestore');
    setupEnterGame(firestore, enterGameDoc);
    // getDoc inside finalizeGuessingPhase
    firestore.getDoc.mockResolvedValueOnce(makeSnap(enterGameDoc));

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.finalizeGuessingPhase(); });

    const finalizeWrite = firestore.updateDoc.mock.calls.find(
      (call: unknown[]) => {
        const data = call[1] as Record<string, unknown>;
        return data.status === 'active' || data.status === 'finished';
      },
    );
    expect(finalizeWrite).toBeDefined();
    expect((finalizeWrite![1] as { status: string }).status).toBe('active');
  });

  it('only stamps the guessed round with guessesFinalized, leaving others unchanged', async () => {
    const firestore = require('firebase/firestore');
    setupEnterGame(firestore, enterGameDoc);
    firestore.getDoc.mockResolvedValueOnce(makeSnap(enterGameDoc));

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.finalizeGuessingPhase(); });

    const finalizeWrite = firestore.updateDoc.mock.calls.find(
      (call: unknown[]) => (call[1] as Record<string, unknown>).rounds != null,
    );
    expect(finalizeWrite).toBeDefined();
    const writtenRounds = (finalizeWrite![1] as { rounds: Array<{ targetUserId: string; guessesFinalized?: boolean }> }).rounds;
    const guessedRound = writtenRounds.find(r => r.targetUserId === 'player-uid');
    const otherRound   = writtenRounds.find(r => r.targetUserId === 'admin-uid');
    expect(guessedRound?.guessesFinalized).toBe(true);
    expect(otherRound?.guessesFinalized).toBeFalsy();
  });
});

// ─── finalizeGuessingPhase — final path ───────────────────────────────────────

describe('finalizeGuessingPhase — 5.5 final path (no singleRoundTargetId)', () => {
  const ROUND_A = {
    roundNumber: 1,
    targetUserId: 'player-uid',
    targetUserName: 'Player',
    comments: [COMMENT],
    commentsVisible: true,
    pointsGiven: true,
    startedAt: new Date(),
    guesses: [],
  };

  const enterGameDoc = makeGameDoc({
    status: 'guessing_phase',
    currentRound: null,
    rounds: [ROUND_A],
    guessingData: {
      commentsByTarget: { 'player-uid': [COMMENT] },
      possibleAuthors: [{ userId: 'admin-uid', userName: 'Admin' }],
      playersWhoSubmittedGuesses: ['player-uid'],
      allPlayersSubmitted: true,
      // NO singleRoundTargetId — final path
    },
  });

  it('sets status to finished', async () => {
    const firestore = require('firebase/firestore');
    setupEnterGame(firestore, enterGameDoc);
    firestore.getDoc.mockResolvedValueOnce(makeSnap(enterGameDoc));

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.finalizeGuessingPhase(); });

    const finalizeWrite = firestore.updateDoc.mock.calls.find(
      (call: unknown[]) => {
        const data = call[1] as Record<string, unknown>;
        return data.status === 'active' || data.status === 'finished';
      },
    );
    expect(finalizeWrite).toBeDefined();
    expect((finalizeWrite![1] as { status: string }).status).toBe('finished');
  });

  it('stamps all rounds with guessesFinalized in the final path', async () => {
    const firestore = require('firebase/firestore');
    setupEnterGame(firestore, enterGameDoc);
    firestore.getDoc.mockResolvedValueOnce(makeSnap(enterGameDoc));

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.finalizeGuessingPhase(); });

    const finalizeWrite = firestore.updateDoc.mock.calls.find(
      (call: unknown[]) => (call[1] as Record<string, unknown>).rounds != null,
    );
    const writtenRounds = (finalizeWrite![1] as { rounds: Array<{ guessesFinalized?: boolean }> }).rounds;
    expect(writtenRounds.every(r => r.guessesFinalized === true)).toBe(true);
  });
});
