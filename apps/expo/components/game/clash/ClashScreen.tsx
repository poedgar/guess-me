import type { Game } from '@/contexts/GameContext';
import React from 'react';
import { ClashGuessingPhase } from './ClashGuessingPhase';
import { ClashWritingPhase } from './ClashWritingPhase';

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

export const ClashScreen: React.FC<Props> = (props) => {
  const { game } = props;
  if (game.status === 'clash_writing') return <ClashWritingPhase {...props} />;
  if (game.status === 'clash_guessing') return <ClashGuessingPhase {...props} />;
  return null;
};
