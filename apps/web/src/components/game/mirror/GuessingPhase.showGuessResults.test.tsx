// @vitest-environment jsdom
/**
 * Regression coverage: showGuessResults was stored/toggleable but never
 * applied — the "X out of Y correct" breakdown rendered unconditionally once
 * guessResults[uid] existed. Gates it so the breakdown only shows when
 * game.showGuessResults is true; otherwise the generic "guesses submitted"
 * fallback renders instead. Mirrors the equivalent fix in apps/expo.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Game } from '@mirror/shared';
import { GuessingPhase } from './GuessingPhase';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'player-uid' } }),
}));
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key) }),
}));
vi.mock('../../../contexts/SoundContext', () => ({
  useSound: () => ({ playSound: vi.fn(() => Promise.resolve()) }),
}));
vi.mock('../../../contexts/GameContext', () => ({
  useGame: () => ({
    loading: false,
    submitGuess: vi.fn(),
    markPlayerGuessesSubmitted: vi.fn(),
    finalizeGuessingPhase: vi.fn(),
    startNextRound: vi.fn(),
    restartMirrorRound: vi.fn(),
    skipMirrorRound: vi.fn(),
  }),
}));

const ADMIN = { userId: 'admin-uid', userName: 'Admin', userEmail: 'a@t.com', joinedAt: new Date('2024-01-01') };
const PLAYER = { userId: 'player-uid', userName: 'Player', userEmail: 'p@t.com', joinedAt: new Date('2024-01-02') };

function makeGame(overrides: Record<string, unknown> = {}): Game {
  return {
    id: 'game-1',
    adminId: 'admin-uid',
    status: 'guessing_phase',
    participants: [ADMIN, PLAYER],
    scores: {},
    guessResults: { 'player-uid': { correctGuesses: 2 } },
    guessingData: {
      playersWhoSubmittedGuesses: ['player-uid'],
      allPlayersSubmitted: true,
      commentsByTarget: { 'player-uid': [] },
      possibleAuthors: [ADMIN, PLAYER],
      singleRoundTargetId: null,
    },
    ...overrides,
  } as unknown as Game;
}

describe('GuessingPhase (web) — showGuessResults gates the correct-count banner', () => {
  it('shows the correct-count breakdown when showGuessResults is true', () => {
    render(<GuessingPhase game={makeGame({ showGuessResults: true })} />);
    expect(screen.queryByText(/game\.ui\.guessCorrectCount/)).toBeInTheDocument();
  });

  it('hides the correct-count breakdown when showGuessResults is false', () => {
    render(<GuessingPhase game={makeGame({ showGuessResults: false })} />);
    expect(screen.queryByText(/game\.ui\.guessCorrectCount/)).not.toBeInTheDocument();
    expect(screen.getByText('game.ui.guessResultsTitle')).toBeInTheDocument();
  });

  it('hides the correct-count breakdown when showGuessResults is undefined (legacy games)', () => {
    render(<GuessingPhase game={makeGame()} />);
    expect(screen.queryByText(/game\.ui\.guessCorrectCount/)).not.toBeInTheDocument();
    expect(screen.getByText('game.ui.guessResultsTitle')).toBeInTheDocument();
  });
});
