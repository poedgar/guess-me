import React, { useState } from 'react';
import { useGame } from '../../contexts/GameContext';
import { useAuth } from '../../contexts/AuthContext';
import { JoinScreen } from './JoinScreen';
import { GameHeader } from './GameHeader';
import { WaitingPhase } from './mirror/WaitingPhase';
import { ActivePhase } from './mirror/ActivePhase';
import { GuessingPhase } from './mirror/GuessingPhase';
import { ResultsPhase } from './mirror/ResultsPhase';

export const GameScreen: React.FC = () => {
  const { currentGame, leaveGame } = useGame();
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const handleLeaveGame = async () => {
    await leaveGame();
  };

  if (!currentGame) {
    return <JoinScreen />;
  }

  const gameType = currentGame.gameType || 'mirror';

  return (
    <div>
      <GameHeader game={currentGame} onLeave={handleLeaveGame} />

      {/* Mirror Mode */}
      {gameType === 'mirror' && (
        <>
          {currentGame.status === 'waiting' && <WaitingPhase game={currentGame} />}
          {currentGame.status === 'active' && <ActivePhase game={currentGame} />}
          {currentGame.status === 'guessing_phase' && <GuessingPhase game={currentGame} />}
          {currentGame.status === 'finished' && <ResultsPhase game={currentGame} />}
        </>
      )}

      {/* Basket Mode */}
      {gameType === 'basket' && (
        <div className="text-center py-8">
          <p className="text-gray-600 dark:text-gray-400">Basket mode coming soon...</p>
        </div>
      )}

      {/* Clash Mode */}
      {gameType === 'clash' && (
        <div className="text-center py-8">
          <p className="text-gray-600 dark:text-gray-400">Clash mode coming soon...</p>
        </div>
      )}
    </div>
  );
};
