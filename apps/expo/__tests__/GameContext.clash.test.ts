import { act, renderHook } from '@testing-library/react-native';
import React from 'react';
import { GameProvider, useGame } from '../contexts/GameContext';

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'leader-a', displayName: 'LeaderA', email: 'leadera@example.com' },
    isSignedIn: true,
  }),
}));

const PLAYERS = [
  { userId: 'leader-a', userName: 'LeaderA', userEmail: 'leadera@example.com', joinedAt: new Date() },
  { userId: 'member-a', userName: 'MemberA', userEmail: 'membera@example.com', joinedAt: new Date() },
  { userId: 'leader-b', userName: 'LeaderB', userEmail: 'leaderb@example.com', joinedAt: new Date() },
  { userId: 'member-b', userName: 'MemberB', userEmail: 'memberb@example.com', joinedAt: new Date() },
];

const BASE_GAME = {
  adminId: 'admin-uid', adminName: 'Admin', adminEmail: 'admin@example.com',
  status: 'clash_guessing', participants: PLAYERS,
  rounds: [], scores: {}, guessingData: { commentsByTarget: {}, possibleAuthors: [] },
  guessResults: {}, createdAt: new Date(), currentRound: null, gameType: 'clash',
};

beforeEach(() => {
  const config = require('@/config/firebase');
  config.auth.currentUser = { uid: 'leader-a', displayName: 'LeaderA', email: 'leadera@example.com', photoURL: null };
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

function mockTransactionOn(mockTxn: { get: jest.Mock; update: jest.Mock }, gameData: object) {
  const f = require('firebase/firestore');
  mockTxn.get.mockResolvedValue({ exists: () => true, id: 'game-abc', data: () => gameData });
  mockTxn.update.mockClear();
  f.runTransaction.mockImplementation(async (_db: unknown, cb: (t: typeof mockTxn) => Promise<void>) => {
    await cb(mockTxn);
  });
}

// ── submitClashGuess ────────────────────────────────────────────────────────
// Regression coverage: this used to read clashData from the client's cached
// currentGame and write currentRoundGuessesA/B back as a plain full-array
// replace (not arrayUnion) outside a transaction — the same class of bug that
// silently dropped a basket player's already-submitted guess in production.
describe('submitClashGuess', () => {
  const COMMENTS_B = [
    { writerId: 'member-b', subjectId: 'leader-a', text: 'about leader-a', submittedAt: 1 },
  ];
  const game = {
    ...BASE_GAME,
    clashData: {
      groupA: { leaderId: 'leader-a', memberIds: ['leader-a', 'member-a'] },
      groupB: { leaderId: 'leader-b', memberIds: ['leader-b', 'member-b'] },
      schedule: [{ assignmentsA: [], assignmentsB: [] }],
      currentRoundIndex: 0,
      currentRoundCommentsA: [],
      currentRoundCommentsB: COMMENTS_B,
      lastGroupToFinish: null,
      currentGuessingGroup: 'a',
      currentRoundGuessesA: [],
      currentRoundGuessesB: [],
      teamScores: { a: 0, b: 0 },
    },
  };
  const mockTxn = { get: jest.fn(), update: jest.fn() };

  it('awards a team point and records subjectCorrect:true for a correct guess', async () => {
    const { result } = await enterWithGame(game);
    mockTransactionOn(mockTxn, game);

    await act(async () => { await result.current.submitClashGuess('member-b', 'leader-a'); });

    expect(mockTxn.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        'clashData.teamScores.a': 1,
        'scores.leader-a': 1,
        'clashData.currentRoundGuessesA': expect.arrayContaining([
          expect.objectContaining({ commentWriterId: 'member-b', subjectCorrect: true }),
        ]),
      }),
    );
  });

  it('throws when someone other than the active leader submits a guess', async () => {
    const config = require('@/config/firebase');
    config.auth.currentUser = { uid: 'member-a', displayName: 'MemberA', email: 'membera@example.com', photoURL: null };
    const { result } = await enterWithGame(game);
    mockTransactionOn(mockTxn, game);

    await expect(
      act(async () => { await result.current.submitClashGuess('member-b', 'leader-a'); })
    ).rejects.toThrow('Only the active leader can submit guesses');
  });

  it('reads guesses fresh from the transaction, not from stale local state', async () => {
    // Local currentGame (seeded via enterWithGame) has an empty
    // currentRoundGuessesA, but by the time this transaction actually runs,
    // a guess for a different comment has already landed on the server. The
    // fresh read must be what's used, so that entry survives the write.
    const otherGuess = { commentWriterId: 'other-writer', guessedSubjectId: 'x', subjectCorrect: false, pointsAwarded: 0 };
    const { result } = await enterWithGame(game);
    mockTransactionOn(mockTxn, {
      ...game,
      clashData: { ...game.clashData, currentRoundGuessesA: [otherGuess] },
    });

    await act(async () => { await result.current.submitClashGuess('member-b', 'leader-a'); });

    const arg = mockTxn.update.mock.calls[0][1];
    expect(arg['clashData.currentRoundGuessesA']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ commentWriterId: 'other-writer' }),
        expect.objectContaining({ commentWriterId: 'member-b' }),
      ]),
    );
  });
});

// ── submitClashAuthorGuess ───────────────────────────────────────────────────
describe('submitClashAuthorGuess', () => {
  const existingGuess = { commentWriterId: 'member-b', guessedSubjectId: 'leader-a', subjectCorrect: true, pointsAwarded: 1 };
  const game = {
    ...BASE_GAME,
    clashData: {
      groupA: { leaderId: 'leader-a', memberIds: ['leader-a', 'member-a'] },
      groupB: { leaderId: 'leader-b', memberIds: ['leader-b', 'member-b'] },
      schedule: [{ assignmentsA: [], assignmentsB: [] }],
      currentRoundIndex: 0,
      currentRoundCommentsA: [],
      currentRoundCommentsB: [{ writerId: 'member-b', subjectId: 'leader-a', text: 'x', submittedAt: 1 }],
      lastGroupToFinish: null,
      currentGuessingGroup: 'a',
      currentRoundGuessesA: [existingGuess],
      currentRoundGuessesB: [],
      teamScores: { a: 1, b: 0 },
    },
  };
  const mockTxn = { get: jest.fn(), update: jest.fn() };

  it('awards an additional team point for a correct author guess', async () => {
    const { result } = await enterWithGame(game);
    mockTransactionOn(mockTxn, game);

    await act(async () => { await result.current.submitClashAuthorGuess('member-b', 'member-b'); });

    const arg = mockTxn.update.mock.calls[0][1];
    expect(arg['clashData.teamScores.a']).toBe(2);
    expect(arg['scores.leader-a']).toBe(1);
    const updated = arg['clashData.currentRoundGuessesA'].find((g: any) => g.commentWriterId === 'member-b');
    expect(updated.authorCorrect).toBe(true);
  });

  it('throws "Cannot guess author without a correct subject guess" when the fresh transaction read has no correct subject guess yet', async () => {
    // Local currentGame already shows the correct subject guess (from
    // enterWithGame), but a fresh transaction read shows it hasn't actually
    // landed on the server — the guard must trust the fresh read.
    const { result } = await enterWithGame(game);
    mockTransactionOn(mockTxn, {
      ...game,
      clashData: { ...game.clashData, currentRoundGuessesA: [] },
    });

    await expect(
      act(async () => { await result.current.submitClashAuthorGuess('member-b', 'member-b'); })
    ).rejects.toThrow('Cannot guess author without a correct subject guess');
  });

  it('does not drop a concurrently-recorded guess for another comment when writing the updated array', async () => {
    const otherGuess = { commentWriterId: 'other-writer', guessedSubjectId: 'x', subjectCorrect: false, pointsAwarded: 0 };
    const { result } = await enterWithGame(game);
    mockTransactionOn(mockTxn, {
      ...game,
      clashData: { ...game.clashData, currentRoundGuessesA: [existingGuess, otherGuess] },
    });

    await act(async () => { await result.current.submitClashAuthorGuess('member-b', 'member-b'); });

    const arg = mockTxn.update.mock.calls[0][1];
    expect(arg['clashData.currentRoundGuessesA']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ commentWriterId: 'other-writer' }),
        expect.objectContaining({ commentWriterId: 'member-b', guessedAuthorId: 'member-b' }),
      ]),
    );
  });

  it('throws when an author guess was already submitted for this comment', async () => {
    const alreadyDone = { ...existingGuess, guessedAuthorId: 'member-b', authorCorrect: true, pointsAwarded: 2 };
    const { result } = await enterWithGame(game);
    mockTransactionOn(mockTxn, {
      ...game,
      clashData: { ...game.clashData, currentRoundGuessesA: [alreadyDone] },
    });

    await expect(
      act(async () => { await result.current.submitClashAuthorGuess('member-b', 'leader-a'); })
    ).rejects.toThrow('Author already guessed');
  });
});
