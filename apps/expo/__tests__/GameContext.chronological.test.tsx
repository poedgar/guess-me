// TDD – 5.4: targetSelectionMode: 'chronological'
//
// startNextRound must select the participant with the smallest joinedAt when
// targetSelectionMode is 'chronological', regardless of array order.
//
// Behaviours:
//   a) Chronological picks the earliest-joined available participant
//   b) After the first has been targeted, picks the next-earliest
//   c) 'random' mode is unaffected (regression)
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

// Participants intentionally NOT sorted by joinedAt so chronological must sort:
//   array order:  admin(t=1000) → player-B(t=3000) → player-A(t=2000)
//   joinedAt order: player-A(2000) < player-B(3000)
const ADMIN   = { userId: 'admin-uid', userName: 'Admin',    userEmail: 'admin@test.com', joinedAt: new Date(1000) };
const PLAYER_B = { userId: 'player-b', userName: 'Player B', userEmail: 'b@test.com',     joinedAt: new Date(3000) };
const PLAYER_A = { userId: 'player-a', userName: 'Player A', userEmail: 'a@test.com',     joinedAt: new Date(2000) };

function makeGameDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'game-x',
    adminId: 'admin-uid',
    adminName: 'Admin',
    adminEmail: 'admin@test.com',
    status: 'active',
    // Intentional: player-B before player-A so a pure-index pick differs from
    // a sort-by-joinedAt pick.
    participants: [ADMIN, PLAYER_B, PLAYER_A],
    rounds: [],
    scores: {},
    guessingData: {
      commentsByTarget: {},
      possibleAuthors: [],
      playersWhoSubmittedGuesses: [],
      allPlayersSubmitted: false,
    },
    guessResults: {},
    createdAt: new Date(),
    currentRound: null,
    adminWritesComments: false,
    showSurnames: false,
    showGuessResults: false,
    targetSelectionMode: 'chronological',
    adminSkippedTargets: [],
    adminNextTargetPreference: null,
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

  // getDoc call #1: admin password check
  // getDoc call #2: game-ID uniqueness check
  firestore.getDoc
    .mockResolvedValueOnce({ exists: () => true, data: () => ({ password: 'SECRET' }) })
    .mockResolvedValueOnce({ exists: () => false });

  // onSnapshot fires immediately so GameProvider sets currentGame
  firestore.onSnapshot.mockImplementationOnce((_ref: unknown, cb: (s: unknown) => void) => {
    cb(makeSnap(gameDoc));
    return jest.fn();
  });
}

describe('startNextRound — 5.4 chronological target selection', () => {
  let mathRandomSpy: jest.SpyInstance;

  beforeEach(() => {
    // Math.random = 0.99 → Math.floor(0.99 × 2) = 1 → array index 1.
    // Available participants after admin exclusion = [player-B, player-A].
    // A pure-index pick gives player-A (index 1, joinedAt 2000).
    // Chronological sort gives player-A too — we need the opposite ordering to
    // make the test distinguishing.
    //
    // Wait — participants order is [ADMIN, PLAYER_B, PLAYER_A], so after filtering
    // admin we get [PLAYER_B, PLAYER_A].  Index 1 → PLAYER_A.  Chronological also
    // gives PLAYER_A.  Not distinguishing.
    //
    // Fix: use Math.random = 0.1 → index 0 → PLAYER_B. Chronological → PLAYER_A.
    mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.1);
  });

  afterEach(() => {
    mathRandomSpy.mockRestore();
  });

  // ─── a) first round: pick the earliest-joined participant ──────────────────

  it('picks the earliest-joined non-admin participant in chronological mode', async () => {
    const firestore = require('firebase/firestore');
    const gameDoc = makeGameDoc(); // targetSelectionMode: 'chronological', no prior rounds
    setupEnterGame(firestore, gameDoc);

    // getDoc #3: startNextRound reads current game state from Firestore
    firestore.getDoc.mockResolvedValueOnce(makeSnap(gameDoc));

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.startNextRound(); });

    const roundWrite = firestore.updateDoc.mock.calls.find(
      (call: unknown[]) => (call[1] as Record<string, unknown>).currentRound != null,
    );
    expect(roundWrite).toBeDefined();
    // Must be player-a (joinedAt 2000) — NOT player-b (joinedAt 3000, index 0)
    const chosenId = (roundWrite![1] as { currentRound: { targetUserId: string } })
      .currentRound.targetUserId;
    expect(chosenId).toBe('player-a');
  });

  // ─── b) second round: pick next-earliest after first has been targeted ─────

  it('picks the second-earliest-joined participant after the first has been targeted', async () => {
    const firestore = require('firebase/firestore');
    const completedRound = {
      roundNumber: 1,
      targetUserId: 'player-a',
      targetUserName: 'Player A',
      comments: [],
      commentsVisible: true,
      pointsGiven: true,
      startedAt: new Date(),
    };
    // player-a already targeted → only player-b available
    const gameDoc = makeGameDoc({
      rounds: [completedRound],
      currentRound: completedRound,
    });
    setupEnterGame(firestore, gameDoc);
    firestore.getDoc.mockResolvedValueOnce(makeSnap(gameDoc));

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.startNextRound(); });

    const roundWrite = firestore.updateDoc.mock.calls.find(
      (call: unknown[]) => (call[1] as Record<string, unknown>).currentRound != null,
    );
    expect(roundWrite).toBeDefined();
    expect(
      (roundWrite![1] as { currentRound: { targetUserId: string } }).currentRound.targetUserId,
    ).toBe('player-b');
  });

  // ─── c) 'random' mode still uses Math.random (regression) ─────────────────

  it('uses Math.random for selection when targetSelectionMode is random', async () => {
    const firestore = require('firebase/firestore');
    // Math.random = 0.1 → index 0 → first available after admin = player-B
    const gameDoc = makeGameDoc({ targetSelectionMode: 'random' });
    setupEnterGame(firestore, gameDoc);
    firestore.getDoc.mockResolvedValueOnce(makeSnap(gameDoc));

    const { result } = renderHook(() => useGame(), { wrapper });
    await act(async () => { await result.current.enterGame('SECRET'); });
    await act(async () => { await result.current.startNextRound(); });

    const roundWrite = firestore.updateDoc.mock.calls.find(
      (call: unknown[]) => (call[1] as Record<string, unknown>).currentRound != null,
    );
    expect(roundWrite).toBeDefined();
    // Index 0 of [player-B, player-A] = player-B (Math.random = 0.1 → floor(0.2) = 0)
    expect(
      (roundWrite![1] as { currentRound: { targetUserId: string } }).currentRound.targetUserId,
    ).toBe('player-b');
  });
});
