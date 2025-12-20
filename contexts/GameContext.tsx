import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { db } from '@/config/firebase';
import { collection, addDoc, doc, getDoc, updateDoc, arrayUnion, serverTimestamp, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { useAuth } from './AuthContext';

export interface Game {
  id: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  participants: Participant[];
  createdAt: any;
  status: 'waiting' | 'active' | 'finished';
}

export interface Participant {
  userId: string;
  userName: string;
  userEmail: string;
  joinedAt: any;
}

interface GameContextType {
  currentGame: Game | null;
  loading: boolean;
  createGame: () => Promise<string>;
  joinGame: (gameId: string) => Promise<void>;
  leaveGame: () => Promise<void>;
  refreshGame: (gameId: string) => Promise<void>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

interface GameProviderProps {
  children: ReactNode;
}

export const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const [currentGame, setCurrentGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(false);

  // Set up real-time listener for the current game
  useEffect(() => {
    if (!currentGame?.id) {
      return;
    }

    const gameRef = doc(db, 'games', currentGame.id);
    
    // Set up real-time listener
    const unsubscribe: Unsubscribe = onSnapshot(
      gameRef,
      (gameDoc) => {
        if (gameDoc.exists()) {
          const game = { id: gameDoc.id, ...gameDoc.data() } as Game;
          setCurrentGame(game);
        } else {
          // Game was deleted
          setCurrentGame(null);
        }
      },
      (error) => {
        console.error('Error listening to game updates:', error);
      }
    );

    // Cleanup listener on unmount or when game changes
    return () => unsubscribe();
  }, [currentGame?.id]);

  const createGame = async (): Promise<string> => {
    if (!user) {
      throw new Error('You must be signed in to create a game');
    }

    try {
      setLoading(true);
      
      const now = new Date();
      const gameData = {
        adminId: user.uid,
        adminName: user.displayName || 'Unknown',
        adminEmail: user.email || '',
        participants: [
          {
            userId: user.uid,
            userName: user.displayName || 'Unknown',
            userEmail: user.email || '',
            joinedAt: now,
          },
        ],
        createdAt: serverTimestamp(),
        status: 'waiting' as const,
      };

      const docRef = await addDoc(collection(db, 'games'), gameData);
      
      // Set the game ID - the real-time listener will update the full game data
      const gameId = docRef.id;
      const initialGame: Game = {
        id: gameId,
        ...gameData,
        createdAt: new Date(),
      } as Game;
      setCurrentGame(initialGame);
      
      return gameId;
    } catch (error: any) {
      console.error('Error creating game:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const joinGame = async (gameId: string): Promise<void> => {
    if (!user) {
      throw new Error('You must be signed in to join a game');
    }

    try {
      setLoading(true);
      
      const gameRef = doc(db, 'games', gameId);
      const gameDoc = await getDoc(gameRef);

      if (!gameDoc.exists()) {
        throw new Error('Game not found');
      }

      const gameData = gameDoc.data();
      
      // Check if user is already a participant
      const isAlreadyParticipant = gameData.participants?.some(
        (p: Participant) => p.userId === user.uid
      );

      if (isAlreadyParticipant) {
        // User is already in the game, just refresh
        await refreshGame(gameId);
        return;
      }

      // Add user as participant
      const newParticipant: Participant = {
        userId: user.uid,
        userName: user.displayName || 'Unknown',
        userEmail: user.email || '',
        joinedAt: new Date(),
      };

      await updateDoc(gameRef, {
        participants: arrayUnion(newParticipant),
      });

      // Set the game so the real-time listener starts (if not already set)
      // The listener will automatically update when the document changes
      if (!currentGame || currentGame.id !== gameId) {
        const updatedGameDoc = await getDoc(gameRef);
        if (updatedGameDoc.exists()) {
          const game = { id: updatedGameDoc.id, ...updatedGameDoc.data() } as Game;
          setCurrentGame(game);
        }
      }
      // If already listening to this game, the listener will update automatically
    } catch (error: any) {
      console.error('Error joining game:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const leaveGame = async (): Promise<void> => {
    if (!currentGame || !user) {
      return;
    }

    try {
      setLoading(true);
      setCurrentGame(null);
      // You can add logic here to remove user from participants if needed
    } catch (error: any) {
      console.error('Error leaving game:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const refreshGame = async (gameId: string): Promise<void> => {
    try {
      const gameRef = doc(db, 'games', gameId);
      const gameDoc = await getDoc(gameRef);

      if (gameDoc.exists()) {
        const game = { id: gameDoc.id, ...gameDoc.data() } as Game;
        setCurrentGame(game);
      } else {
        setCurrentGame(null);
      }
    } catch (error: any) {
      console.error('Error refreshing game:', error);
      throw error;
    }
  };

  const value: GameContextType = {
    currentGame,
    loading,
    createGame,
    joinGame,
    leaveGame,
    refreshGame,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

