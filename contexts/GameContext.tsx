import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { addDoc, arrayUnion, collection, doc, getDoc, onSnapshot, runTransaction, serverTimestamp, Unsubscribe, updateDoc } from 'firebase/firestore';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

export interface Game {
  id: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  participants: Participant[];
  createdAt: any;
  status: 'waiting' | 'active' | 'guessing_phase' | 'finished';
  currentRound?: Round | null;
  rounds?: Round[];
  scores?: { [userId: string]: number };
  guessingData?: GuessingData;
  guessResults?: { [userId: string]: { correctGuesses: number } };
}

export interface Participant {
  userId: string;
  userName: string;
  userEmail: string;
  joinedAt: any;
  totalPoints?: number;
}

export interface Guess {
  commentId: string;
  guesserId: string;
  guessedAuthorId: string;
  correct: boolean;
  guessedAt: any;
}

export interface Round {
  roundNumber: number;
  targetUserId: string;
  targetUserName: string;
  comments: Comment[];
  commentsVisible: boolean;
  pointsGiven: boolean;
  startedAt: any;
  targetPoints?: number;
  targetPointsGivenBy?: string[];
  // New: guesses for this round (who guessed which comment and whether they were correct)
  guesses?: Guess[];
  // New: how many correct guesses the target received for this round
  targetCorrectGuesses?: number;
}

export interface Comment {
  id: string;
  authorId: string;
  text: string;
  submittedAt: any;
  points?: number;
}

export interface GuessingData {
  // Map of targetUserId => comments written about that target
  commentsByTarget: { [userId: string]: Comment[] };
  // List of potential authors to choose from when guessing
  possibleAuthors: { userId: string; userName: string }[];
  playersWhoSubmittedGuesses?: string[];
  allPlayersSubmitted?: boolean;
}


interface GameContextType {
  currentGame: Game | null;
  loading: boolean;
  createGame: () => Promise<string>;
  joinGame: (gameId: string) => Promise<void>;
  /**
   * Accepts a single input string from the UI. If the input matches the admin password
   * stored in Firestore (collection `password`, doc `YR20RZ67FKy88HQVF6yW`),
   * it will create a new game and return the new game id. Otherwise it attempts to join
   * a game with the input treated as the game id.
   */
  enterGame: (input: string) => Promise<string | void>;
  leaveGame: () => Promise<void>;
  refreshGame: (gameId: string) => Promise<void>;
  startGame: () => Promise<void>;
  submitComment: (commentText: string) => Promise<void>;
  showComments: () => Promise<void>;
  givePoints: (commentId: string, points: number) => Promise<void>;
  startNextRound: () => Promise<void>;
  givePointsToTarget: (targetUserId: string, points?: number) => Promise<void>;
  startGuessingPhase: () => Promise<void>;
  finalizeGuessingPhase: () => Promise<void>;
  submitGuess: (roundNumber: number, commentId: string, guessedAuthorId: string) => Promise<boolean>;
  // Marks the current user (or given userId) as having submitted their guesses (useful when zero comments)
  markPlayerGuessesSubmitted: (userId?: string) => Promise<void>;
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

  const enterGame = async (input: string): Promise<string | void> => {
    if (!input || !input.trim()) {
      throw new Error('Please enter a code or password');
    }
    try {
      // Fetch the admin password from Firestore
      const passwordRef = doc(db, 'password', 'YR20RZ67FKy88HQVF6yW');
      const pwDoc = await getDoc(passwordRef);
      const adminPassword = pwDoc.exists() ? (pwDoc.data() as any).password : null;

      if (adminPassword && input === adminPassword) {
        // Input matches the admin password -> create a new game and return its id
        const newGameId = await createGame();
        return newGameId;
      } else {
        // Otherwise treat the input as a game ID and attempt to join
        await joinGame(input);
      }
    } catch (err) {
      console.error('Error in enterGame:', err);
      throw err;
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

      console.log('startGame: starting, target', { targetUserId: target.userId });

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

      console.log('submitComment: newComment', newComment);

      const updatedComments = [...(currentRound.comments || []), newComment];

      await updateDoc(gameRef, {
        'currentRound.comments': updatedComments,
      });

      console.log('submitComment: updateDoc complete');
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

    console.log('showComments called by admin', { gameId: currentGame.id, roundNumber: currentGame.currentRound.roundNumber });

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

    console.log('givePoints called', { commentId, points, userId: user.uid, roundNumber: currentGame.currentRound.roundNumber });

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

        console.log('givePoints: awarding points', { commentId, points, authorId: comment.authorId, newScores });

        await updateDoc(gameRef, {
          'currentRound.comments': updatedComments,
          'currentRound.pointsGiven': true,
          scores: newScores,
        });

        console.log('givePoints: updateDoc complete');
      }
    } catch (error: any) {
      console.error('Error giving points:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const givePointsToTarget = async (targetUserId: string, points = 1) => {
    if (!currentGame?.currentRound) throw new Error('No active round');
    const userId = user?.uid;
    if (!userId) throw new Error('Must be signed in to give points');
    // Prevent duplicate giving
    if (currentGame.currentRound.targetPointsGivenBy?.includes(userId)) {
      throw new Error('You already gave points to this target this round');
    }

    console.log('givePointsToTarget called', { targetUserId, points, userId, roundNumber: currentGame.currentRound.roundNumber });

    // Keep previous state to rollback on failure
    const prevGame = currentGame;

    // Optimistic update locally
    const updatedRound = {
      ...currentGame.currentRound,
      targetPoints: (currentGame.currentRound.targetPoints ?? 0) + points,
      targetPointsGivenBy: [...(currentGame.currentRound.targetPointsGivenBy ?? []), userId],
    };

    const updatedScores = {
      ...(currentGame.scores ?? {}),
      [targetUserId]: ((currentGame.scores?.[targetUserId] ?? 0) + points),
    };

    setCurrentGame({
      ...currentGame,
      currentRound: updatedRound,
      scores: updatedScores,
    });

    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      const gameDoc = await getDoc(gameRef);
      if (!gameDoc.exists()) {
        throw new Error('Game not found');
      }

      const gameData = gameDoc.data() as Game;
      const currentRoundFromServer = gameData.currentRound;
      if (!currentRoundFromServer) {
        throw new Error('No active round on server');
      }

      const newTargetPoints = (currentRoundFromServer.targetPoints ?? 0) + points;
      // Persist to Firestore: update targetPoints, append userId to targetPointsGivenBy, and update scores
      const newScores = {
        ...(gameData.scores ?? {}),
        [targetUserId]: ((gameData.scores?.[targetUserId] ?? 0) + points),
      };

      console.log('givePointsToTarget: persisting scores', { newTargetPoints, newScores });
      await updateDoc(gameRef, {
        'currentRound.targetPoints': newTargetPoints,
        'currentRound.targetPointsGivenBy': arrayUnion(userId),
        scores: newScores,
      });
      console.log('givePointsToTarget: updateDoc complete');
      // onSnapshot will replace local state with authoritative server state
    } catch (err) {
      // Rollback on error
      setCurrentGame(prevGame);
      console.error('Error giving points to target:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const submitGuess = async (roundNumber: number, commentId: string, guessedAuthorId: string): Promise<boolean> => {
    if (!currentGame || !user) throw new Error('No active game or user');
    const userId = user.uid;

    // Find the round (either currentRound or from completed rounds)
    let round: Round | undefined;
    let isCurrent = false;
    if (currentGame.currentRound && currentGame.currentRound.roundNumber === roundNumber) {
      round = currentGame.currentRound;
      isCurrent = true;
    } else {
      round = currentGame.rounds?.find(r => r.roundNumber === roundNumber);
    }

    if (!round) throw new Error('Round not found');
    if (!round.commentsVisible) throw new Error('Comments are not visible');
    // Only the round target should be submitting guesses for comments about them
    if (userId !== round.targetUserId) throw new Error('Only the target can make guesses');

    // Prevent duplicate guesses for the same comment by the same user
    if (round.guesses?.some(g => g.commentId === commentId && g.guesserId === userId)) {
      throw new Error('You already guessed for this comment');
    }

    const comment = round.comments.find(c => c.id === commentId);
    if (!comment) throw new Error('Comment not found');

    const correct = guessedAuthorId === comment.authorId;

    const newGuess: Guess = {
      commentId,
      guesserId: userId,
      guessedAuthorId,
      correct,
      guessedAt: new Date(),
    };

    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);

      // Use a transaction to safely append guesses and avoid overwriting concurrent updates
      await runTransaction(db, async (transaction) => {
        const gameSnap = await transaction.get(gameRef);
        if (!gameSnap.exists()) throw new Error('Game not found');
        const gameData = gameSnap.data() as Game;

        if (isCurrent) {
          const current = gameData.currentRound;
          if (!current) throw new Error('No active round on server');
          const updatedGuesses = [...(current.guesses || []), newGuess];
          const updates: any = {
            'currentRound.guesses': updatedGuesses,
          };
          if (correct) {
            updates['currentRound.targetCorrectGuesses'] = (current.targetCorrectGuesses ?? 0) + 1;
          }
          transaction.update(gameRef, updates);
        } else {
          const serverRounds = gameData.rounds || [];
          const updatedRounds = serverRounds.map(r => {
            if (r.roundNumber === roundNumber) {
              return {
                ...r,
                guesses: [...(r.guesses ?? []), newGuess],
                targetCorrectGuesses: (r.targetCorrectGuesses ?? 0) + (correct ? 1 : 0),
              };
            }
            return r;
          });
          transaction.update(gameRef, { rounds: updatedRounds });
        }
      });

      // Debug: log guess submission result
      console.log('submitGuess: saved', { roundNumber, commentId, guessedAuthorId, correct });

      // Force a refresh in case onSnapshot hasn't propagated yet
      try {
        await refreshGame(currentGame.id);
      } catch (e) {
        console.warn('submitGuess: refresh failed', e);
      }

      // After submitting a guess, check if the guesser has completed all guesses for their own target and mark them as submitted
      try {
        const gameDocAfter = await getDoc(gameRef);
        if (gameDocAfter.exists()) {
          const serverGame = gameDocAfter.data() as Game;
          const playersComments = serverGame.guessingData?.commentsByTarget?.[userId] || [];
          const numComments = playersComments.length;

          // Count guesses by this user for comments about themselves across rounds and currentRound
          let numGuessesByUser = 0;
          const serverRounds = serverGame.rounds || [];
          for (const r of serverRounds) {
            if (r.targetUserId === userId && r.guesses) {
              numGuessesByUser += r.guesses.filter(g => g.guesserId === userId).length;
            }
          }
          // include currentRound guesses if applicable
          if (serverGame.currentRound && serverGame.currentRound.targetUserId === userId && serverGame.currentRound.guesses) {
            numGuessesByUser += serverGame.currentRound.guesses.filter(g => g.guesserId === userId).length;
          }

          const alreadySubmitted = serverGame.guessingData?.playersWhoSubmittedGuesses?.includes(userId);
          if (!alreadySubmitted && numGuessesByUser >= numComments) {
            const playersAlready = serverGame.guessingData?.playersWhoSubmittedGuesses || [];
            const totalTargets = (serverGame.participants?.length ?? 0) - 1;
            const allSubmitted = (playersAlready.length + 1) >= totalTargets;
            await updateDoc(gameRef, {
              'guessingData.playersWhoSubmittedGuesses': arrayUnion(userId),
              'guessingData.allPlayersSubmitted': allSubmitted,
            });
          }
          // Edge case: if player has zero comments, mark them submitted immediately
          if (!alreadySubmitted && numComments === 0) {
            const playersAlready = serverGame.guessingData?.playersWhoSubmittedGuesses || [];
            const totalTargets = (serverGame.participants?.length ?? 0) - 1;
            const allSubmitted = (playersAlready.length + 1) >= totalTargets;
            await updateDoc(gameRef, {
              'guessingData.playersWhoSubmittedGuesses': arrayUnion(userId),
              'guessingData.allPlayersSubmitted': allSubmitted,
            });
          }
        }
      } catch (e) {
        console.error('Error updating guessing submission state', e);
      }

      return correct;
    } catch (err) {
      console.error('Error submitting guess:', err);
      throw err;
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
      const currentRoundData = gameData.currentRound;
      let previousRounds = gameData.rounds || [];
      
      // Save the current round as completed to the rounds array
      if (currentRoundData && currentRoundData.commentsVisible && currentRoundData.pointsGiven) {
        const completedRound: Round = {
          ...currentRoundData,
          commentsVisible: true,
          pointsGiven: true,
        };
        
        // Check if this round already exists in the rounds array
        const roundIndex = previousRounds.findIndex(r => r.roundNumber === currentRoundData.roundNumber);
        if (roundIndex >= 0) {
          // Update existing round with completed state (preserve all data)
          previousRounds[roundIndex] = completedRound;
        } else {
          // Add new completed round to the array
          previousRounds = [...previousRounds, completedRound];
        }
      }
      
      const usedTargets = previousRounds.map(r => r.targetUserId);
      
      // Get participants who haven't been targets yet (excluding admin)
      const availableParticipants = currentGame.participants.filter(
        p => p.userId !== currentGame.adminId && !usedTargets.includes(p.userId)
      );

      if (availableParticipants.length === 0) {
        // All participants have been targets, game finished
        // Make sure current round is saved as completed
        console.log('startNextRound: finishing game, saving rounds', { roundsSaved: previousRounds.length });
        await updateDoc(gameRef, {
          status: 'finished',
          currentRound: null,
          rounds: previousRounds, // Save all completed rounds
        });
        return;
      }

      // Select random participant from available ones
      const randomIndex = Math.floor(Math.random() * availableParticipants.length);
      const target = availableParticipants[randomIndex];
      console.log('startNextRound: selected next target', { targetUserId: target.userId, nextRoundNumber: previousRounds.length + 1 });

      const nextRound: Round = {
        roundNumber: previousRounds.length + 1,
        targetUserId: target.userId,
        targetUserName: target.userName,
        comments: [],
        commentsVisible: false,
        pointsGiven: false,
        startedAt: new Date(),
      };

      await updateDoc(gameRef, {
        currentRound: nextRound,
        rounds: previousRounds, // Save all completed rounds (without the new round yet)
      });
    } catch (error: any) {
      console.error('Error starting next round:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const startGuessingPhase = async (): Promise<void> => {
    if (!currentGame || !user || user.uid !== currentGame.adminId) {
      throw new Error('Only the admin can start the guessing phase');
    }

    // Include both completed rounds in `rounds` and the currentRound if it's completed (comments visible & points given)
    const completedRounds: Round[] = [...(currentGame.rounds || [])];
    if (currentGame.currentRound && currentGame.currentRound.commentsVisible && currentGame.currentRound.pointsGiven) {
      // Avoid duplicating if currentRound already in rounds
      if (!completedRounds.some(r => r.roundNumber === currentGame.currentRound!.roundNumber)) {
        completedRounds.push(currentGame.currentRound);
      }
    }

    if (completedRounds.length === 0) {
      throw new Error('No completed rounds to start guessing');
    }

    try {
      setLoading(true);
      // Build comments by target from completed rounds
      const commentsByTarget: { [key: string]: Comment[] } = {};
      for (const round of completedRounds) {
        commentsByTarget[round.targetUserId] = round.comments || [];
      }

      const possibleAuthors = currentGame.participants.map(p => ({ userId: p.userId, userName: p.userName }));

      const guessingData: GuessingData = {
        commentsByTarget,
        possibleAuthors,
        playersWhoSubmittedGuesses: [],
        allPlayersSubmitted: false,
      };

      console.log('startGuessingPhase: starting', { completedRoundsCount: completedRounds.length, targets: Object.keys(commentsByTarget).length, possibleAuthors: possibleAuthors.length });

      const gameRef = doc(db, 'games', currentGame.id);
      // Persist completed rounds so round history includes them, and clear currentRound since we're moving to guessing phase
      await updateDoc(gameRef, {
        status: 'guessing_phase',
        guessingData,
        guessResults: {},
        rounds: completedRounds,
        currentRound: null,
      });
    } catch (err) {
      console.error('Error starting guessing phase:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const markPlayerGuessesSubmitted = async (userIdParam?: string): Promise<void> => {
    if (!currentGame || !user) throw new Error('No active game or user');
    const playerId = userIdParam ?? user.uid;

    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      const gameDoc = await getDoc(gameRef);
      if (!gameDoc.exists()) throw new Error('Game not found');

      const gameData = gameDoc.data() as Game;
      const playersAlready = gameData.guessingData?.playersWhoSubmittedGuesses || [];
      console.log('markPlayerGuessesSubmitted called', { playerId, playersAlready, totalTargets: (gameData.participants?.length ?? 0) - 1 });
      if (playersAlready.includes(playerId)) {
        console.log('markPlayerGuessesSubmitted: already marked, skipping', playerId);
        return; // already marked
      }

      const newPlayersCount = playersAlready.length + 1;
      const totalTargets = (gameData.participants?.length ?? 0) - 1; // exclude admin
      const allSubmitted = newPlayersCount >= totalTargets;

      await updateDoc(gameRef, {
        'guessingData.playersWhoSubmittedGuesses': arrayUnion(playerId),
        'guessingData.allPlayersSubmitted': allSubmitted,
      });
    } catch (err) {
      console.error('Error marking player as submitted:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const finalizeGuessingPhase = async (): Promise<void> => {
    if (!currentGame || !user || user.uid !== currentGame.adminId) {
      throw new Error('Only the admin can finalize the guessing phase');
    }

    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      const gameDoc = await getDoc(gameRef);
      if (!gameDoc.exists()) throw new Error('Game not found');

      const gameData = gameDoc.data() as Game;
      const serverRounds = gameData.rounds || [];

      // Ensure any completed currentRound is included in final rounds saved to the document
      const finalRounds: Round[] = [...serverRounds];
      if (gameData.currentRound && gameData.currentRound.commentsVisible && gameData.currentRound.pointsGiven) {
        if (!finalRounds.some(r => r.roundNumber === gameData.currentRound!.roundNumber)) {
          finalRounds.push(gameData.currentRound);
        }
      }

      // Aggregate correct guesses per guesser
      const guessCounts: { [userId: string]: number } = {};
      for (const r of finalRounds) {
        if (!r.guesses) continue;
        for (const g of r.guesses) {
          if (g.correct) {
            guessCounts[g.guesserId] = (guessCounts[g.guesserId] ?? 0) + 1;
          }
        }
      }

      console.log('finalizeGuessingPhase: current scores before merging', gameData.scores);
      console.log('finalizeGuessingPhase: guessingData', gameData.guessingData);

      // Debug: log guessCounts and finalRounds with guesses
      console.log('finalizeGuessingPhase: finalRounds count', finalRounds.length);
      console.log('finalizeGuessingPhase: guessCounts', guessCounts);

      // Build guessResults and update scores by awarding 1 point per correct guess
      const guessResults: { [userId: string]: { correctGuesses: number } } = {};
      const newScores = { ...(gameData.scores ?? {}) };
      for (const [uid, count] of Object.entries(guessCounts)) {
        guessResults[uid] = { correctGuesses: count };
        newScores[uid] = (newScores[uid] ?? 0) + count;
      }

      await updateDoc(gameRef, {
        status: 'finished',
        guessResults,
        scores: newScores,
        rounds: finalRounds,
        currentRound: null,
      });

      console.log('finalizeGuessingPhase: finalized', { guessResults, newScores });
    } catch (err) {
      console.error('Error finalizing guessing phase:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const value: GameContextType = {
    currentGame,
    loading,
    createGame,
    joinGame,
    enterGame,
    leaveGame,
    refreshGame,
    startGame,
    submitComment,
    showComments,
    givePoints,
    startNextRound,
    startGuessingPhase,
    finalizeGuessingPhase,
    givePointsToTarget,
    submitGuess,
    markPlayerGuessesSubmitted,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

