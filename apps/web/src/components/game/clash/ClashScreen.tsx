import React from 'react';
import { Game } from '@mirror/shared';
import { ClashWritingPhase } from './ClashWritingPhase';
import { ClashGuessingPhase } from './ClashGuessingPhase';

interface Props {
  game: Game;
}

export const ClashScreen: React.FC<Props> = ({ game }) => {
  if (game.status === 'clash_writing') return <ClashWritingPhase game={game} />;
  if (game.status === 'clash_guessing') return <ClashGuessingPhase game={game} />;
  return null;
};
