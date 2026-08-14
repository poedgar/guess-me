// @vitest-environment jsdom
/**
 * apps/expo's PostGuessingPointsPanel (post-guessing bonus-points UI) has no
 * web equivalent — awardPointsToPlayers/startPostGuessingPointPhase exist on
 * apps/web's GameContext but nothing ever calls them. This ports the
 * award-phase UI only (see PR discussion): the admin selects bonus points
 * (-3..-1, +1..+3) for other players and submits. The native "fallback"
 * prompt state (which also renders TargetControlPanel, an unrelated and
 * separately-missing feature) is intentionally out of scope.
 */
import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Game } from '@mirror/shared';
import { PostGuessingPointsPanel } from './PostGuessingPointsPanel';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'admin-uid' } }),
}));
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key) }),
}));
vi.mock('../../../contexts/SoundContext', () => ({
  useSound: () => ({ playSound: vi.fn(() => Promise.resolve()) }),
}));

const awardPointsToPlayers = vi.fn(() => Promise.resolve());
vi.mock('../../../contexts/GameContext', () => ({
  useGame: () => ({ awardPointsToPlayers }),
}));

const ADMIN = { userId: 'admin-uid', userName: 'Admin', userEmail: 'a@t.com', joinedAt: new Date('2024-01-01') };
const PLAYER = { userId: 'player-uid', userName: 'Player', userEmail: 'p@t.com', joinedAt: new Date('2024-01-02') };
const PLAYER2 = { userId: 'player2-uid', userName: 'Player2', userEmail: 'p2@t.com', joinedAt: new Date('2024-01-03') };

function makeGame(overrides: Record<string, unknown> = {}): Game {
  return {
    adminId: 'admin-uid',
    participants: [ADMIN, PLAYER, PLAYER2],
    postGuessingPointPhase: true,
    playersWhoAwardedPostGuessPoints: [],
    ...overrides,
  } as unknown as Game;
}

function rowFor(container: HTMLElement, userId: string): HTMLElement {
  const row = container.querySelector(`[data-cy="post-guessing-points-row"][data-cy-user-id="${userId}"]`);
  if (!row) throw new Error(`no row for ${userId}`);
  return row as HTMLElement;
}

beforeEach(() => {
  awardPointsToPlayers.mockClear();
});

describe('PostGuessingPointsPanel — visibility', () => {
  it('renders nothing when postGuessingPointPhase is not active', () => {
    const { container } = render(<PostGuessingPointsPanel game={makeGame({ postGuessingPointPhase: false })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for a non-admin viewer (mocked user is not game.adminId)', () => {
    const { container } = render(<PostGuessingPointsPanel game={makeGame({ adminId: 'other-admin' })} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('PostGuessingPointsPanel — already awarded', () => {
  it('shows a waiting message instead of the award UI once the admin has already awarded', () => {
    const { container } = render(
      <PostGuessingPointsPanel game={makeGame({ playersWhoAwardedPostGuessPoints: ['admin-uid'] })} />,
    );

    expect(screen.getByText('game.ui.postGuessing.alreadyAwardedText')).toBeInTheDocument();
    expect(container.querySelector('[data-cy="post-guessing-points-row"]')).toBeNull();
  });
});

describe('PostGuessingPointsPanel — award UI', () => {
  it('lists every participant except the admin', () => {
    const { container } = render(<PostGuessingPointsPanel game={makeGame()} />);

    expect(container.querySelector('[data-cy-user-id="player-uid"]')).not.toBeNull();
    expect(container.querySelector('[data-cy-user-id="player2-uid"]')).not.toBeNull();
    expect(container.querySelector('[data-cy-user-id="admin-uid"]')).toBeNull();
  });

  it('does not show a submit button until a player is selected', () => {
    render(<PostGuessingPointsPanel game={makeGame()} />);
    expect(screen.queryByTestId('award-points-submit')).not.toBeInTheDocument();
  });

  it('submits the selected point awards and clears the selection', async () => {
    const { container } = render(<PostGuessingPointsPanel game={makeGame()} />);

    const playerRow = rowFor(container, 'player-uid');
    const player2Row = rowFor(container, 'player2-uid');
    fireEvent.click(within(playerRow).getByText('2'));
    fireEvent.click(within(player2Row).getByText('-1'));

    fireEvent.click(screen.getByTestId('award-points-submit'));

    await waitFor(() => expect(awardPointsToPlayers).toHaveBeenCalledWith([
      { recipientId: 'player-uid', points: 2 },
      { recipientId: 'player2-uid', points: -1 },
    ]));

    await waitFor(() => expect(screen.queryByTestId('award-points-submit')).not.toBeInTheDocument());
  });
});
