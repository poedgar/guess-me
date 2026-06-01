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

  it('awards 1 point and records commentCorrect:true for correct guess', async () => {
    const { result, gameDoc } = await enterWithGame(game);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    // user-1's comment is written by user-2 — guess correctly
    await act(async () => { await result.current.submitBasketCommentGuess('user-2'); });

    expect(f.updateDoc).toHaveBeenCalledWith(
      gameDoc,
      expect.objectContaining({
        'scores.user-1': 1,
        'basketData.currentRoundGuesses': expect.objectContaining({
          guesserId: 'user-1',
          commentWriterId: 'user-2',
          commentCorrect: true,
          pointsAwarded: 1,
        }),
      }),
    );
  });

  it('awards 0 points and records commentCorrect:false for wrong guess', async () => {
    const { result, gameDoc } = await enterWithGame(game);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    // user-3 did NOT write about user-1
    await act(async () => { await result.current.submitBasketCommentGuess('user-3'); });

    const arg = f.updateDoc.mock.calls[0][1];
    expect(arg['scores.user-1']).toBeUndefined();
    expect(arg['basketData.currentRoundGuesses']).toMatchObject({
      commentCorrect: false,
      pointsAwarded: 0,
    });
  });
});

// ── submitBasketAuthorGuess ──────────────────────────────────────────────────
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

  it('awards 1 additional point for correct author guess', async () => {
    const { result, gameDoc } = await enterWithGame(game);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.submitBasketAuthorGuess('user-2'); });

    expect(f.updateDoc).toHaveBeenCalledWith(
      gameDoc,
      expect.objectContaining({ 'scores.user-1': 1 }),
    );
    const arg = f.updateDoc.mock.calls[0][1];
    const updatedGuess = arg['basketData.currentRoundGuesses'].find((g: any) => g.guesserId === 'user-1');
    expect(updatedGuess.authorCorrect).toBe(true);
    expect(updatedGuess.pointsAwarded).toBe(2);
  });

  it('awards 0 additional points for wrong author guess', async () => {
    const { result, gameDoc } = await enterWithGame(game);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.submitBasketAuthorGuess('user-3'); });

    const arg = f.updateDoc.mock.calls[0][1];
    expect(arg['scores.user-1']).toBeUndefined();
    const updatedGuess = arg['basketData.currentRoundGuesses'].find((g: any) => g.guesserId === 'user-1');
    expect(updatedGuess.authorCorrect).toBe(false);
    expect(updatedGuess.pointsAwarded).toBe(1);
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
