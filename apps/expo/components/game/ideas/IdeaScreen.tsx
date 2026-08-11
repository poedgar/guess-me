import type { Game } from '@/contexts/GameContext';
import React from 'react';
import { IdeaRatingPhase } from './IdeaRatingPhase';
import { IdeaWritingPhase } from './IdeaWritingPhase';

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

export const IdeaScreen: React.FC<Props> = (props) => {
  const { game } = props;
  if (game.status === 'idea_writing') return <IdeaWritingPhase {...props} />;
  if (game.status === 'idea_rating') return <IdeaRatingPhase {...props} />;
  return null;
};
