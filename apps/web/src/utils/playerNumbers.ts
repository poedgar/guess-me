import type { Game } from '@mirror/shared';

export function getPlayerNumber(game: Game, userId: string): number {
  const assigned = game.playerNumbers?.[userId];
  if (assigned !== undefined) return assigned;
  const index = game.participants.findIndex(p => p.userId === userId);
  return index >= 0 ? index + 1 : 0;
}
