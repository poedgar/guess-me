// @vitest-environment jsdom
/**
 * Regression coverage: apps/expo shows the four core admin settings toggles
 * (adminWritesComments, showSurnames, targetSelectionMode, showGuessResults)
 * unconditionally for any admin, regardless of game type — only
 * ideaIncognitoMode is additionally gated to Ideas mode. apps/web instead
 * gated the whole core-toggle block to gameType === 'mirror', and had a
 * separate ideas-only block that duplicated adminWritesComments. Once an
 * admin picked Basket or Clash, they had no UI to toggle
 * adminWritesComments/showSurnames without switching back to Mirror mode
 * first — a real admin-workflow gap not present on native.
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Game } from '@mirror/shared';
import { WaitingPhase } from './WaitingPhase';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'admin-uid' } }),
}));
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key) }),
}));
vi.mock('../../../contexts/GameContext', () => ({
  useGame: () => ({
    loading: false,
    startGame: vi.fn(),
    startBasketGame: vi.fn(),
    startIdeaGame: vi.fn(),
    updateAdminWritesComments: vi.fn(),
    updateShowSurnames: vi.fn(),
    updateTargetSelectionMode: vi.fn(),
    updateShowGuessResults: vi.fn(),
    updateIdeaIncognitoMode: vi.fn(),
    setGameType: vi.fn(() => Promise.resolve()),
  }),
}));
vi.mock('../Leaderboard', () => ({ Leaderboard: () => null }));
vi.mock('./TargetControlPanel', () => ({ TargetControlPanel: () => null }));

const ADMIN = { userId: 'admin-uid', userName: 'Admin', userEmail: 'a@t.com', joinedAt: new Date('2024-01-01') };
const PLAYER = { userId: 'player-uid', userName: 'Player', userEmail: 'p@t.com', joinedAt: new Date('2024-01-02') };

function makeGame(gameType: 'mirror' | 'basket' | 'clash' | 'ideas'): Game {
  return {
    id: 'game-1',
    adminId: 'admin-uid',
    status: 'waiting',
    participants: [ADMIN, PLAYER],
    scores: {},
    gameType,
  } as unknown as Game;
}

const CORE_TOGGLE_TESTIDS = [
  'admin-writes-comments-toggle',
  'show-surnames-toggle',
  'target-selection-mode-toggle',
  'show-guess-results-toggle',
];

describe.each(['mirror', 'basket', 'clash', 'ideas'] as const)('WaitingPhase — admin settings toggles for gameType=%s', (gameType) => {
  it('renders all four core admin toggles', () => {
    const { container } = render(<WaitingPhase game={makeGame(gameType)} />);
    for (const testId of CORE_TOGGLE_TESTIDS) {
      expect(container.querySelector(`[data-cy="${testId}"]`)).not.toBeNull();
    }
  });
});

describe('WaitingPhase — ideaIncognitoMode toggle', () => {
  it('shows ideaIncognitoMode only for gameType=ideas', () => {
    const { container: ideasContainer } = render(<WaitingPhase game={makeGame('ideas')} />);
    expect(ideasContainer.querySelector('[data-cy="idea-incognito-mode-toggle"]')).not.toBeNull();

    const { container: mirrorContainer } = render(<WaitingPhase game={makeGame('mirror')} />);
    expect(mirrorContainer.querySelector('[data-cy="idea-incognito-mode-toggle"]')).toBeNull();
  });

  it('does not render adminWritesComments twice for gameType=ideas', () => {
    const { container } = render(<WaitingPhase game={makeGame('ideas')} />);
    expect(container.querySelectorAll('[data-cy="admin-writes-comments-toggle"]')).toHaveLength(1);
  });
});
