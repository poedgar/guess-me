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
  currentRound?: Round;
  rounds?: Round[];
  scores?: { [userId: string]: number };
}

export interface Participant {
  userId: string;
  userName: string;
  userEmail: string;
  joinedAt: any;
  totalPoints?: number;
}

export interface Round {
  roundNumber: number;
  targetUserId: string;
  targetUserName: string;
  comments: Comment[];
  commentsVisible: boolean;
  pointsGiven: boolean;
  startedAt: any;
}

export interface Comment {
  id: string;
  authorId: string;
  text: string;
  submittedAt: any;
  points?: number;
}

interface GameContextType {
  currentGame: Game | null;
  loading: boolean;
  createGame: () => Promise<string>;
  joinGame: (gameId: string) => Promise<void>;
  leaveGame: () => Promise<void>;
  refreshGame: (gameId: string) => Promise<void>;
  startGame: () => Promise<void>;
  submitComment: (commentText: string) => Promise<void>;
  showComments: () => Promise<void>;
  givePoints: (commentId: string, points: number) => Promise<void>;
  startNextRound: () => Promise<void>;
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

  // Helper function to randomly select a participant (excluding admin)
  const selectRandomParticipant = (participants: Participant[], adminId: string): Participant | null => {
    const nonAdminParticipants = participants.filter(p => p.userId !== adminId);
    if (nonAdminParticipants.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * nonAdminParticipants.length);
    return nonAdminParticipants[randomIndex];
  };

  const startGame = async (): Promise<void> => {
    if (!currentGame || !user || user.uid !== currentGame.adminId) {
      throw new Error('Only the admin can start the game');
    }

    if (currentGame.participants.length < 2) {
      throw new Error('Need at least 2 participants to start the game');
    }

    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      
      // Select random participant (excluding admin)
      const target = selectRandomParticipant(currentGame.participants, currentGame.adminId);
      if (!target) {
        throw new Error('No valid participants to select');
      }

      const round: Round = {
        roundNumber: 1,
        targetUserId: target.userId,
        targetUserName: target.userName,
        comments: [],
        commentsVisible: false,
        pointsGiven: false,
        startedAt: new Date(),
      };

      await updateDoc(gameRef, {
        status: 'active',
        currentRound: round,
        rounds: [round],
        scores: {},
      });
    } catch (error: any) {
      console.error('Error starting game:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const submitComment = async (commentText: string): Promise<void> => {
    if (!currentGame || !user || !currentGame.currentRound) {
      throw new Error('No active round');
    }

    if (user.uid === currentGame.currentRound.targetUserId) {
      throw new Error('You cannot comment about yourself');
    }

    if (!commentText.trim()) {
      throw new Error('Comment cannot be empty');
    }

    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      const gameDoc = await getDoc(gameRef);
      
      if (!gameDoc.exists()) {
        throw new Error('Game not found');
      }

      const gameData = gameDoc.data() as Game;
      const currentRound = gameData.currentRound;
      
      if (!currentRound) {
        throw new Error('No active round');
      }

      // Check if user already submitted a comment
      const existingComment = currentRound.comments?.find(c => c.authorId === user.uid);
      if (existingComment) {
        throw new Error('You have already submitted a comment for this round');
      }

      const newComment: Comment = {
        id: `${Date.now()}-${user.uid}`,
        authorId: user.uid,
        text: commentText.trim(),
        submittedAt: new Date(),
      };

      const updatedComments = [...(currentRound.comments || []), newComment];

      await updateDoc(gameRef, {
        'currentRound.comments': updatedComments,
      });
    } catch (error: any) {
      console.error('Error submitting comment:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const showComments = async (): Promise<void> => {
    if (!currentGame || !user || user.uid !== currentGame.adminId) {
      throw new Error('Only the admin can show comments');
    }

    if (!currentGame.currentRound) {
      throw new Error('No active round');
    }

    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      
      await updateDoc(gameRef, {
        'currentRound.commentsVisible': true,
      });
    } catch (error: any) {
      console.error('Error showing comments:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const givePoints = async (commentId: string, points: number): Promise<void> => {
    if (!currentGame || !user || !currentGame.currentRound) {
      throw new Error('No active round');
    }

    if (user.uid !== currentGame.currentRound.targetUserId) {
      throw new Error('Only the target person can give points');
    }

    if (currentGame.currentRound.pointsGiven) {
      throw new Error('Points have already been given for this round');
    }

    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      const gameDoc = await getDoc(gameRef);
      
      if (!gameDoc.exists()) {
        throw new Error('Game not found');
      }

      const gameData = gameDoc.data() as Game;
      const currentRound = gameData.currentRound;
      
      if (!currentRound) {
        throw new Error('No active round');
      }

      // Find the comment and update it with points
      const updatedComments = currentRound.comments.map(comment => {
        if (comment.id === commentId) {
          return { ...comment, points };
        }
        return comment;
      });

      // Update scores
      const comment = updatedComments.find(c => c.id === commentId);
      if (comment) {
        const currentScores = gameData.scores || {};
        const authorCurrentScore = currentScores[comment.authorId] || 0;
        const newScores = {
          ...currentScores,
          [comment.authorId]: authorCurrentScore + points,
        };

        await updateDoc(gameRef, {
          'currentRound.comments': updatedComments,
          'currentRound.pointsGiven': true,
          scores: newScores,
        });
      }
    } catch (error: any) {
      console.error('Error giving points:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const startNextRound = async (): Promise<void> => {
    if (!currentGame || !user || user.uid !== currentGame.adminId) {
      throw new Error('Only the admin can start the next round');
    }

    if (!currentGame.currentRound) {
      throw new Error('No active round');
    }

    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      const gameDoc = await getDoc(gameRef);
      
      if (!gameDoc.exists()) {
        throw new Error('Game not found');
      }

      const gameData = gameDoc.data() as Game;
      const previousRounds = gameData.rounds || [];
      const usedTargets = previousRounds.map(r => r.targetUserId);
      
      // Get participants who haven't been targets yet (excluding admin)
      const availableParticipants = currentGame.participants.filter(
        p => p.userId !== currentGame.adminId && !usedTargets.includes(p.userId)
      );

      if (availableParticipants.length === 0) {
        // All participants have been targets, game finished
        await updateDoc(gameRef, {
          status: 'finished',
          currentRound: null,
        });
        return;
      }

      // Select random participant from available ones
      const randomIndex = Math.floor(Math.random() * availableParticipants.length);
      const target = availableParticipants[randomIndex];

      const nextRound: Round = {
        roundNumber: previousRounds.length + 1,
        targetUserId: target.userId,
        targetUserName: target.userName,
        comments: [],
        commentsVisible: false,
        pointsGiven: false,
        startedAt: new Date(),
      };

      const updatedRounds = [...previousRounds, nextRound];
      
      await updateDoc(gameRef, {
        currentRound: nextRound,
        rounds: updatedRounds,
      });
    } catch (error: any) {
      console.error('Error starting next round:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const value: GameContextType = {
    currentGame,
    loading,
    createGame,
    joinGame,
    leaveGame,
    refreshGame,
    startGame,
    submitComment,
    showComments,
    givePoints,
    startNextRound,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

