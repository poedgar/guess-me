// @vitest-environment jsdom
/**
 * apps/expo's TargetControlPanel lets the admin manually set/skip the next
 * round's target and reset those preferences. apps/web's GameContext already
 * has setNextRoundTarget/skipNextRoundTarget/resetTargetControls (identical
 * to native, byte-for-byte) but no component ever called them. Ports the
 * same UI, rendered from WaitingPhase.tsx and GuessingPhase.tsx (mirroring
 * native's two non-PostGuessingPointsPanel render sites — that third site
 * was already scoped out when PostGuessingPointsPanel was ported).
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Game } from '@mirror/shared';
import { TargetControlPanel } from './TargetControlPanel';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'admin-uid' } }),
}));
vi.mock('../../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key) }),
}));
vi.mock('../../../contexts/SoundContext', () => ({
  useSound: () => ({ playSound: vi.fn(() => Promise.resolve()) }),
}));

const setNextRoundTarget = vi.fn(() => Promise.resolve());
const skipNextRoundTarget = vi.fn(() => Promise.resolve());
const resetTargetControls = vi.fn(() => Promise.resolve());
vi.mock('../../../contexts/GameContext', () => ({
  useGame: () => ({ setNextRoundTarget, skipNextRoundTarget, resetTargetControls }),
}));

const ADMIN = { userId: 'admin-uid', userName: 'Admin', userEmail: 'a@t.com', joinedAt: new Date('2024-01-01') };
const PLAYER = { userId: 'player-uid', userName: 'Player', userEmail: 'p@t.com', joinedAt: new Date('2024-01-02') };
const PLAYER2 = { userId: 'player2-uid', userName: 'Player2', userEmail: 'p2@t.com', joinedAt: new Date('2024-01-03') };

function makeGame(overrides: Record<string, unknown> = {}): Game {
  return {
    adminId: 'admin-uid',
    participants: [ADMIN, PLAYER, PLAYER2],
    adminNextTargetPreference: undefined,
    adminSkippedTargets: [],
    currentRound: null,
    ...overrides,
  } as unknown as Game;
}

function rowFor(container: HTMLElement, userId: string): HTMLElement {
  const row = container.querySelector(`[data-cy="target-control-row"][data-cy-user-id="${userId}"]`);
  if (!row) throw new Error(`no row for ${userId}`);
  return row as HTMLElement;
}

beforeEach(() => {
  setNextRoundTarget.mockClear();
  skipNextRoundTarget.mockClear();
  resetTargetControls.mockClear();
});

describe('TargetControlPanel — rendering', () => {
  it('renders a row for every participant', () => {
    const { container } = render(<TargetControlPanel game={makeGame()} />);
    expect(container.querySelector('[data-cy-user-id="admin-uid"]')).not.toBeNull();
    expect(container.querySelector('[data-cy-user-id="player-uid"]')).not.toBeNull();
    expect(container.querySelector('[data-cy-user-id="player2-uid"]')).not.toBeNull();
  });

  it('marks the round\'s current target', () => {
    const { container } = render(
      <TargetControlPanel game={makeGame({ currentRound: { targetUserId: 'player-uid' } })} />,
    );
    expect(rowFor(container, 'player-uid').textContent).toContain('game.ui.targetControl.currentTarget');
  });

  it('marks the preferred next target', () => {
    const { container } = render(
      <TargetControlPanel game={makeGame({ adminNextTargetPreference: 'player2-uid' })} />,
    );
    expect(rowFor(container, 'player2-uid').textContent).toContain('game.ui.targetControl.nextTargetLabel');
  });

  it('marks skipped targets', () => {
    const { container } = render(
      <TargetControlPanel game={makeGame({ adminSkippedTargets: ['player-uid'] })} />,
    );
    expect(rowFor(container, 'player-uid').textContent).toContain('game.ui.targetControl.skippedLabel');
  });
});

describe('TargetControlPanel — actions', () => {
  it('calls setNextRoundTarget with the row\'s userId when "set" is clicked', async () => {
    const { container } = render(<TargetControlPanel game={makeGame()} />);
    fireEvent.click(rowFor(container, 'player-uid').querySelector('[data-cy="target-set"]')!);
    await waitFor(() => expect(setNextRoundTarget).toHaveBeenCalledWith('player-uid'));
  });

  it('calls skipNextRoundTarget with the row\'s userId when "skip" is clicked', async () => {
    const { container } = render(<TargetControlPanel game={makeGame()} />);
    fireEvent.click(rowFor(container, 'player-uid').querySelector('[data-cy="target-skip"]')!);
    await waitFor(() => expect(skipNextRoundTarget).toHaveBeenCalledWith('player-uid'));
  });

  it('calls resetTargetControls when reset is clicked', async () => {
    render(<TargetControlPanel game={makeGame({ adminNextTargetPreference: 'player-uid' })} />);
    fireEvent.click(screen.getByTestId('target-control-reset'));
    await waitFor(() => expect(resetTargetControls).toHaveBeenCalled());
  });
});

describe('TargetControlPanel — disabled states', () => {
  it('disables "set" for the row that is already the preferred target', () => {
    const { container } = render(
      <TargetControlPanel game={makeGame({ adminNextTargetPreference: 'player-uid' })} />,
    );
    expect(rowFor(container, 'player-uid').querySelector('[data-cy="target-set"]')).toBeDisabled();
  });

  it('disables "skip" for a row already in adminSkippedTargets', () => {
    const { container } = render(
      <TargetControlPanel game={makeGame({ adminSkippedTargets: ['player-uid'] })} />,
    );
    expect(rowFor(container, 'player-uid').querySelector('[data-cy="target-skip"]')).toBeDisabled();
  });

  it('disables both actions for the current round target', () => {
    const { container } = render(
      <TargetControlPanel game={makeGame({ currentRound: { targetUserId: 'player-uid' } })} />,
    );
    expect(rowFor(container, 'player-uid').querySelector('[data-cy="target-set"]')).toBeDisabled();
    expect(rowFor(container, 'player-uid').querySelector('[data-cy="target-skip"]')).toBeDisabled();
  });
});
