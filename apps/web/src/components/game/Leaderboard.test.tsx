// @vitest-environment jsdom
/**
 * Regression coverage: apps/expo's Leaderboard prefixes each row with the
 * player's join-order number ("2. Name") and marks the admin with a crown
 * (see apps/expo/components/game/Leaderboard.tsx:82-87). apps/web's
 * Leaderboard never rendered either — the ranking badge (medal/#N) is
 * present on both platforms, but the join-order number and admin crown are
 * apps/expo-only cosmetics that never made it into the web port.
 */
import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Game } from '@mirror/shared';
import { Leaderboard } from './Leaderboard';

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'admin-uid' } }),
}));
vi.mock('../../contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

const game = {
  adminId: 'admin-uid',
  participants: [
    { userId: 'admin-uid', userName: 'Admin Adminson', userEmail: 'a@t.com', joinedAt: new Date('2024-01-01') },
    { userId: 'player-uid', userName: 'Player Playerson', userEmail: 'p@t.com', joinedAt: new Date('2024-01-02') },
  ],
  scores: {},
  guessResults: {},
} as unknown as Game;

function rowText(container: HTMLElement, userId: string): string {
  return container.querySelector(`[data-cy-user-id="${userId}"]`)?.textContent ?? '';
}

describe('Leaderboard — player numbering and admin crown', () => {
  it("prefixes each row with the participant's player number", () => {
    const { container } = render(<Leaderboard game={game} participants={game.participants} showSurnames />);

    expect(rowText(container, 'admin-uid')).toContain('1. Admin Adminson');
    expect(rowText(container, 'player-uid')).toContain('2. Player Playerson');
  });

  it('marks the admin row, and only the admin row, with a crown', () => {
    const { container } = render(<Leaderboard game={game} participants={game.participants} showSurnames />);

    expect(rowText(container, 'admin-uid')).toContain('👑');
    expect(rowText(container, 'player-uid')).not.toContain('👑');
  });
});
