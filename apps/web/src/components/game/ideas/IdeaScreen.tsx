import React from 'react';
import { Game } from '@mirror/shared';
import { IdeaWritingPhase } from './IdeaWritingPhase';
import { IdeaRatingPhase } from './IdeaRatingPhase';

interface Props {
  game: Game;
}

export const IdeaScreen: React.FC<Props> = ({ game }) => {
  if (game.status === 'idea_writing') return <IdeaWritingPhase game={game} />;
  if (game.status === 'idea_rating') return <IdeaRatingPhase game={game} />;
  return null;
};
