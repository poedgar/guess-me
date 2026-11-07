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
  guessResults: {}, createdAt: new Date(), currentRound: null, gameType: 'basket',
};

const SCHEDULE = [
  { assignments: [
    { writerId: 'user-1', subjectId: 'user-2' },
    { writerId: 'user-2', subjectId: 'user-3' },
    { writerId: 'user-3', subjectId: 'user-1' },
  ]},
  { assignments: [
    { writerId: 'user-1', subjectId: 'user-3' },
    { writerId: 'user-2', subjectId: 'user-1' },
    { writerId: 'user-3', subjectId: 'user-2' },
  ]},
];

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

// ── startBasketGame ─────────────────────────────────────────────────────────
describe('startBasketGame', () => {
  it('is exposed by useGame', () => {
    const { result } = renderHook(() => useGame(), { wrapper });
    expect(typeof result.current.startBasketGame).toBe('function');
  });

  it('sets status basket_writing with schedule, roundIndex 0, empty arrays', async () => {
    const { result, gameDoc } = await enterWithGame(BASE_GAME);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.startBasketGame(); });

    expect(f.updateDoc).toHaveBeenCalledWith(
      gameDoc,
      expect.objectContaining({
        status: 'basket_writing',
        basketData: expect.objectContaining({
          currentRoundIndex: 0,
          currentRoundComments: [],
          currentRoundGuesses: [],
          schedule: expect.any(Array),
        }),
      }),
    );
    const arg = f.updateDoc.mock.calls[0][1];
    // N-1 rounds for N players
    expect(arg.basketData.schedule.length).toBe(PLAYERS.length - 1);
  });

  it('throws when fewer than 2 participants', async () => {
    const onePlayerGame = { ...BASE_GAME, participants: [PLAYERS[0]] };
    const { result } = await enterWithGame(onePlayerGame);
    await expect(
      act(async () => { await result.current.startBasketGame(); })
    ).rejects.toThrow();
  });
});

// ── submitBasketComment ──────────────────────────────────────────────────────
describe('submitBasketComment', () => {
  const gameWithBasket = {
    ...BASE_GAME, status: 'basket_writing',
    basketData: {
      schedule: SCHEDULE, currentRoundIndex: 0,
      currentRoundComments: [], currentRoundGuesses: [],
    },
  };

  it('appends a comment with correct writerId and subjectId', async () => {
    const { result, gameDoc } = await enterWithGame(gameWithBasket);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.submitBasketComment('hello'); });

    expect(f.updateDoc).toHaveBeenCalledWith(
      gameDoc,
      expect.objectContaining({
        'basketData.currentRoundComments': expect.objectContaining({
          writerId: 'user-1',
          subjectId: 'user-2', // per SCHEDULE round 0
          text: 'hello',
        }),
      }),
    );
  });
});

// ── revealBasketComments ─────────────────────────────────────────────────────
describe('revealBasketComments', () => {
  it('sets status to basket_guessing', async () => {
    const game = { ...BASE_GAME, status: 'basket_writing', basketData: { schedule: SCHEDULE, currentRoundIndex: 0, currentRoundComments: [], currentRoundGuesses: [] } };
    const { result, gameDoc } = await enterWithGame(game);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.revealBasketComments(); });

    expect(f.updateDoc).toHaveBeenCalledWith(gameDoc, { status: 'basket_guessing' });
  });
});

// ── submitBasketCommentGuess ─────────────────────────────────────────────────
// Uses runTransaction (not updateDoc) so a fresh read of currentRoundGuesses
// backs every write — this is what stops a concurrent author-guess write from
// clobbering another player's just-added comment-guess entry (see
// submitBasketAuthorGuess below for the entry that was actually getting lost).
describe('submitBasketCommentGuess', () => {
  const COMMENTS = [
    { writerId: 'user-2', subjectId: 'user-1', text: 'A', submittedAt: 1 },
    { writerId: 'user-3', subjectId: 'user-2', text: 'B', submittedAt: 2 },
    { writerId: 'user-1', subjectId: 'user-3', text: 'C', submittedAt: 3 },
  ];
  const game = {
    ...BASE_GAME, status: 'basket_guessing',
    basketData: { schedule: SCHEDULE, currentRoundIndex: 0, currentRoundComments: COMMENTS, currentRoundGuesses: [] },
  };
  const mockTxn = { get: jest.fn(), update: jest.fn() };

  function mockTransactionOn(gameData: object) {
    const f = require('firebase/firestore');
    mockTxn.get.mockResolvedValue({ exists: () => true, id: 'game-abc', data: () => gameData });
    mockTxn.update.mockClear();
    f.runTransaction.mockImplementation(async (_db: unknown, cb: (t: typeof mockTxn) => Promise<void>) => {
      await cb(mockTxn);
    });
  }

  it('awards 1 point and records commentCorrect:true for correct guess', async () => {
    const { result } = await enterWithGame(game);
    mockTransactionOn(game);

    // user-1's comment is written by user-2 — guess correctly
    await act(async () => { await result.current.submitBasketCommentGuess('user-2'); });

    expect(mockTxn.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        'scores.user-1': 1,
        'basketData.currentRoundGuesses': expect.arrayContaining([
          expect.objectContaining({
            guesserId: 'user-1',
            commentWriterId: 'user-2',
            commentCorrect: true,
            pointsAwarded: 1,
          }),
        ]),
      }),
    );
  });

  it('awards 0 points and records commentCorrect:false for wrong guess', async () => {
    const { result } = await enterWithGame(game);
    mockTransactionOn(game);

    // user-3 did NOT write about user-1
    await act(async () => { await result.current.submitBasketCommentGuess('user-3'); });

    const arg = mockTxn.update.mock.calls[0][1];
    expect(arg['scores.user-1']).toBeUndefined();
    expect(arg['basketData.currentRoundGuesses']).toContainEqual(
      expect.objectContaining({ commentCorrect: false, pointsAwarded: 0 }),
    );
  });

  it('reads currentRoundGuesses fresh from the transaction, not from stale local state', async () => {
    // Local `currentGame` (seeded via onSnapshot in enterWithGame) has an
    // empty currentRoundGuesses, but another player's guess has already
    // landed on the server by the time this transaction runs. The fresh
    // txn.get must be what's used to decide correctness/dedup, and that
    // other player's entry must survive in the write.
    const otherGuess = { guesserId: 'user-2', commentWriterId: 'user-3', commentCorrect: false, authorCorrect: false, pointsAwarded: 0 };
    const { result } = await enterWithGame(game);
    mockTransactionOn({ ...game, basketData: { ...game.basketData, currentRoundGuesses: [otherGuess] } });

    await act(async () => { await result.current.submitBasketCommentGuess('user-2'); });

    const arg = mockTxn.update.mock.calls[0][1];
    expect(arg['basketData.currentRoundGuesses']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ guesserId: 'user-2' }),
        expect.objectContaining({ guesserId: 'user-1', commentCorrect: true }),
      ]),
    );
  });
});

// ── submitBasketAuthorGuess ──────────────────────────────────────────────────
// Regression coverage for the production bug: a player correctly identified
// her own comment and the UI showed the author prompt (driven by local
// optimistic state), but submitBasketAuthorGuess re-derived correctness from
// the listener-synced `currentGame` and threw "Cannot guess author without a
// correct comment guess" when that lagged behind her own just-written guess.
// Separately, a full-array overwrite of currentRoundGuesses based on that same
// stale state could silently erase another player's already-committed entry,
// which is exactly why a real admin got stuck waiting on a guess that had, in
// fact, already been submitted. Both are fixed by reading fresh state inside
// a runTransaction instead of trusting the client-cached currentGame.
describe('submitBasketAuthorGuess', () => {
  const COMMENTS = [
    { writerId: 'user-2', subjectId: 'user-1', text: 'A', submittedAt: 1 },
    { writerId: 'user-1', subjectId: 'user-2', text: 'B', submittedAt: 2 },
  ];
  const existingGuess = { guesserId: 'user-1', commentWriterId: 'user-2', commentCorrect: true, authorCorrect: false, pointsAwarded: 1 };
  const game = {
    ...BASE_GAME, status: 'basket_guessing',
    participants: [PLAYERS[0], PLAYERS[1]],
    basketData: {
      schedule: [{ assignments: [{ writerId: 'user-2', subjectId: 'user-1' }, { writerId: 'user-1', subjectId: 'user-2' }] }],
      currentRoundIndex: 0, currentRoundComments: COMMENTS,
      currentRoundGuesses: [existingGuess],
    },
  };
  const mockTxn = { get: jest.fn(), update: jest.fn() };

  function mockTransactionOn(gameData: object) {
    const f = require('firebase/firestore');
    mockTxn.get.mockResolvedValue({ exists: () => true, id: 'game-abc', data: () => gameData });
    mockTxn.update.mockClear();
    f.runTransaction.mockImplementation(async (_db: unknown, cb: (t: typeof mockTxn) => Promise<void>) => {
      await cb(mockTxn);
    });
  }

  it('awards 1 additional point for correct author guess', async () => {
    const { result } = await enterWithGame(game);
    mockTransactionOn(game);

    await act(async () => { await result.current.submitBasketAuthorGuess('user-2'); });

    expect(mockTxn.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ 'scores.user-1': 1 }),
    );
    const arg = mockTxn.update.mock.calls[0][1];
    const updatedGuess = arg['basketData.currentRoundGuesses'].find((g: any) => g.guesserId === 'user-1');
    expect(updatedGuess.authorCorrect).toBe(true);
    expect(updatedGuess.pointsAwarded).toBe(2);
  });

  it('awards 0 additional points for wrong author guess', async () => {
    const { result } = await enterWithGame(game);
    mockTransactionOn(game);

    await act(async () => { await result.current.submitBasketAuthorGuess('user-3'); });

    const arg = mockTxn.update.mock.calls[0][1];
    expect(arg['scores.user-1']).toBeUndefined();
    const updatedGuess = arg['basketData.currentRoundGuesses'].find((g: any) => g.guesserId === 'user-1');
    expect(updatedGuess.authorCorrect).toBe(false);
    expect(updatedGuess.pointsAwarded).toBe(1);
  });

  it('throws "Cannot guess author without a correct comment guess" when local state is stale but the server has no correct comment guess yet for this player', async () => {
    // Local currentGame (from enterWithGame) has the correct-comment-guess
    // entry, but a fresh transaction read shows it hasn't actually landed on
    // the server yet — the guard must trust the fresh read, not local state.
    const { result } = await enterWithGame(game);
    mockTransactionOn({ ...game, basketData: { ...game.basketData, currentRoundGuesses: [] } });

    await expect(
      act(async () => { await result.current.submitBasketAuthorGuess('user-2'); })
    ).rejects.toThrow('Cannot guess author without a correct comment guess');
  });

  it('does not drop a concurrently-added comment-guess from another player when writing the updated array', async () => {
    // Simulates the exact production failure: player user-3's comment guess
    // has already landed on the server (fresh txn read), but is not present
    // in this stale scenario's baseline — proving the write is built from the
    // fresh read, so user-3's entry survives in the final array instead of
    // being silently overwritten.
    const otherPlayerGuess = { guesserId: 'user-3', commentWriterId: 'user-1', commentCorrect: false, authorCorrect: false, pointsAwarded: 0 };
    const { result } = await enterWithGame(game);
    mockTransactionOn({ ...game, basketData: { ...game.basketData, currentRoundGuesses: [existingGuess, otherPlayerGuess] } });

    await act(async () => { await result.current.submitBasketAuthorGuess('user-2'); });

    const arg = mockTxn.update.mock.calls[0][1];
    expect(arg['basketData.currentRoundGuesses']).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ guesserId: 'user-3' }),
        expect.objectContaining({ guesserId: 'user-1', authorGuessId: 'user-2' }),
      ]),
    );
  });

  it('throws when an author guess was already submitted for this round', async () => {
    const alreadyDone = { ...existingGuess, authorGuessId: 'user-2', authorCorrect: true, pointsAwarded: 2 };
    const { result } = await enterWithGame(game);
    mockTransactionOn({ ...game, basketData: { ...game.basketData, currentRoundGuesses: [alreadyDone] } });

    await expect(
      act(async () => { await result.current.submitBasketAuthorGuess('user-1'); })
    ).rejects.toThrow('Author guess already submitted for this round');
  });
});

// ── restartBasketRound ──────────────────────────────────────────────────────
describe('restartBasketRound', () => {
  const guesses = [
    { guesserId: 'user-1', commentWriterId: 'user-2', commentCorrect: true, authorCorrect: true, authorGuessId: 'user-2', pointsAwarded: 2 },
    { guesserId: 'user-2', commentWriterId: 'user-3', commentCorrect: false, authorCorrect: false, pointsAwarded: 0 },
  ];
  const game = {
    ...BASE_GAME, status: 'basket_guessing',
    scores: { 'user-1': 2, 'user-2': 5 },
    basketData: {
      schedule: SCHEDULE, currentRoundIndex: 0,
      currentRoundComments: [{ writerId: 'user-2', subjectId: 'user-1', text: 'A', submittedAt: 1 }],
      currentRoundGuesses: guesses,
    },
  };
  const mockTxn = { get: jest.fn(), update: jest.fn() };

  function mockTransactionOn(gameData: object) {
    const f = require('firebase/firestore');
    mockTxn.get.mockResolvedValue({ exists: () => true, id: 'game-abc', data: () => gameData });
    mockTxn.update.mockClear();
    f.runTransaction.mockImplementation(async (_db: unknown, cb: (t: typeof mockTxn) => Promise<void>) => {
      await cb(mockTxn);
    });
  }

  it('clears comments/guesses, sets status back to basket_writing, keeps schedule/currentRoundIndex', async () => {
    const { result } = await enterWithGame(game);
    mockTransactionOn(game);

    await act(async () => { await result.current.restartBasketRound(); });

    expect(mockTxn.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: 'basket_writing',
        'basketData.currentRoundComments': [],
        'basketData.currentRoundGuesses': [],
      }),
    );
  });

  it('rolls back each guesser\'s score by the pointsAwarded they earned this round', async () => {
    const { result } = await enterWithGame(game);
    mockTransactionOn(game);

    await act(async () => { await result.current.restartBasketRound(); });

    const arg = mockTxn.update.mock.calls[0][1];
    // user-1 earned 2 points this round (2 -> 0), user-2 earned 0 (5 -> 5, no key written)
    expect(arg['scores.user-1']).toBe(0);
    expect(arg['scores.user-2']).toBeUndefined();
  });

  it('is a safe no-op when nothing was submitted yet this round', async () => {
    const emptyGame = { ...game, basketData: { ...game.basketData, currentRoundComments: [], currentRoundGuesses: [] } };
    const { result } = await enterWithGame(emptyGame);
    mockTransactionOn(emptyGame);

    await act(async () => { await result.current.restartBasketRound(); });

    const arg = mockTxn.update.mock.calls[0][1];
    expect(arg['basketData.currentRoundComments']).toEqual([]);
    expect(Object.keys(arg).filter((k) => k.startsWith('scores.'))).toHaveLength(0);
  });

  it('rejects a non-admin caller', async () => {
    const { result } = await enterWithGame(game);
    mockTransactionOn(game);
    const config = require('@/config/firebase');
    config.auth.currentUser = { uid: 'user-2', displayName: 'Bob', email: 'bob@example.com', photoURL: null };

    await expect(
      act(async () => { await result.current.restartBasketRound(); })
    ).rejects.toThrow('Only the admin can restart the round');
  });
});

// ── skipBasketRound ──────────────────────────────────────────────────────────
describe('skipBasketRound', () => {
  it('delegates to the same advance logic as startNextBasketRound', async () => {
    const game = {
      ...BASE_GAME, status: 'basket_guessing',
      basketData: { schedule: SCHEDULE, currentRoundIndex: 0, currentRoundComments: [], currentRoundGuesses: [] },
    };
    const { result, gameDoc } = await enterWithGame(game);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.skipBasketRound(); });

    expect(f.updateDoc).toHaveBeenCalledWith(gameDoc, expect.objectContaining({
      status: 'basket_writing',
      'basketData.currentRoundIndex': 1,
    }));
  });
});

// ── startNextBasketRound ─────────────────────────────────────────────────────
describe('startNextBasketRound', () => {
  it('increments roundIndex and sets status basket_writing when rounds remain', async () => {
    const game = { ...BASE_GAME, status: 'basket_guessing', basketData: { schedule: SCHEDULE, currentRoundIndex: 0, currentRoundComments: [], currentRoundGuesses: [] } };
    const { result, gameDoc } = await enterWithGame(game);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.startNextBasketRound(); });

    expect(f.updateDoc).toHaveBeenCalledWith(gameDoc, {
      status: 'basket_writing',
      'basketData.currentRoundIndex': 1,
      'basketData.currentRoundComments': [],
      'basketData.currentRoundGuesses': [],
    });
  });

  it('sets status finished on the last round', async () => {
    const game = { ...BASE_GAME, status: 'basket_guessing', basketData: { schedule: SCHEDULE, currentRoundIndex: 1, currentRoundComments: [], currentRoundGuesses: [] } };
    const { result, gameDoc } = await enterWithGame(game);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.startNextBasketRound(); });

    expect(f.updateDoc).toHaveBeenCalledWith(gameDoc, { status: 'finished' });
  });
});
