import React from 'react';
import { Game } from '@mirror/shared';
import { BasketWritingPhase } from './BasketWritingPhase';
import { BasketGuessingPhase } from './BasketGuessingPhase';

interface Props {
  game: Game;
}

export const BasketScreen: React.FC<Props> = ({ game }) => {
  if (game.status === 'basket_writing') return <BasketWritingPhase game={game} />;
  if (game.status === 'basket_guessing') return <BasketGuessingPhase game={game} />;
  return null;
};
