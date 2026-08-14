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

  // user-1 (the mocked signed-in caller) is the game's admin. ROUND_GAME sets
  // adminWritesComments: false, which excludes the admin from eligibleRaters
  // (see the "rejects a caller not in eligibleRaters" test below, which relies
  // on exactly that). For tests where user-1 is meant to successfully rate,
  // override adminWritesComments: true so the caller is actually eligible.
  const ELIGIBLE_ROUND_GAME = { ...ROUND_GAME, adminWritesComments: true };

  it('writes the rating and increments the idea\'s own score by points, not the author\'s', async () => {
    const { result } = await enterWithGame(ELIGIBLE_ROUND_GAME);
    const f = require('firebase/firestore');
    const { txnUpdate } = setupTransaction(f, ELIGIBLE_ROUND_GAME);

    await act(async () => { await result.current.submitIdeaRating('i1', 4); });

    expect(txnUpdate).toHaveBeenCalledTimes(1);
    const written = txnUpdate.mock.calls[0][1] as Record<string, unknown>;
    const updatedIdeas = written['ideaData.ideas'] as Array<{ id: string; score?: number }>;
    expect(updatedIdeas.find(i => i.id === 'i1')?.score).toBe(4);
    expect(written['scores.user-2']).toBeUndefined();
    expect(written['ideaData.currentRoundRatings']).toEqual([
      expect.objectContaining({ raterId: 'user-1', ideaId: 'i1', points: 4 }),
    ]);
  });

  it('includes the comment only when incognitoMode is true', async () => {
    const { result } = await enterWithGame(ELIGIBLE_ROUND_GAME);
    const f = require('firebase/firestore');
    const { txnUpdate } = setupTransaction(f, ELIGIBLE_ROUND_GAME);

    await act(async () => { await result.current.submitIdeaRating('i1', 3, 'nice idea'); });

    const written = txnUpdate.mock.calls[0][1] as Record<string, unknown>;
    const ratings = written['ideaData.currentRoundRatings'] as Array<{ comment?: string }>;
    expect(ratings[0].comment).toBe('nice idea');
  });

  it('omits the comment when incognitoMode is false, even if provided', async () => {
    const openGame = { ...ELIGIBLE_ROUND_GAME, ideaData: { ...ELIGIBLE_ROUND_GAME.ideaData, incognitoMode: false } };
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

// ── restartIdeaRound ────────────────────────────────────────────────────────────
describe('restartIdeaRound', () => {
  const IDEAS = [
    { id: 'i1', authorId: 'user-2', text: 'Idea from Bob', submittedAt: 1, score: 4 },
    { id: 'i2', authorId: 'user-3', text: 'Idea from Carol', submittedAt: 2, score: 1 },
  ];
  const ratings = [
    { raterId: 'user-1', ideaId: 'i1', points: 4 },
    { raterId: 'user-1', ideaId: 'i2', points: 1 },
  ];
  const game = {
    ...BASE_GAME,
    status: 'idea_rating',
    ideaData: {
      incognitoMode: true,
      ideas: IDEAS,
      schedule: ['user-2', 'user-3'],
      currentRoundIndex: 0,
      currentRoundRatings: ratings,
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

  it('clears currentRoundRatings and keeps schedule/currentRoundIndex untouched', async () => {
    const { result } = await enterWithGame(game);
    mockTransactionOn(game);

    await act(async () => { await result.current.restartIdeaRound(); });

    const arg = mockTxn.update.mock.calls[0][1];
    expect(arg['ideaData.currentRoundRatings']).toEqual([]);
    expect(arg['ideaData.schedule']).toBeUndefined(); // not touched, so not written
  });

  it('rolls back each rated idea\'s own score by the points it was given this round', async () => {
    const { result } = await enterWithGame(game);
    mockTransactionOn(game);

    await act(async () => { await result.current.restartIdeaRound(); });

    const arg = mockTxn.update.mock.calls[0][1];
    const updatedIdeas = arg['ideaData.ideas'] as Array<{ id: string; score?: number }>;
    expect(updatedIdeas.find(i => i.id === 'i1')?.score).toBe(0); // 4 - 4
    expect(updatedIdeas.find(i => i.id === 'i2')?.score).toBe(0); // 1 - 1
  });

  it('rejects a non-admin caller', async () => {
    const { result } = await enterWithGame(game);
    mockTransactionOn(game);
    const config = require('@/config/firebase');
    config.auth.currentUser = { uid: 'user-2', displayName: 'Bob', email: 'bob@example.com', photoURL: null };

    await expect(
      act(async () => { await result.current.restartIdeaRound(); })
    ).rejects.toThrow('Only the admin can restart the round');
  });
});

// ── skipIdeaRound ────────────────────────────────────────────────────────────────
describe('skipIdeaRound', () => {
  it('delegates to the same advance logic as startNextIdeaRound', async () => {
    const game = {
      ...BASE_GAME, status: 'idea_rating',
      ideaData: { incognitoMode: true, ideas: [], schedule: ['user-1', 'user-2'], currentRoundIndex: 0, currentRoundRatings: [] },
    };
    const { result, gameDoc } = await enterWithGame(game);
    const f = require('firebase/firestore');
    f.updateDoc.mockClear();

    await act(async () => { await result.current.skipIdeaRound(); });

    expect(f.updateDoc).toHaveBeenCalledWith(gameDoc, {
      'ideaData.currentRoundIndex': 1,
      'ideaData.currentRoundRatings': [],
    });
  });
});
