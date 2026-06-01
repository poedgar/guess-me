import type { Game } from '@/contexts/GameContext';
import React from 'react';
import { BasketGuessingPhase } from './BasketGuessingPhase';
import { BasketWritingPhase } from './BasketWritingPhase';

interface Props {
  game: Game;
  user: { uid: string } | null;
  isAdmin: boolean;
  locale: string;
  isDark: boolean;
  getDisplayName: (name: string) => string;
  showFancyAlert: (title: string, message?: string | null, buttons?: any[], customContent?: React.ReactNode) => void;
  showFaceMessage: (message: string, face?: React.ReactNode) => void;
}

export const BasketScreen: React.FC<Props> = (props) => {
  const { game } = props;
  if (game.status === 'basket_writing') return <BasketWritingPhase {...props} />;
  if (game.status === 'basket_guessing') return <BasketGuessingPhase {...props} />;
  return null;
};
