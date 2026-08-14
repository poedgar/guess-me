import { auth, db, generateGameId, sortParticipantsByJoin, buildJoinIndexById, generateBasketSchedule, generateClashSchedule, generateIdeaSchedule } from '@mirror/shared';
import type { BasketAssignment, BasketRound, ClashAssignment, ClashRound } from '@mirror/shared';
import { useAuth } from './AuthContext';
import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  Transaction,
  Unsubscribe,
  updateDoc,
} from "firebase/firestore";
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface Game {
  id: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  participants: Participant[];
  // Plain UIDs mirroring participants, kept in sync at create/join/leave.
  // Exists so Firestore rules can check membership — rules can't search
  // inside an array of objects for a matching field, only exact-value
  // membership over primitive arrays.
  participantIds?: string[];
  createdAt: Date | Timestamp;
  status: "waiting" | "active" | "guessing_phase" | "finished" | "basket_writing" | "basket_guessing" | "clash_writing" | "clash_guessing" | "idea_writing" | "idea_rating";
  // If set, indicates that target has submitted guesses and players can now award points to each other
  postGuessingPointPhase?: boolean;
  // Track which players have already awarded points in post-guessing phase
  playersWhoAwardedPostGuessPoints?: string[];
  // Track admin awards in post-guessing phase: { [userId: string]: { recipientId: string; points: number; awardedBy: string; awardedAt: any }[] }
  adminAwards?: {
    [userId: string]: {
      recipientId: string;
      points: number;
      awardedBy: string;
      awardedAt: any;
      // Which round these points were given in, so a round restart can
      // strip stale entries from this history log. Undefined on entries
      // written before this field existed — safe, since restart never
      // applies to an already-finished game.
      roundNumber?: number;
    }[];
  };
  // Track which players have completed the post-comment point phase (either gave target points or skipped)
  playersWhoCompletedPostCommentPhase?: string[];
  // If set, indicates the admin left the game and it cannot continue
  adminLeft?: boolean;
  currentRound?: Round | null;
  rounds?: Round[];
  scores?: { [userId: string]: number };
  guessingData?: GuessingData;
  guessResults?: { [userId: string]: { correctGuesses: number } };
  // Whether admin should also write comments (default: false)
  adminWritesComments?: boolean;
  // Whether to show participant surnames (default: false)
  showSurnames?: boolean;
  // Whether to show guess results to targets (default: false)
  showGuessResults?: boolean;
  // Target selection mode: 'random' or 'chronological' (default: 'random')
  targetSelectionMode?: "random" | "chronological";
  // Which game type to play: 'mirror' (default), 'basket', 'clash', or 'ideas'
  gameType?: 'mirror' | 'basket' | 'clash' | 'ideas';
  basketData?: BasketData;
  clashData?: ClashData;
  ideaData?: IdeaGameData;
  // Whether ratings/comments in Group Ideas mode stay anonymous (default: true)
  ideaIncognitoMode?: boolean;
  // Admin target control preferences
  adminNextTargetPreference?: string;
  adminSkippedTargets?: string[];
  // Stable per-participant display numbers, assigned once when the game starts.
  // Frozen for the lifetime of the game — does not shift if participants later leave.
  playerNumbers?: { [userId: string]: number };
  // Snapshot of scores/guessResults taken the instant the current round began.
  // Leaderboard displays use these (not the live scores/guessResults fields)
  // while a round is in progress, so round-in-progress scoring stays hidden
  // until the round ends and a fresh snapshot is taken.
  roundStartScores?: { [userId: string]: number };
  roundStartGuessResults?: { [userId: string]: { correctGuesses: number } };
}

export interface Participant {
  userId: string;
  userName: string;
  userEmail: string;
  photoURL?: string;
  joinedAt: Date | Timestamp;
  totalPoints?: number;
}

export interface Guess {
  commentId: string;
  guesserId: string;
  guessedAuthorId: string;
  correct: boolean;
  guessedAt: Date | Timestamp;
}

export interface Round {
  roundNumber: number;
  targetUserId: string;
  targetUserName: string;
  comments: Comment[];
  commentsVisible: boolean;
  pointsGiven: boolean;
  startedAt: Date | Timestamp;
  targetPoints?: number;
  targetPointsGivenBy?: string[];
  targetPointsByPlayer?: { [userId: string]: number };
  // New: guesses for this round (who guessed which comment and whether they were correct)
  guesses?: Guess[];
  // New: how many correct guesses the target received for this round
  targetCorrectGuesses?: number;
  guessesFinalized?: boolean;
}

export interface Comment {
  id: string;
  authorId: string;
  text: string;
  submittedAt: Date | Timestamp;
  points?: number;
}

export interface GuessingData {
  // Map of targetUserId => comments written about that target
  commentsByTarget: { [userId: string]: Comment[] };
  // List of potential authors to choose from when guessing
  possibleAuthors: { userId: string; userName: string }[];
  playersWhoSubmittedGuesses?: string[];
  allPlayersSubmitted?: boolean;
  // If set, indicates this guessing session is for a single completed round (per-round guessing)
  singleRoundTargetId?: string;
}

export interface BasketComment {
  writerId: string;
  subjectId: string;
  text: string;
  submittedAt: number;
}

export interface BasketGuess {
  guesserId: string;
  commentWriterId: string;
  authorGuessId?: string;
  commentCorrect: boolean;
  authorCorrect: boolean;
  pointsAwarded: number;
}

export interface BasketData {
  schedule: BasketRound[];
  currentRoundIndex: number;
  currentRoundComments: BasketComment[];
  currentRoundGuesses: BasketGuess[];
}

export interface ClashGroup {
  leaderId: string;
  memberIds: string[]; // includes leaderId
}

export interface ClashComment {
  writerId: string;
  subjectId: string;
  text: string;
  submittedAt: number;
}

export interface ClashGuess {
  commentWriterId: string;
  guessedSubjectId: string;
  subjectCorrect: boolean;
  guessedAuthorId?: string;
  authorCorrect?: boolean;
  pointsAwarded: number;
}

export interface ClashData {
  groupA: ClashGroup;
  groupB: ClashGroup;
  schedule: ClashRound[];
  currentRoundIndex: number;
  currentRoundCommentsA: ClashComment[];
  currentRoundCommentsB: ClashComment[];
  lastGroupToFinish: 'a' | 'b' | null;
  currentGuessingGroup: 'a' | 'b' | null;
  currentRoundGuessesA: ClashGuess[];
  currentRoundGuessesB: ClashGuess[];
  teamScores: { a: number; b: number };
}

export interface Idea {
  id: string;
  authorId: string;
  text: string;
  submittedAt: number;
  // Sum of all rating points this idea has received. Optional for
  // backward compatibility with ideas submitted before this field existed.
  score?: number;
}

export interface IdeaRating {
  raterId: string;
  ideaId: string;
  points: number;
  comment?: string;
}

export interface IdeaGameData {
  incognitoMode: boolean;
  ideas: Idea[];
  schedule: string[];
  currentRoundIndex: number;
  currentRoundRatings: IdeaRating[];
}

interface GameContextType {
  currentGame: Game | null;
  loading: boolean;
  createGame: (adminWritesComments?: boolean) => Promise<string>;
  joinGame: (gameId: string) => Promise<void>;
  /**
   * Accepts a single input string from the UI. If the input matches the admin password
   * stored in Firestore (collection `password`, doc `YR20RZ67FKy88HQVF6yW'),
   * it will create a new game and return its game id. Otherwise it attempts to join
   * the game with the input treated as the game id.
   */
  enterGame: (
    input: string,
    adminWritesComments?: boolean,
  ) => Promise<string | void>;
  leaveGame: () => Promise<void>;
  refreshGame: (gameId: string) => Promise<void>;
  startGame: () => Promise<void>;
  submitComment: (commentText: string) => Promise<void>;
  showComments: () => Promise<void>;
  awardCommentPoints: (commentId: string, points: number) => Promise<void>;
  finishAwardingPoints: () => Promise<void>;
  startNextRound: () => Promise<void>;
  givePointsToTarget: (targetUserId: string, points?: number) => Promise<void>;
  startGuessingPhase: () => Promise<void>;
  finalizeGuessingPhase: () => Promise<void>;
  restartMirrorRound: () => Promise<void>;
  skipMirrorRound: () => Promise<void>;
  submitGuess: (
    roundNumber: number,
    commentId: string,
    guessedAuthorId: string,
  ) => Promise<void>;
  markPlayerGuessesSubmitted: (
    userId?: string,
    correctGuesses?: number,
  ) => Promise<void>;
  updateAdminWritesComments: (adminWritesComments: boolean) => Promise<void>;
  updateShowSurnames: (showSurnames: boolean) => Promise<void>;
  updateTargetSelectionMode: (
    targetSelectionMode: "random" | "chronological",
  ) => Promise<void>;
  updateShowGuessResults: (showGuessResults: boolean) => Promise<void>;
  setGameType: (type: 'mirror' | 'basket' | 'clash' | 'ideas') => Promise<void>;
  startBasketGame: () => Promise<void>;
  submitBasketComment: (text: string) => Promise<void>;
  revealBasketComments: () => Promise<void>;
  submitBasketCommentGuess: (commentWriterId: string) => Promise<void>;
  submitBasketAuthorGuess: (authorGuessId: string) => Promise<void>;
  startNextBasketRound: () => Promise<void>;
  restartBasketRound: () => Promise<void>;
  skipBasketRound: () => Promise<void>;
  saveClashGroups: (groupA: ClashGroup, groupB: ClashGroup) => Promise<void>;
  startClashGame: () => Promise<void>;
  submitClashComment: (text: string) => Promise<void>;
  revealClashComments: () => Promise<void>;
  submitClashGuess: (commentWriterId: string, guessedSubjectId: string) => Promise<void>;
  submitClashAuthorGuess: (commentWriterId: string, guessedAuthorId: string) => Promise<void>;
  advanceClashGuessing: (force?: boolean) => Promise<void>;
  restartClashRound: () => Promise<void>;
  skipClashRound: () => Promise<void>;
  startIdeaGame: () => Promise<void>;
  submitIdea: (text: string) => Promise<void>;
  startIdeaRatingRounds: () => Promise<void>;
  submitIdeaRating: (ideaId: string, points: number, comment?: string) => Promise<void>;
  startNextIdeaRound: () => Promise<void>;
  restartIdeaRound: () => Promise<void>;
  skipIdeaRound: () => Promise<void>;
  updateIdeaIncognitoMode: (ideaIncognitoMode: boolean) => Promise<void>;
  // Admin target control functions
  setNextRoundTarget: (targetUserId: string) => Promise<void>;
  skipNextRoundTarget: (targetUserId: string) => Promise<void>;
  resetTargetControls: () => Promise<void>;
  startPostGuessingPointPhase: () => Promise<void>;
  awardPointsToPlayers: (
    awards: { recipientId: string; points: number }[],
  ) => Promise<void>;
  skipPostCommentPhase: () => Promise<void>;
  /**
   * Fetches every document in the `games` collection, unscoped to the
   * signed-in user — the only place in this app that reads across all
   * users' data. Used solely by the hidden /admin/cleanup page.
   */
  listAllGames: () => Promise<Game[]>;
  /** Deletes each listed game document. No subcollections exist for this
   * app's data model (comments/guesses/rounds are nested arrays inside the
   * game document itself), so nothing else needs cleaning up. Uses
   * Promise.allSettled (not Promise.all) so one failed delete doesn't mask
   * the others that succeeded — callers must reconcile using the returned
   * succeeded/failed lists rather than assuming all-or-nothing. */
  deleteGames: (
    gameIds: string[],
  ) => Promise<{ succeededIds: string[]; failedIds: string[] }>;
  /** Checks a candidate string against the real admin password stored in
   * Firestore, the same doc/field enterGame() already reads. Returns
   * true/false rather than throwing, so callers can show an inline error
   * instead of a thrown-exception flow. */
  checkAdminPassword: (input: string) => Promise<boolean>;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
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

  // Set up real-time listener for the current game.
  // Depends on both currentGame?.id and user?.uid so the listener is torn down
  // and recreated whenever the signed-in user changes (e.g. sign-out mid-game).
  useEffect(() => {
    // If the user signs out, clear the game immediately — no listener needed.
    if (!user) {
      setCurrentGame(null);
      return;
    }

    if (!currentGame?.id) {
      return;
    }

    const currentUserId = user.uid;
    const gameRef = doc(db, "games", currentGame.id);

    // Set up real-time listener
    const unsubscribe: Unsubscribe = onSnapshot(
      gameRef,
      (gameDoc) => {
        if (gameDoc.exists()) {
          const game = { id: gameDoc.id, ...gameDoc.data() } as Game;

          // Only update currentGame if the current user is still a participant.
          // Uses the uid captured at effect-creation time (not a stale closure).
          const isUserStillParticipant = game.participants?.some(
            (p) => p.userId === currentUserId,
          );

          if (isUserStillParticipant) {
            setCurrentGame(game);
          } else {
            // User is no longer a participant, clear currentGame
            setCurrentGame(null);
          }
        } else {
          // Game was deleted
          setCurrentGame(null);
        }
      },
      (error) => {
        console.error("Error listening to game updates:", error);
      },
    );

    // Cleanup listener on unmount or when game/user changes
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentGame?.id, user?.uid]);

  const createGame = async (
    adminWritesComments: boolean = false,
  ): Promise<string> => {
    if (!user) {
      throw new Error("You must be signed in to create a game");
    }

    try {
      setLoading(true);

      // Generate custom game ID using Ukrainian words
      let gameId: string;
      let attempts = 0;
      const maxAttempts = 10;

      do {
        gameId = generateGameId();
        attempts++;
        let idTaken = false;
        try {
          const existingDoc = await getDoc(doc(db, "games", gameId));
          idTaken = existingDoc.exists();
        } catch {
          // Permission-denied means a game exists here we can't read
          // (e.g. someone else's active game) — treat as taken.
          idTaken = true;
        }
        if (!idTaken) break;
        if (attempts >= maxAttempts)
          throw new Error(
            "Unable to generate unique game ID after multiple attempts",
          );
      } while (true);

      const now = new Date();
      const gameData = {
        adminId: user.uid,
        adminName: user.displayName || "Unknown",
        adminEmail: user.email || "",
        participants: [
          {
            userId: user.uid,
            userName: user.displayName || "Unknown",
            userEmail: user.email || "",
            photoURL: user.photoURL ?? null,
            joinedAt: now,
          },
        ],
        participantIds: [user.uid],
        createdAt: serverTimestamp(),
        status: "waiting" as const,
        adminWritesComments,
        showSurnames: false,
        showGuessResults: false,
        targetSelectionMode: "random",
        adminAwards: {},
      };

      // Use setDoc with custom ID instead of addDoc
      const docRef = doc(db, "games", gameId);
      await setDoc(docRef, gameData);

      // Set the game ID - the real-time listener will update the full game data
      const initialGame: Game = {
        id: gameId,
        ...gameData,
        createdAt: new Date(),
      } as Game;
      setCurrentGame(initialGame);

      return gameId;
    } catch (error: unknown) {
      console.error("Error creating game:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const joinGame = async (gameId: string): Promise<void> => {
    if (!user) {
      throw new Error("You must be signed in to join a game");
    }

    try {
      setLoading(true);

      const gameRef = doc(db, "games", gameId);
      let gameDoc;
      try {
        gameDoc = await getDoc(gameRef);
      } catch {
        // A permission-denied read here means the game exists but isn't
        // joinable right now (e.g. already in progress) — surface the
        // same not-found message rather than a raw Firebase error.
        throw new Error("game_not_found");
      }

      if (!gameDoc.exists()) {
        throw new Error("game_not_found");
      }

      const gameData = gameDoc.data();

      // Check if user is already a participant
      const isAlreadyParticipant = gameData.participants?.some(
        (p: Participant) => p.userId === user.uid,
      );

      if (isAlreadyParticipant) {
        // Backfill participantIds only for legacy games that predate this
        // field and genuinely lack it. arrayUnion on an already-present
        // value is a no-op for the document, but not for network cost —
        // skip the write entirely when it's not needed, rather than paying
        // for a redundant round-trip on every single re-visit.
        const needsBackfill = !(gameData.participantIds ?? []).includes(user.uid);
        if (needsBackfill) {
          await updateDoc(gameRef, {
            participantIds: arrayUnion(user.uid),
          });
        }
        await refreshGame(gameId);
        return;
      }

      // Add user as participant
      const newParticipant: Participant = {
        userId: user.uid,
        userName: user.displayName || "Unknown",
        userEmail: user.email || "",
        photoURL: user.photoURL ?? null,
        joinedAt: new Date(),
      };

      await updateDoc(gameRef, {
        participants: arrayUnion(newParticipant),
        participantIds: arrayUnion(user.uid),
      });

      // Set the game so the real-time listener starts (if not already set)
      // The listener will automatically update when the document changes
      if (!currentGame || currentGame.id !== gameId) {
        const updatedGameDoc = await getDoc(gameRef);
        if (updatedGameDoc.exists()) {
          const game = {
            id: updatedGameDoc.id,
            ...updatedGameDoc.data(),
          } as Game;
          setCurrentGame(game);
        }
      }
      // If already listening to this game, the listener will update automatically
    } catch (error: unknown) {
      console.error("Error joining game:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const enterGame = async (
    input: string,
    adminWritesComments?: boolean,
  ): Promise<string | void> => {
    if (!auth.currentUser) {
      throw new Error("You must be signed in to enter a game");
    }

    try {
      // Fetch the admin password from Firestore
      const passwordRef = doc(db, "password", "YR20RZ67FKy88HQVF6yW");
      const pwDoc = await getDoc(passwordRef);
      const adminPassword = pwDoc.exists()
        ? (pwDoc.data() as any).password
        : null;

      if (adminPassword && input === adminPassword) {
        // Input matches the admin password -> create a new game and return its id
        const newGameId = await createGame(adminWritesComments);
        return newGameId;
      } else {
        // Otherwise treat the input as a game ID and attempt to join
        await joinGame(input);
      }
    } catch (err) {
      console.error("Error in enterGame:", err);
      throw err;
    }
  };

  const leaveGame = async (): Promise<void> => {
    if (!auth.currentUser) {
      throw new Error("You must be signed in to leave a game");
    }
    if (!currentGame) {
      return; // Not in a game — nothing to do, not an error
    }

    try {
      setLoading(true);
      const gameRef = doc(db, "games", currentGame.id);

      // Remove participant in a transaction
      await runTransaction(db, async (transaction) => {
        const gameSnap = await transaction.get(gameRef);
        if (!gameSnap.exists()) {
          return;
        }

        const gameData = gameSnap.data() as Game;
        const leavingUid = auth.currentUser!.uid;
        const updatedParticipants = (gameData.participants || []).filter(
          (p) => p.userId !== leavingUid,
        );
        const updatedParticipantIds = updatedParticipants.map((p) => p.userId);

        // If leaving user was the admin, mark the game as finished and flag adminLeft
        if (gameData.adminId === leavingUid) {
          transaction.update(gameRef, {
            participants: updatedParticipants,
            participantIds: updatedParticipantIds,
            status: "finished",
            currentRound: null,
            adminLeft: true,
            adminNextTargetPreference: null,
            playersWhoCompletedPostCommentPhase: [],
          });
        } else {
          transaction.update(gameRef, {
            participants: updatedParticipants,
            participantIds: updatedParticipantIds,
          });
        }
      });

      // Locally clear currentGame so UI returns to join/create screen
      setCurrentGame(null);
    } catch (error: unknown) {
      console.error("Error leaving game:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const refreshGame = async (gameId: string): Promise<void> => {
    try {
      const gameRef = doc(db, "games", gameId);
      const gameDoc = await getDoc(gameRef);

      if (gameDoc.exists()) {
        const game = { id: gameDoc.id, ...gameDoc.data() } as Game;
        setCurrentGame(game);
      } else {
        setCurrentGame(null);
      }
    } catch (error: unknown) {
      console.error("Error refreshing game:", error);
      throw error;
    }
  };

  // Helper function to randomly select a participant (excluding admin)
  const selectRandomParticipant = (
    participants: Participant[],
    adminId: string,
  ): Participant | null => {
    const nonAdminParticipants = participants.filter(
      (p) => p.userId !== adminId,
    );
    if (nonAdminParticipants.length === 0) return null;
    const randomIndex = Math.floor(Math.random() * nonAdminParticipants.length);
    return nonAdminParticipants[randomIndex];
  };

  const startGame = async (): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame || auth.currentUser.uid !== currentGame.adminId) {
      throw new Error("Only the admin can start the game");
    }

    if (currentGame.participants.length < 2) {
      throw new Error("Need at least 2 participants to start the game");
    }

    try {
      setLoading(true);
      const gameRef = doc(db, "games", currentGame.id);

      // Select random participant (excluding admin)
      const target = selectRandomParticipant(
        currentGame.participants,
        currentGame.adminId,
      );
      if (!target) {
        throw new Error("No valid participants to select");
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
        status: "active",
        currentRound: round,
        rounds: [round],
        scores: {},
        roundStartScores: {},
        roundStartGuessResults: {},
        playerNumbers: buildJoinIndexById(currentGame.participants),
      });
    } catch (error: unknown) {
      console.error("Error starting game:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const submitComment = async (commentText: string): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame || !currentGame.currentRound) {
      throw new Error("No active round");
    }

    if (auth.currentUser.uid === currentGame.currentRound.targetUserId) {
      throw new Error("You cannot comment about yourself");
    }

    if (!commentText.trim()) {
      throw new Error("Comment cannot be empty");
    }

    if (commentText.trim().length > 500) {
      throw new Error("Comment must be 500 characters or fewer");
    }

    try {
      setLoading(true);
      const liveUid = auth.currentUser.uid;
      const gameRef = doc(db, "games", currentGame.id);

      await runTransaction(db, async (transaction: Transaction) => {
        const gameDoc = await transaction.get(gameRef);

        if (!gameDoc.exists()) {
          throw new Error("Game not found");
        }

        const gameData = gameDoc.data() as Game;
        const round = gameData.currentRound;

        if (!round) {
          throw new Error("No active round");
        }

        const existingComment = round.comments?.find(
          (c) => c.authorId === liveUid,
        );
        if (existingComment) {
          throw new Error("You have already submitted a comment for this round");
        }

        const newComment: Comment = {
          id: `${Date.now()}-${liveUid}`,
          authorId: liveUid,
          text: commentText.trim(),
          submittedAt: new Date(),
        };

        transaction.update(gameRef, {
          "currentRound.comments": [...(round.comments || []), newComment],
        });
      });
    } catch (error: unknown) {
      console.error("Error submitting comment:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const showComments = async (): Promise<void> => {
    if (!currentGame || !user || user.uid !== currentGame.adminId) {
      throw new Error("Only the admin can show comments");
    }

    if (!currentGame.currentRound) {
      throw new Error("No active round");
    }

    try {
      setLoading(true);
      const gameRef = doc(db, "games", currentGame.id);

      await updateDoc(gameRef, {
        "currentRound.commentsVisible": true,
      });
    } catch (error: unknown) {
      console.error("Error showing comments:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const awardCommentPoints = async (
    commentId: string,
    points: number,
  ): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame || !currentGame.currentRound) {
      throw new Error("No active round");
    }

    if (auth.currentUser.uid !== currentGame.currentRound.targetUserId) {
      throw new Error("Only the target person can give points");
    }

    // Allow awarding points to multiple commenters within the same round.
    // We'll mark the round's `pointsGiven` flag only when all comments have been awarded.

    try {
      setLoading(true);
      const gameRef = doc(db, "games", currentGame.id);

      await runTransaction(db, async (transaction: Transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) {
          throw new Error("Game not found");
        }

        const gameData = gameDoc.data() as Game;
        const currentRound = gameData.currentRound;

        if (!currentRound) {
          throw new Error("No active round");
        }

        // Find the comment and update it with points
        const updatedComments = currentRound.comments.map((comment) => {
          if (comment.id === commentId) {
            return { ...comment, points };
          }
          return comment;
        });

        const comment = updatedComments.find((c) => c.id === commentId);
        if (!comment) return;

        const authorCurrentScore = gameData.scores?.[comment.authorId] || 0;

        // Update comments and the awarded author's score, but don't
        // automatically set pointsGiven — the target explicitly marks when
        // they're done giving points.
        transaction.update(gameRef, {
          "currentRound.comments": updatedComments,
          [`scores.${comment.authorId}`]: authorCurrentScore + points,
        });
      });
    } catch (error: unknown) {
      console.error("Error giving points:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const finishAwardingPoints = async (): Promise<void> => {
    if (!currentGame || !user || !currentGame.currentRound) {
      throw new Error("No active round");
    }

    if (user.uid !== currentGame.currentRound.targetUserId) {
      throw new Error("Only the target can finish giving points");
    }

    try {
      setLoading(true);
      const gameRef = doc(db, "games", currentGame.id);
      const gameDoc = await getDoc(gameRef);

      if (!gameDoc.exists()) {
        throw new Error("Game not found");
      }

      const gameData = gameDoc.data() as Game;
      const currentRound = gameData.currentRound;

      if (!currentRound) {
        throw new Error("No active round");
      }

      if (currentRound.targetUserId !== user.uid) {
        throw new Error("Only the target can finish giving points");
      }

      // Mark that the target has finished giving points
      await updateDoc(gameRef, {
        "currentRound.pointsGiven": true,
      });
    } catch (error: unknown) {
      console.error("Error finishing giving points:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const givePointsToTarget = async (targetUserId: string, points = 1) => {
    if (!currentGame?.currentRound) throw new Error("No active round");
    const userId = user?.uid;
    if (!userId) throw new Error("Must be signed in to give points");
    // Prevent duplicate giving
    if (currentGame.currentRound.targetPointsGivenBy?.includes(userId)) {
      throw new Error("You already gave points to this target this round");
    }

    // Keep previous state to rollback on failure
    const prevGame = currentGame;

    // Optimistic update locally
    const updatedRound = {
      ...currentGame.currentRound,
      targetPoints: (currentGame.currentRound.targetPoints ?? 0) + points,
      targetPointsGivenBy: [
        ...(currentGame.currentRound.targetPointsGivenBy ?? []),
        userId,
      ],
    };

    const updatedScores = {
      ...(currentGame.scores ?? {}),
      [targetUserId]: (currentGame.scores?.[targetUserId] ?? 0) + points,
    };

    setCurrentGame({
      ...currentGame,
      currentRound: updatedRound,
      scores: updatedScores,
    });

    try {
      setLoading(true);
      const gameRef = doc(db, "games", currentGame.id);

      await runTransaction(db, async (transaction: Transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game not found");

        const gameData = gameDoc.data() as Game;
        const round = gameData.currentRound;
        if (!round) throw new Error("No active round on server");

        // Re-check inside transaction — another client may have already recorded this user
        if (round.targetPointsGivenBy?.includes(userId)) {
          throw new Error("You already gave points to this target this round");
        }

        const newScores = {
          ...(gameData.scores ?? {}),
          [targetUserId]: (gameData.scores?.[targetUserId] ?? 0) + points,
        };

        transaction.update(gameRef, {
          "currentRound.targetPoints": (round.targetPoints ?? 0) + points,
          "currentRound.targetPointsGivenBy": arrayUnion(userId),
          [`currentRound.targetPointsByPlayer.${userId}`]: points,
          scores: newScores,
          playersWhoCompletedPostCommentPhase: arrayUnion(userId),
        });
      });
      // onSnapshot will replace local optimistic state with authoritative server state
    } catch (err) {
      // Rollback optimistic update on error
      setCurrentGame(prevGame);
      console.error("Error giving points to target:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const submitGuess = async (
    roundNumber: number,
    commentId: string,
    guessedAuthorId: string,
  ): Promise<void> => {
    if (!currentGame || !user) throw new Error("No active game or user");
    const userId = user.uid;

    // Find the round (either currentRound or from completed rounds)
    let round: Round | undefined;
    let isCurrent = false;
    if (
      currentGame.currentRound &&
      currentGame.currentRound.roundNumber === roundNumber
    ) {
      round = currentGame.currentRound;
      isCurrent = true;
    } else {
      round = currentGame.rounds?.find((r) => r.roundNumber === roundNumber);
    }

    if (!round) throw new Error("Round not found");
    if (!round.commentsVisible) throw new Error("Comments are not visible");
    // Only the round target should be submitting guesses for comments about them
    if (userId !== round.targetUserId)
      throw new Error("Only the target can make guesses");
    if (round.guessesFinalized)
      throw new Error("This round's guessing has already been finalized");

    // Prevent duplicate guesses for the same comment by the same user
    if (
      round.guesses?.some(
        (g) => g.commentId === commentId && g.guesserId === userId,
      )
    ) {
      throw new Error("You already guessed for this comment");
    }

    const comment = round.comments.find((c) => c.id === commentId);
    if (!comment) throw new Error("Comment not found");

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
      const gameRef = doc(db, "games", currentGame.id);

      // Use a transaction to safely append guesses and avoid overwriting concurrent updates
      await runTransaction(db, async (transaction) => {
        const gameSnap = await transaction.get(gameRef);
        if (!gameSnap.exists()) throw new Error("Game not found");
        const gameData = gameSnap.data() as Game;

        if (isCurrent) {
          const current = gameData.currentRound;
          if (!current) throw new Error("No active round on server");
          const updatedGuesses = [...(current.guesses || []), newGuess];
          const updates: any = {
            "currentRound.guesses": updatedGuesses,
          };
          if (correct) {
            updates["currentRound.targetCorrectGuesses"] =
              (current.targetCorrectGuesses ?? 0) + 1;
          }
          transaction.update(gameRef, updates);
        } else {
          const serverRounds = gameData.rounds || [];
          const updatedRounds = serverRounds.map((r) => {
            if (r.roundNumber === roundNumber) {
              return {
                ...r,
                guesses: [...(r.guesses ?? []), newGuess],
                targetCorrectGuesses:
                  (r.targetCorrectGuesses ?? 0) + (correct ? 1 : 0),
              };
            }
            return r;
          });
          transaction.update(gameRef, { rounds: updatedRounds });
        }
      });

      // After submitting a guess, check if the guesser has completed all guesses for their own target and mark them as submitted
      try {
        const gameDocAfter = await getDoc(gameRef);
        if (gameDocAfter.exists()) {
          const serverGame = gameDocAfter.data() as Game;
          const playersComments =
            serverGame.guessingData?.commentsByTarget?.[userId] || [];
          const numComments = playersComments.length;

          // Count guesses by this user for comments about themselves across rounds and currentRound
          let numGuessesByUser = 0;
          const serverRounds = serverGame.rounds || [];
          for (const r of serverRounds) {
            if (r.targetUserId === userId && r.guesses) {
              numGuessesByUser += r.guesses.filter(
                (g) => g.guesserId === userId,
              ).length;
            }
          }
          // include currentRound guesses if applicable
          if (
            serverGame.currentRound &&
            serverGame.currentRound.targetUserId === userId &&
            serverGame.currentRound.guesses
          ) {
            numGuessesByUser += serverGame.currentRound.guesses.filter(
              (g) => g.guesserId === userId,
            ).length;
          }

          const alreadySubmitted =
            serverGame.guessingData?.playersWhoSubmittedGuesses?.includes(
              userId,
            );
          if (!alreadySubmitted && numGuessesByUser >= numComments) {
            const playersAlready =
              serverGame.guessingData?.playersWhoSubmittedGuesses || [];
            // For Mirror mode, only count targets in the current guessing data
            const targetCount = Object.keys(serverGame.guessingData?.commentsByTarget || {}).length;
            const totalTargets = targetCount > 0 ? targetCount : (serverGame.participants?.length ?? 0) - 1;
            const allSubmitted = playersAlready.length + 1 >= totalTargets;

            // Count correct guesses by this player across ALL rounds (sum from source data,
            // not incrementally, so finalizeGuessingPhase can safely overwrite without double-counting)
            let correctGuessCount = 0;
            for (const r of serverRounds) {
              if (r.guesses) {
                correctGuessCount += r.guesses.filter(
                  (g: Guess) => g.guesserId === userId && g.correct,
                ).length;
              }
            }
            if (serverGame.currentRound?.guesses) {
              correctGuessCount += serverGame.currentRound.guesses.filter(
                (g: Guess) => g.guesserId === userId && g.correct,
              ).length;
            }

            await updateDoc(gameRef, {
              "guessingData.playersWhoSubmittedGuesses": arrayUnion(userId),
              "guessingData.allPlayersSubmitted": allSubmitted,
              [`guessResults.${userId}`]: { correctGuesses: correctGuessCount },
            });
          }
          // Edge case: if player has zero comments, mark them submitted immediately
          if (!alreadySubmitted && numComments === 0) {
            const playersAlready =
              serverGame.guessingData?.playersWhoSubmittedGuesses || [];
            // For Mirror mode, only count targets in the current guessing data
            const targetCount = Object.keys(serverGame.guessingData?.commentsByTarget || {}).length;
            const totalTargets = targetCount > 0 ? targetCount : (serverGame.participants?.length ?? 0) - 1;
            const allSubmitted = playersAlready.length + 1 >= totalTargets;
            await updateDoc(gameRef, {
              "guessingData.playersWhoSubmittedGuesses": arrayUnion(userId),
              "guessingData.allPlayersSubmitted": allSubmitted,
              [`guessResults.${userId}`]: { correctGuesses: 0 },
            });
          }
        }
      } catch (e) {
        console.error("Error updating guessing submission state", e);
      }
    } catch (err) {
      console.error("Error submitting guess:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const startNextRound = async (): Promise<void> => {
    if (!currentGame || !user || user.uid !== currentGame.adminId) {
      throw new Error("Only the admin can start the next round");
    }

    try {
      setLoading(true);
      const gameRef = doc(db, "games", currentGame.id);
      const gameDoc = await getDoc(gameRef);

      if (!gameDoc.exists()) {
        throw new Error("Game not found");
      }

      const gameData = gameDoc.data() as Game;
      const currentRoundData = gameData.currentRound; // may be null after per-round guessing
      let previousRounds = gameData.rounds || [];

      // If there's an active currentRound that is completed, save it as completed
      if (
        currentRoundData &&
        currentRoundData.commentsVisible &&
        currentRoundData.pointsGiven
      ) {
        const completedRound: Round = {
          ...currentRoundData,
          commentsVisible: true,
          pointsGiven: true,
        };

        const roundIndex = previousRounds.findIndex(
          (r) => r.roundNumber === currentRoundData.roundNumber,
        );
        if (roundIndex >= 0) {
          previousRounds[roundIndex] = completedRound;
        } else {
          previousRounds = [...previousRounds, completedRound];
        }
      }

      const usedTargets = previousRounds.map((r) => r.targetUserId);

      // Get participants who haven't been targets yet (include admin if adminWritesComments is true)
      const skippedTargets = gameData.adminSkippedTargets || [];
      const availableParticipants = (gameData.participants || []).filter(
        (p) => {
          // Always exclude admin if adminWritesComments is false
          if (p.userId === gameData.adminId && !(gameData.adminWritesComments ?? false)) {
            return false;
          }
          // Exclude anyone who has already been a target
          if (usedTargets.includes(p.userId)) {
            return false;
          }
          // Exclude anyone who has been skipped by admin
          if (skippedTargets.includes(p.userId)) {
            return false;
          }
          return true;
        },
      );

      if (availableParticipants.length === 0) {
        // All participants have been targets, game finished
        await updateDoc(gameRef, {
          status: "finished",
          currentRound: null,
          rounds: previousRounds,
        });
        return;
      }

      // Check if admin has a preferred target
      let target: Participant;
      if (
        gameData.adminNextTargetPreference &&
        availableParticipants.some(
          (p) => p.userId === gameData.adminNextTargetPreference,
        )
      ) {
        // Use admin's preferred target
        target = availableParticipants.find(
          (p) => p.userId === gameData.adminNextTargetPreference,
        )!;

        // Clear the preference after using it
        await updateDoc(gameRef, {
          adminNextTargetPreference: null,
        });
      } else if (gameData.targetSelectionMode === 'chronological') {
        target = sortParticipantsByJoin(availableParticipants)[0];
      } else {
        // Select random participant from available ones
        const randomIndex = Math.floor(
          Math.random() * availableParticipants.length,
        );
        target = availableParticipants[randomIndex];
      }

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
        rounds: previousRounds,
        postGuessingPointPhase: false,
        playersWhoAwardedPostGuessPoints: [],
        // Reset admin target controls for new round
        adminNextTargetPreference: null,
        adminSkippedTargets: [],
        playersWhoCompletedPostCommentPhase: [],
        guessingData: null,
        // Freeze the leaderboard for the round that's about to start at
        // whatever scores/guessResults stood the instant it began — i.e.
        // the just-finished round's final results.
        roundStartScores: gameData.scores ?? {},
        roundStartGuessResults: gameData.guessResults ?? {},
      });
    } catch (error: unknown) {
      console.error("Error starting next round:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const startGuessingPhase = async (): Promise<void> => {
    if (!currentGame || !user || user.uid !== currentGame.adminId) {
      throw new Error("Only the admin can start the guessing phase");
    }

    // Check if all non-target players have completed the post-comment phase
    let nonTargetPlayers = currentGame.participants.filter(
      (p) => p.userId !== currentGame.currentRound?.targetUserId,
    );

    // If admin doesn't write comments, exclude admin from the check
    if (!(currentGame.adminWritesComments ?? false)) {
      nonTargetPlayers = nonTargetPlayers.filter(
        (p) => p.userId !== currentGame.adminId,
      );
    }

    const completedPlayers =
      currentGame.playersWhoCompletedPostCommentPhase || [];
    const incompletePlayers = nonTargetPlayers.filter(
      (p) => !completedPlayers.includes(p.userId),
    );

    if (incompletePlayers.length > 0) {
      throw new Error(
        `Cannot start guessing phase. Waiting for ${incompletePlayers.length} player(s) to complete the post-comment phase.`,
      );
    }

    // Two modes:
    // 1) If the current round is completed (commentsVisible && pointsGiven) -> start guessing for *that* round only.
    // 2) Otherwise (legacy or admin wants to start final guessing) -> use all completed rounds (from `rounds`).
    try {
      setLoading(true);

      const gameRef = doc(db, "games", currentGame.id);
      const gameDoc = await getDoc(gameRef);
      if (!gameDoc.exists()) throw new Error("Game not found");
      const gameData = gameDoc.data() as Game;

      const possibleAuthors = currentGame.participants.map((p) => ({
        userId: p.userId,
        userName: p.userName,
      }));

      // If there is a completed currentRound, start guessing for that round only
      if (
        currentGame.currentRound &&
        currentGame.currentRound.commentsVisible &&
        currentGame.currentRound.pointsGiven
      ) {
        const completedRounds: Round[] = [...(gameData.rounds || [])];
        // Use server's currentRound to ensure we have the latest data
        const serverCurrentRound = gameData.currentRound;
        if (!serverCurrentRound) {
          throw new Error("Current round not found on server");
        }
        // ensure currentRound is saved in rounds (use server version for accuracy)
        // Ensure guesses array is initialized
        const roundToSave: Round = {
          ...serverCurrentRound,
          guesses: serverCurrentRound.guesses || [],
        };
        if (
          !completedRounds.some(
            (r) => r.roundNumber === serverCurrentRound.roundNumber,
          )
        ) {
          completedRounds.push(roundToSave);
        } else {
          // Update existing round with server data
          const index = completedRounds.findIndex(
            (r) => r.roundNumber === serverCurrentRound.roundNumber,
          );
          if (index >= 0) {
            completedRounds[index] = roundToSave;
          }
        }

        const commentsByTarget: { [key: string]: Comment[] } = {};
        commentsByTarget[serverCurrentRound.targetUserId] =
          serverCurrentRound.comments || [];

        const guessingData: GuessingData = {
          commentsByTarget,
          possibleAuthors,
          playersWhoSubmittedGuesses: [],
          allPlayersSubmitted: false,
          singleRoundTargetId: serverCurrentRound.targetUserId,
        };

        await updateDoc(gameRef, {
          status: "guessing_phase",
          guessingData,
          // Preserve existing guessResults instead of overwriting them
          rounds: completedRounds,
          currentRound: null,
          guessResults: gameData.guessResults || {},
        });
        return;
      }

      // Legacy/fallback: use completed rounds in `rounds` (e.g., final-phase guessing)
      const completedRounds: Round[] = [...(gameData.rounds || [])];
      if (completedRounds.length === 0) {
        throw new Error("No completed rounds to start guessing");
      }

      const commentsByTarget: { [key: string]: Comment[] } = {};
      for (const round of completedRounds) {
        commentsByTarget[round.targetUserId] = round.comments || [];
      }

      const guessingDataAll: GuessingData = {
        commentsByTarget,
        possibleAuthors,
        playersWhoSubmittedGuesses: [],
        allPlayersSubmitted: false,
      };

      await updateDoc(gameRef, {
        status: "guessing_phase",
        guessingData: guessingDataAll,
        // Preserve existing guessResults instead of overwriting them
        rounds: completedRounds,
        currentRound: null,
        guessResults: gameData.guessResults || {},
      });
    } catch (err) {
      console.error("Error starting guessing phase:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const markPlayerGuessesSubmitted = async (
    userIdParam?: string,
    precomputedCorrectGuesses?: number,
  ): Promise<void> => {
    if (!currentGame || !user) throw new Error("No active game or user");
    // Only the admin may mark a player other than themselves as submitted.
    if (
      userIdParam &&
      userIdParam !== user.uid &&
      user.uid !== currentGame.adminId
    ) {
      throw new Error("Only the admin can mark another player as submitted");
    }
    const playerId = userIdParam ?? user.uid;

    try {
      setLoading(true);
      const gameRef = doc(db, "games", currentGame.id);
      const gameDoc = await getDoc(gameRef);

      if (!gameDoc.exists()) {
        throw new Error("Game not found");
      }

      const gameData = gameDoc.data() as Game;
      const playersAlready =
        gameData.guessingData?.playersWhoSubmittedGuesses || [];
      const playersAlreadyArray = arrayUnion(playerId);
      const totalTargets = (gameData.participants?.length ?? 0) - 1;
      const allSubmitted = playersAlready.length + 1 >= totalTargets;

      // Use the caller-supplied count when available (computed locally in the component
      // from selectedGuesses — avoids any Firestore read-after-write timing issues).
      // Fall back to counting from rounds for admin-marking-other-player calls.
      let correctGuessCount: number;
      if (precomputedCorrectGuesses !== undefined) {
        correctGuessCount = precomputedCorrectGuesses;
      } else {
        const allRounds = [
          ...(gameData.rounds || []),
          ...(gameData.currentRound ? [gameData.currentRound] : []),
        ];
        correctGuessCount = 0;
        for (const r of allRounds) {
          if (r.guesses) {
            correctGuessCount += r.guesses.filter(
              (g: Guess) => g.guesserId === playerId && g.correct,
            ).length;
          }
        }
      }

      const updates: any = {
        "guessingData.playersWhoSubmittedGuesses": playersAlreadyArray,
        "guessingData.allPlayersSubmitted": allSubmitted,
        [`guessResults.${playerId}`]: { correctGuesses: correctGuessCount },
      };

      // Start post-guessing point phase when ALL players have submitted their guesses
      if (allSubmitted) {
        updates.postGuessingPointPhase = true;
        updates.playersWhoAwardedPostGuessPoints = [];
      }

      await updateDoc(gameRef, updates);
    } catch (err) {
      console.error("Error marking player as submitted:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const finalizeGuessingPhase = async (): Promise<void> => {
    if (!currentGame || !user || user.uid !== currentGame.adminId) {
      throw new Error("Only the admin can finalize the guessing phase");
    }

    try {
      setLoading(true);
      const gameRef = doc(db, "games", currentGame.id);
      const gameDoc = await getDoc(gameRef);
      if (!gameDoc.exists()) throw new Error("Game not found");

      const gameData = gameDoc.data() as Game;
      const serverRounds = gameData.rounds || [];

      // Ensure any completed currentRound is included in final rounds saved to the document
      // Use a fresh read to ensure we have the latest round data with guesses
      const finalRounds: Round[] = serverRounds.map((r) => ({ ...r })); // Deep copy to ensure we have latest data
      if (
        gameData.currentRound &&
        gameData.currentRound.commentsVisible &&
        gameData.currentRound.pointsGiven
      ) {
        const existingIndex = finalRounds.findIndex(
          (r) => r.roundNumber === gameData.currentRound!.roundNumber,
        );
        if (existingIndex >= 0) {
          // Update existing round with latest server data
          finalRounds[existingIndex] = { ...gameData.currentRound };
        } else {
          finalRounds.push({ ...gameData.currentRound });
        }
      }

      // Determine whether this guessing phase was a per-round session (singleRoundTargetId set)
      const isPerRoundGuessing = !!gameData.guessingData?.singleRoundTargetId;

      // Aggregate correct guesses per guesser
      const guessCounts: { [userId: string]: number } = {};

      // Count correct guesses from all rounds (both per-round and final guessing paths use
      // the same full-recompute approach so that early writes in submitGuess are idempotent)
      for (const r of finalRounds) {
        if (!r.guesses) continue;
        for (const g of r.guesses) {
          if (g.correct) {
            guessCounts[g.guesserId] = (guessCounts[g.guesserId] ?? 0) + 1;
          }
        }
      }

      // Build guessResults - do NOT add guess points to scores
      // scores should only contain game points (from comments and target points)
      // guessResults contains guess points separately
      const mergedGuessResults: {
        [userId: string]: { correctGuesses: number };
      } = { ...(gameData.guessResults ?? {}) };
      // Keep scores as-is (only game points, no guess points)
      const newScores = { ...(gameData.scores ?? {}) };

      // Always overwrite with the freshly computed total (safe to overwrite because submitGuess
      // may have already written partial results using the same full-recompute logic)
      for (const [uid, count] of Object.entries(guessCounts)) {
        mergedGuessResults[uid] = { correctGuesses: count };
      }

      if (!isPerRoundGuessing) {
        // Finalize and finish the game — stamp all rounds as finalized
        const stampedRounds = finalRounds.map((r) => ({ ...r, guessesFinalized: true }));
        await updateDoc(gameRef, {
          status: "finished",
          guessResults: mergedGuessResults,
          scores: newScores,
          rounds: stampedRounds,
          currentRound: null,
        });
      } else {
        // Per-round guessing session — stamp only the round that was just guessed
        const singleTargetId = gameData.guessingData?.singleRoundTargetId;
        const stampedRounds = finalRounds.map((r) =>
          r.targetUserId === singleTargetId ? { ...r, guessesFinalized: true } : r,
        );
        await updateDoc(gameRef, {
          status: "active",
          guessingData: {},
          guessResults: mergedGuessResults,
          scores: newScores,
          rounds: stampedRounds,
          currentRound: null,
        });
      }
    } catch (err) {
      console.error("Error finalizing guessing phase:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const restartMirrorRound = async (): Promise<void> => {
    if (!currentGame || !user || user.uid !== currentGame.adminId) {
      throw new Error("Only the admin can restart the round");
    }
    try {
      setLoading(true);
      const gameRef = doc(db, "games", currentGame.id);
      await runTransaction(db, async (transaction: Transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game not found");
        const gameData = gameDoc.data() as Game;

        let target: { targetUserId: string; targetUserName: string; roundNumber: number };
        let remainingRounds = gameData.rounds ?? [];

        if (gameData.currentRound) {
          target = gameData.currentRound;
        } else {
          const singleTargetId = gameData.guessingData?.singleRoundTargetId;
          const foundRound = singleTargetId
            ? remainingRounds.find((r) => r.targetUserId === singleTargetId)
            : undefined;
          if (!foundRound) throw new Error("No active round to restart");
          target = foundRound;
          remainingRounds = remainingRounds.filter((r) => r.roundNumber !== foundRound.roundNumber);
        }

        const restartedRound: Round = {
          roundNumber: target.roundNumber,
          targetUserId: target.targetUserId,
          targetUserName: target.targetUserName,
          comments: [],
          commentsVisible: false,
          pointsGiven: false,
          startedAt: new Date(),
          targetPoints: 0,
          targetPointsGivenBy: [],
          targetPointsByPlayer: {},
          guesses: [],
          targetCorrectGuesses: 0,
          guessesFinalized: false,
        };

        const adminAwards = gameData.adminAwards ?? {};
        const filteredAdminAwards = Object.fromEntries(
          Object.entries(adminAwards).map(([uid, awards]) => [
            uid,
            awards.filter((a) => a.roundNumber !== target.roundNumber),
          ]),
        );

        const updates: Record<string, unknown> = {
          status: "active",
          currentRound: restartedRound,
          rounds: remainingRounds,
          postGuessingPointPhase: false,
          playersWhoAwardedPostGuessPoints: [],
          guessingData: null,
          playersWhoCompletedPostCommentPhase: [],
          adminAwards: filteredAdminAwards,
        };
        if (gameData.roundStartScores !== undefined) {
          updates.scores = gameData.roundStartScores;
        }
        if (gameData.roundStartGuessResults !== undefined) {
          updates.guessResults = gameData.roundStartGuessResults;
        }
        transaction.update(gameRef, updates);
      });
    } catch (err) {
      console.error("Error restarting round:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const skipMirrorRound = async (): Promise<void> => {
    if (!currentGame || !user || user.uid !== currentGame.adminId) {
      throw new Error("Only the admin can start the next round");
    }
    const round = currentGame.currentRound;
    const isAbandonedMidRound = round && !(round.commentsVisible && round.pointsGiven);
    if (isAbandonedMidRound) {
      const gameRef = doc(db, "games", currentGame.id);
      await updateDoc(gameRef, {
        adminSkippedTargets: arrayUnion(round.targetUserId),
      });
    }
    await startNextRound();
  };

  const updateAdminWritesComments = async (
    adminWritesComments: boolean,
  ): Promise<void> => {
    if (!currentGame || !user || user.uid !== currentGame.adminId) {
      throw new Error("Only the admin can update this setting");
    }

    if (currentGame.status !== "waiting") {
      throw new Error(
        "This setting can only be updated before the game starts",
      );
    }

    try {
      setLoading(true);
      const gameRef = doc(db, "games", currentGame.id);

      await updateDoc(gameRef, {
        adminWritesComments,
      });
    } catch (err) {
      console.error("Error updating admin writes comments setting:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateShowSurnames = async (showSurnames: boolean): Promise<void> => {
    if (!currentGame || !user || user.uid !== currentGame.adminId) {
      throw new Error("Only the admin can update this setting");
    }

    if (currentGame.status !== "waiting") {
      throw new Error(
        "This setting can only be updated before the game starts",
      );
    }

    try {
      setLoading(true);
      const gameRef = doc(db, "games", currentGame.id);

      await updateDoc(gameRef, {
        showSurnames,
      });
    } catch (err) {
      console.error("Error updating show surnames setting:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateTargetSelectionMode = async (
    targetSelectionMode: "random" | "chronological",
  ): Promise<void> => {
    if (!currentGame || !user || user.uid !== currentGame.adminId) {
      throw new Error("Only the admin can update this setting");
    }

    if (currentGame.status !== "waiting") {
      throw new Error(
        "This setting can only be updated before the game starts",
      );
    }

    try {
      setLoading(true);
      const gameRef = doc(db, "games", currentGame.id);

      await updateDoc(gameRef, {
        targetSelectionMode,
      });
    } catch (err) {
      console.error("Error updating target selection mode setting:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateShowGuessResults = async (
    showGuessResults: boolean,
  ): Promise<void> => {
    if (!currentGame || !user || user.uid !== currentGame.adminId) {
      throw new Error("Only the admin can update this setting");
    }

    if (currentGame.status !== "waiting") {
      throw new Error(
        "This setting can only be updated before the game starts",
      );
    }

    try {
      setLoading(true);
      const gameRef = doc(db, "games", currentGame.id);

      await updateDoc(gameRef, {
        showGuessResults,
      });
    } catch (err) {
      console.error("Error updating show guess results setting:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const startBasketGame = async (): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame || auth.currentUser.uid !== currentGame.adminId) {
      throw new Error("Only the admin can start the game");
    }
    if (currentGame.participants.length < 2) {
      throw new Error("Need at least 2 participants to start the game");
    }
    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      const writers = (currentGame.adminWritesComments ?? false)
        ? currentGame.participants.map((p: Participant) => p.userId)
        : currentGame.participants.filter((p: Participant) => p.userId !== currentGame.adminId).map((p: Participant) => p.userId);
      if (writers.length < 2) {
        throw new Error("Need at least 2 players (excluding admin) to start Basket game. Enable 'Admin writes comments' or add more players.");
      }
      const schedule = generateBasketSchedule(writers);
      await updateDoc(gameRef, {
        status: 'basket_writing',
        basketData: { schedule, currentRoundIndex: 0, currentRoundComments: [], currentRoundGuesses: [] },
      });
    } catch (err) {
      console.error('Error starting basket game:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const submitBasketComment = async (text: string): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame?.basketData) throw new Error("No active basket game");
    if (!text.trim()) throw new Error("Comment cannot be empty");
    const { schedule, currentRoundIndex } = currentGame.basketData;
    const assignment = schedule[currentRoundIndex].assignments.find(
      (a: BasketAssignment) => a.writerId === auth.currentUser!.uid
    );
    if (!assignment) throw new Error("No assignment found for this player");
    const comment: BasketComment = {
      writerId: auth.currentUser.uid,
      subjectId: assignment.subjectId,
      text: text.trim(),
      submittedAt: Date.now(),
    };
    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      await updateDoc(gameRef, { 'basketData.currentRoundComments': arrayUnion(comment) });
    } catch (err) {
      console.error('Error submitting basket comment:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const revealBasketComments = async (): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame || auth.currentUser.uid !== currentGame.adminId) {
      throw new Error("Only the admin can reveal comments");
    }
    const submitted = currentGame.basketData?.currentRoundComments?.length ?? 0;
    // Compare against this round's writers, not every participant — the
    // admin is never a writer unless adminWritesComments is on, so
    // comparing against participants.length made this unreachable whenever
    // it was off (the default): submitted could never reach a total that
    // included a non-writing admin.
    const total =
      currentGame.basketData?.schedule[currentGame.basketData.currentRoundIndex]
        ?.assignments.length ?? 0;
    if (submitted < total) {
      throw new Error(`Not all players have submitted (${submitted}/${total})`);
    }
    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      await updateDoc(gameRef, { status: 'basket_guessing' });
    } catch (err) {
      console.error('Error revealing basket comments:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const submitBasketCommentGuess = async (commentWriterId: string): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame?.basketData) throw new Error("No active basket game");
    const guesserId = auth.currentUser.uid;
    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      await runTransaction(db, async (transaction: Transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game not found");
        const gameData = gameDoc.data() as Game;
        if (!gameData.basketData) throw new Error("No active basket game");
        const { currentRoundComments, currentRoundGuesses } = gameData.basketData;
        if (currentRoundGuesses.some((g: BasketGuess) => g.guesserId === guesserId)) {
          throw new Error("Comment guess already submitted for this round");
        }
        const actualComment = currentRoundComments.find((c: BasketComment) => c.subjectId === guesserId);
        if (!actualComment) throw new Error("No comment found for this player");
        const commentCorrect = actualComment.writerId === commentWriterId;
        const guess: BasketGuess = {
          guesserId, commentWriterId, commentCorrect, authorCorrect: false,
          pointsAwarded: commentCorrect ? 1 : 0,
        };
        const updates: Record<string, unknown> = {
          'basketData.currentRoundGuesses': [...currentRoundGuesses, guess],
        };
        if (commentCorrect) {
          updates[`scores.${guesserId}`] = (gameData.scores?.[guesserId] ?? 0) + 1;
        }
        transaction.update(gameRef, updates);
      });
    } catch (err) {
      console.error('Error submitting basket comment guess:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const submitBasketAuthorGuess = async (authorGuessId: string): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame?.basketData) throw new Error("No active basket game");
    const guesserId = auth.currentUser.uid;
    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      await runTransaction(db, async (transaction: Transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game not found");
        const gameData = gameDoc.data() as Game;
        if (!gameData.basketData) throw new Error("No active basket game");
        const { schedule, currentRoundIndex, currentRoundGuesses } = gameData.basketData;
        const existingGuess = currentRoundGuesses.find((g: BasketGuess) => g.guesserId === guesserId);
        if (!existingGuess?.commentCorrect) {
          throw new Error("Cannot guess author without a correct comment guess");
        }
        if (existingGuess.authorGuessId !== undefined) {
          throw new Error("Author guess already submitted for this round");
        }
        const assignment = schedule[currentRoundIndex].assignments.find((a: BasketAssignment) => a.subjectId === guesserId);
        if (!assignment) throw new Error("No assignment found for this player");
        const authorCorrect = authorGuessId === assignment.writerId;
        const updatedGuesses = currentRoundGuesses.map((g: BasketGuess) =>
          g.guesserId === guesserId
            ? { ...g, authorGuessId, authorCorrect, pointsAwarded: g.pointsAwarded + (authorCorrect ? 1 : 0) }
            : g
        );
        const updates: Record<string, unknown> = {
          'basketData.currentRoundGuesses': updatedGuesses,
        };
        if (authorCorrect) {
          updates[`scores.${guesserId}`] = (gameData.scores?.[guesserId] ?? 0) + 1;
        }
        transaction.update(gameRef, updates);
      });
    } catch (err) {
      console.error('Error submitting basket author guess:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const startNextBasketRound = async (): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame || auth.currentUser.uid !== currentGame.adminId) {
      throw new Error("Only the admin can start the next round");
    }
    if (!currentGame.basketData) throw new Error("No active basket game");
    const { schedule, currentRoundIndex } = currentGame.basketData;
    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      if (currentRoundIndex + 1 >= schedule.length) {
        await updateDoc(gameRef, { status: 'finished' });
      } else {
        await updateDoc(gameRef, {
          status: 'basket_writing',
          'basketData.currentRoundIndex': currentRoundIndex + 1,
          'basketData.currentRoundComments': [],
          'basketData.currentRoundGuesses': [],
        });
      }
    } catch (err) {
      console.error('Error starting next basket round:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const restartBasketRound = async (): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame || auth.currentUser.uid !== currentGame.adminId) {
      throw new Error("Only the admin can restart the round");
    }
    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      await runTransaction(db, async (transaction: Transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game not found");
        const gameData = gameDoc.data() as Game;
        if (!gameData.basketData) throw new Error("No active basket game");
        const { currentRoundGuesses } = gameData.basketData;

        const scoreDeltas: Record<string, number> = {};
        currentRoundGuesses.forEach((g: BasketGuess) => {
          scoreDeltas[g.guesserId] = (scoreDeltas[g.guesserId] ?? 0) + g.pointsAwarded;
        });

        const updates: Record<string, unknown> = {
          status: 'basket_writing',
          'basketData.currentRoundComments': [],
          'basketData.currentRoundGuesses': [],
        };
        Object.entries(scoreDeltas).forEach(([uid, delta]) => {
          if (delta === 0) return;
          updates[`scores.${uid}`] = (gameData.scores?.[uid] ?? 0) - delta;
        });

        transaction.update(gameRef, updates);
      });
    } catch (err) {
      console.error('Error restarting basket round:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const skipBasketRound = async (): Promise<void> => {
    await startNextBasketRound();
  };

  const setGameType = async (type: 'mirror' | 'basket' | 'clash' | 'ideas'): Promise<void> => {
    if (!currentGame || !user || user.uid !== currentGame.adminId) {
      throw new Error("Only the admin can update this setting");
    }
    const gameRef = doc(db, 'games', currentGame.id);
    await updateDoc(gameRef, { gameType: type });
  };

  const startPostGuessingPointPhase = async (): Promise<void> => {
    if (!currentGame || !user) throw new Error("No active game or user");
    if (user.uid !== currentGame.adminId)
      throw new Error("Only admin can start post-guessing point phase");

    try {
      setLoading(true);
      const gameRef = doc(db, "games", currentGame.id);

      await updateDoc(gameRef, {
        postGuessingPointPhase: true,
        playersWhoAwardedPostGuessPoints: [],
      });
    } catch (err) {
      console.error("Error starting post-guessing point phase:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const awardPointsToPlayers = async (
    awards: { recipientId: string; points: number }[],
  ): Promise<void> => {
    if (!currentGame || !user) throw new Error("No active game or user");
    if (!currentGame.postGuessingPointPhase)
      throw new Error("Post-guessing point phase is not active");

    const userId = user.uid;

    // Check if user has already awarded points in this phase
    if (currentGame.playersWhoAwardedPostGuessPoints?.includes(userId)) {
      throw new Error("You have already awarded points in this phase");
    }

    // Validate awards
    if (awards.length === 0) throw new Error("No awards specified");
    if (awards.some((a) => a.recipientId === userId)) {
      throw new Error("You cannot award points to yourself");
    }

    try {
      setLoading(true);
      const gameRef = doc(db, "games", currentGame.id);

      await runTransaction(db, async (transaction) => {
        const gameSnap = await transaction.get(gameRef);
        if (!gameSnap.exists()) throw new Error("Game not found");
        const gameData = gameSnap.data() as Game;

        // Calculate new scores
        const currentScores = gameData.scores || {};
        const newScores = { ...currentScores };

        awards.forEach((award) => {
          newScores[award.recipientId] =
            (newScores[award.recipientId] || 0) + award.points;
        });

        // This always runs while currentRound is null (post-guessing bonus
        // points are part of the guessing-phase screen, before finalize) —
        // look the round number up via guessingData instead.
        const singleTargetId = gameData.guessingData?.singleRoundTargetId;
        const activeRound = singleTargetId
          ? (gameData.rounds ?? []).find((r) => r.targetUserId === singleTargetId)
          : undefined;
        const roundNumber = activeRound?.roundNumber;

        // Store admin awards for history tracking
        const adminAwards = gameData.adminAwards || {};
        const currentAwards = adminAwards[userId] || [];
        const newAdminAwards = {
          ...adminAwards,
          [userId]: [
            ...currentAwards,
            ...awards.map((award) => ({
              ...award,
              awardedBy: userId,
              awardedAt: new Date(),
              roundNumber,
            })),
          ],
        };

        // Update game state
        transaction.update(gameRef, {
          scores: newScores,
          playersWhoAwardedPostGuessPoints: arrayUnion(userId),
          adminAwards: newAdminAwards,
        });
      });
    } catch (err) {
      console.error("Error awarding points to players:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const skipPostCommentPhase = async (): Promise<void> => {
    if (!currentGame || !user) throw new Error("No active game or user");
    if (!currentGame.currentRound?.pointsGiven)
      throw new Error("Target has not finished giving points yet");

    const userId = user.uid;

    // Check if user has already completed this phase
    if (currentGame.playersWhoCompletedPostCommentPhase?.includes(userId)) {
      throw new Error("You have already completed this phase");
    }

    // Exclude target from this phase
    if (userId === currentGame.currentRound.targetUserId) {
      throw new Error("Target cannot skip this phase");
    }

    try {
      setLoading(true);
      const gameRef = doc(db, "games", currentGame.id);

      await updateDoc(gameRef, {
        playersWhoCompletedPostCommentPhase: arrayUnion(userId),
      });
    } catch (err) {
      console.error("Error skipping post-comment phase:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const setNextRoundTarget = async (targetUserId: string) => {
    if (!currentGame || !user || user.uid !== currentGame.adminId) {
      throw new Error("Only admin can set next round target");
    }

    try {
      setLoading(true);
      const gameRef = doc(db, "games", currentGame.id);

      await runTransaction(db, async (transaction) => {
        const gameSnap = await transaction.get(gameRef);
        if (!gameSnap.exists()) throw new Error("Game not found");
        const gameData = gameSnap.data() as Game;

        // Check if user is a participant
        const participant = gameData.participants.find(
          (p) => p.userId === targetUserId,
        );
        if (!participant) throw new Error("User is not a participant");

        // Store admin target preference
        await updateDoc(gameRef, {
          adminNextTargetPreference: targetUserId,
        });
      });
    } catch (err) {
      console.error("Error setting next round target:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const skipNextRoundTarget = async (targetUserId: string) => {
    if (!currentGame || !user || user.uid !== currentGame.adminId) {
      throw new Error("Only admin can skip next round target");
    }

    try {
      setLoading(true);
      const gameRef = doc(db, "games", currentGame.id);

      await runTransaction(db, async (transaction) => {
        const gameSnap = await transaction.get(gameRef);
        if (!gameSnap.exists()) throw new Error("Game not found");
        const gameData = gameSnap.data() as Game;

        // Get current skipped targets or initialize empty array
        const skippedTargets = gameData.adminSkippedTargets || [];

        // Add to skipped targets if not already there
        if (!skippedTargets.includes(targetUserId)) {
          await updateDoc(gameRef, {
            adminSkippedTargets: [...skippedTargets, targetUserId],
          });
        }
      });
    } catch (err) {
      console.error("Error skipping next round target:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const resetTargetControls = async () => {
    if (!currentGame || !user || user.uid !== currentGame.adminId) {
      throw new Error("Only admin can reset target controls");
    }

    try {
      setLoading(true);
      const gameRef = doc(db, "games", currentGame.id);

      await updateDoc(gameRef, {
        adminNextTargetPreference: null,
        adminSkippedTargets: [],
        playersWhoCompletedPostCommentPhase: [],
      });
    } catch (err) {
      console.error("Error resetting target controls:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const saveClashGroups = async (groupA: ClashGroup, groupB: ClashGroup): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame || auth.currentUser.uid !== currentGame.adminId) throw new Error("Only the admin can set up groups");
    if (groupA.memberIds.length !== groupB.memberIds.length) throw new Error("Both groups must have the same number of players");
    if (groupA.memberIds.length === 0) throw new Error("Groups cannot be empty");
    if (!groupA.memberIds.includes(groupA.leaderId)) throw new Error("Group A leader must be a group member");
    if (!groupB.memberIds.includes(groupB.leaderId)) throw new Error("Group B leader must be a group member");
    const overlap = groupA.memberIds.filter(id => groupB.memberIds.includes(id));
    if (overlap.length > 0) throw new Error("Groups cannot share members");
    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      await updateDoc(gameRef, { 'clashData.groupA': groupA, 'clashData.groupB': groupB });
    } catch (err) {
      console.error('Error saving clash groups:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const startClashGame = async (): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame || auth.currentUser.uid !== currentGame.adminId) throw new Error("Only the admin can start the game");
    const cd = currentGame.clashData;
    if (!cd?.groupA || !cd?.groupB) throw new Error("Groups not set up");
    if (cd.groupA.memberIds.length !== cd.groupB.memberIds.length) throw new Error("Both groups must have the same number of players");
    if (cd.groupA.memberIds.length < 1) throw new Error("Each group must have at least 1 player");
    try {
      setLoading(true);
      const schedule = generateClashSchedule(cd.groupA.memberIds, cd.groupB.memberIds);
      const gameRef = doc(db, 'games', currentGame.id);
      await updateDoc(gameRef, {
        status: 'clash_writing',
        clashData: {
          ...cd,
          schedule,
          currentRoundIndex: 0,
          currentRoundCommentsA: [],
          currentRoundCommentsB: [],
          lastGroupToFinish: null,
          currentGuessingGroup: null,
          currentRoundGuessesA: [],
          currentRoundGuessesB: [],
          teamScores: { a: 0, b: 0 },
        },
      });
    } catch (err) {
      console.error('Error starting clash game:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const submitClashComment = async (text: string): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    const cd = currentGame?.clashData;
    if (!cd) throw new Error("No active clash game");
    if (!text.trim()) throw new Error("Comment cannot be empty");
    const uid = auth.currentUser.uid;
    const isGroupA = cd.groupA.memberIds.includes(uid);
    const isGroupB = cd.groupB.memberIds.includes(uid);
    if (!isGroupA && !isGroupB) throw new Error("Player not in any group");
    const assignments = isGroupA
      ? cd.schedule[cd.currentRoundIndex].assignmentsA
      : cd.schedule[cd.currentRoundIndex].assignmentsB;
    const assignment = assignments.find((a: ClashAssignment) => a.writerId === uid);
    if (!assignment) throw new Error("No assignment found for this player");
    const comment: ClashComment = { writerId: uid, subjectId: assignment.subjectId, text: text.trim(), submittedAt: Date.now() };
    const commentKey = isGroupA ? 'clashData.currentRoundCommentsA' : 'clashData.currentRoundCommentsB';
    const groupSize = cd.groupA.memberIds.length;
    const newCount = (isGroupA ? cd.currentRoundCommentsA.length : cd.currentRoundCommentsB.length) + 1;
    const updates: Record<string, unknown> = { [commentKey]: arrayUnion(comment) };
    if (newCount >= groupSize) {
      updates['clashData.lastGroupToFinish'] = isGroupA ? 'a' : 'b';
    }
    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame!.id);
      await updateDoc(gameRef, updates);
    } catch (err) {
      console.error('Error submitting clash comment:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const revealClashComments = async (): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame || auth.currentUser.uid !== currentGame.adminId) throw new Error("Only the admin can reveal comments");
    const cd = currentGame.clashData;
    if (!cd) throw new Error("No active clash game");
    const groupSize = cd.groupA.memberIds.length;
    if (cd.currentRoundCommentsA.length < groupSize) throw new Error(`Group A hasn't finished submitting (${cd.currentRoundCommentsA.length}/${groupSize})`);
    if (cd.currentRoundCommentsB.length < groupSize) throw new Error(`Group B hasn't finished submitting (${cd.currentRoundCommentsB.length}/${groupSize})`);
    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      await updateDoc(gameRef, {
        status: 'clash_guessing',
        'clashData.currentGuessingGroup': cd.lastGroupToFinish ?? 'a',
      });
    } catch (err) {
      console.error('Error revealing clash comments:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const submitClashGuess = async (commentWriterId: string, guessedSubjectId: string): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame?.clashData) throw new Error("No active clash game");
    const uid = auth.currentUser.uid;
    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      await runTransaction(db, async (transaction: Transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game not found");
        const gameData = gameDoc.data() as Game;
        const cd = gameData.clashData;
        if (!cd) throw new Error("No active clash game");
        const currentGroup = cd.currentGuessingGroup;
        if (!currentGroup) throw new Error("Not in guessing phase");
        const activeLeaderId = currentGroup === 'a' ? cd.groupA.leaderId : cd.groupB.leaderId;
        if (uid !== activeLeaderId) throw new Error("Only the active leader can submit guesses");
        const oppositeComments = currentGroup === 'a' ? cd.currentRoundCommentsB : cd.currentRoundCommentsA;
        const comment = oppositeComments.find((c: ClashComment) => c.writerId === commentWriterId);
        if (!comment) throw new Error("Comment not found");
        const guesses = currentGroup === 'a' ? cd.currentRoundGuessesA : cd.currentRoundGuessesB;
        if (guesses.some((g: ClashGuess) => g.commentWriterId === commentWriterId)) {
          throw new Error("Guess already submitted for this comment");
        }
        const subjectCorrect = comment.subjectId === guessedSubjectId;
        const guess: ClashGuess = { commentWriterId, guessedSubjectId, subjectCorrect, pointsAwarded: subjectCorrect ? 1 : 0 };
        const guessKey = currentGroup === 'a' ? 'clashData.currentRoundGuessesA' : 'clashData.currentRoundGuessesB';
        const updates: Record<string, unknown> = { [guessKey]: [...guesses, guess] };
        if (subjectCorrect) {
          updates[`clashData.teamScores.${currentGroup}`] = (cd.teamScores[currentGroup] ?? 0) + 1;
          updates[`scores.${uid}`] = (gameData.scores?.[uid] ?? 0) + 1;
        }
        transaction.update(gameRef, updates);
      });
    } catch (err) {
      console.error('Error submitting clash guess:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const submitClashAuthorGuess = async (commentWriterId: string, guessedAuthorId: string): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame?.clashData) throw new Error("No active clash game");
    const uid = auth.currentUser.uid;
    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      await runTransaction(db, async (transaction: Transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game not found");
        const gameData = gameDoc.data() as Game;
        const cd = gameData.clashData;
        if (!cd) throw new Error("No active clash game");
        const currentGroup = cd.currentGuessingGroup;
        if (!currentGroup) throw new Error("Not in guessing phase");
        const activeLeaderId = currentGroup === 'a' ? cd.groupA.leaderId : cd.groupB.leaderId;
        if (uid !== activeLeaderId) throw new Error("Only the active leader can submit guesses");
        const guesses = currentGroup === 'a' ? cd.currentRoundGuessesA : cd.currentRoundGuessesB;
        const existing = guesses.find((g: ClashGuess) => g.commentWriterId === commentWriterId);
        if (!existing?.subjectCorrect) throw new Error("Cannot guess author without a correct subject guess");
        if (existing.guessedAuthorId !== undefined) throw new Error("Author already guessed");
        const authorCorrect = guessedAuthorId === commentWriterId;
        const updatedGuesses = guesses.map((g: ClashGuess) =>
          g.commentWriterId === commentWriterId
            ? { ...g, guessedAuthorId, authorCorrect, pointsAwarded: g.pointsAwarded + (authorCorrect ? 1 : 0) }
            : g
        );
        const guessKey = currentGroup === 'a' ? 'clashData.currentRoundGuessesA' : 'clashData.currentRoundGuessesB';
        const updates: Record<string, unknown> = { [guessKey]: updatedGuesses };
        if (authorCorrect) {
          updates[`clashData.teamScores.${currentGroup}`] = (cd.teamScores[currentGroup] ?? 0) + 1;
          updates[`scores.${uid}`] = (gameData.scores?.[uid] ?? 0) + 1;
        }
        transaction.update(gameRef, updates);
      });
    } catch (err) {
      console.error('Error submitting clash author guess:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const advanceClashGuessing = async (force: boolean = false): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame || auth.currentUser.uid !== currentGame.adminId) throw new Error("Only the admin can advance guessing");
    const cd = currentGame.clashData;
    if (!cd || currentGame.status !== 'clash_guessing') throw new Error("Not in guessing phase");
    const currentGroup = cd.currentGuessingGroup!;
    const otherGroup: 'a' | 'b' = currentGroup === 'a' ? 'b' : 'a';
    const otherGuessCount = otherGroup === 'a' ? cd.currentRoundGuessesA.length : cd.currentRoundGuessesB.length;
    const otherCommentCount = otherGroup === 'a' ? cd.currentRoundCommentsB.length : cd.currentRoundCommentsA.length;
    const otherGroupDone = force || (otherCommentCount > 0 && otherGuessCount >= otherCommentCount);
    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      if (!otherGroupDone) {
        await updateDoc(gameRef, { 'clashData.currentGuessingGroup': otherGroup });
      } else if (cd.currentRoundIndex + 1 >= cd.schedule.length) {
        await updateDoc(gameRef, { status: 'finished' });
      } else {
        await updateDoc(gameRef, {
          status: 'clash_writing',
          'clashData.currentRoundIndex': cd.currentRoundIndex + 1,
          'clashData.currentRoundCommentsA': [],
          'clashData.currentRoundCommentsB': [],
          'clashData.currentRoundGuessesA': [],
          'clashData.currentRoundGuessesB': [],
          'clashData.lastGroupToFinish': null,
          'clashData.currentGuessingGroup': null,
        });
      }
    } catch (err) {
      console.error('Error advancing clash guessing:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const restartClashRound = async (): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame || auth.currentUser.uid !== currentGame.adminId) {
      throw new Error("Only the admin can restart the round");
    }
    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      await runTransaction(db, async (transaction: Transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game not found");
        const gameData = gameDoc.data() as Game;
        const cd = gameData.clashData;
        if (!cd) throw new Error("No active clash game");

        const pointsA = cd.currentRoundGuessesA.reduce((sum: number, g: ClashGuess) => sum + g.pointsAwarded, 0);
        const pointsB = cd.currentRoundGuessesB.reduce((sum: number, g: ClashGuess) => sum + g.pointsAwarded, 0);

        const updates: Record<string, unknown> = {
          status: 'clash_writing',
          'clashData.currentRoundCommentsA': [],
          'clashData.currentRoundCommentsB': [],
          'clashData.currentRoundGuessesA': [],
          'clashData.currentRoundGuessesB': [],
          'clashData.lastGroupToFinish': null,
          'clashData.currentGuessingGroup': null,
          'clashData.teamScores.a': (cd.teamScores.a ?? 0) - pointsA,
          'clashData.teamScores.b': (cd.teamScores.b ?? 0) - pointsB,
        };
        if (pointsA > 0) {
          updates[`scores.${cd.groupA.leaderId}`] = (gameData.scores?.[cd.groupA.leaderId] ?? 0) - pointsA;
        }
        if (pointsB > 0) {
          updates[`scores.${cd.groupB.leaderId}`] = (gameData.scores?.[cd.groupB.leaderId] ?? 0) - pointsB;
        }

        transaction.update(gameRef, updates);
      });
    } catch (err) {
      console.error('Error restarting clash round:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const skipClashRound = async (): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame || auth.currentUser.uid !== currentGame.adminId) {
      throw new Error("Only the admin can advance the round");
    }
    if (currentGame.status === 'clash_writing') {
      const cd = currentGame.clashData;
      if (!cd) throw new Error("No active clash game");
      const gameRef = doc(db, 'games', currentGame.id);
      if (cd.currentRoundIndex + 1 >= cd.schedule.length) {
        await updateDoc(gameRef, { status: 'finished' });
      } else {
        await updateDoc(gameRef, {
          status: 'clash_writing',
          'clashData.currentRoundIndex': cd.currentRoundIndex + 1,
          'clashData.currentRoundCommentsA': [],
          'clashData.currentRoundCommentsB': [],
          'clashData.currentRoundGuessesA': [],
          'clashData.currentRoundGuessesB': [],
          'clashData.lastGroupToFinish': null,
          'clashData.currentGuessingGroup': null,
        });
      }
      return;
    }
    await advanceClashGuessing(true);
  };

  const startIdeaGame = async (): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame || auth.currentUser.uid !== currentGame.adminId) {
      throw new Error("Only the admin can start the game");
    }
    const eligibleWriters = (currentGame.adminWritesComments ?? false)
      ? currentGame.participants.map((p: Participant) => p.userId)
      : currentGame.participants.filter((p: Participant) => p.userId !== currentGame.adminId).map((p: Participant) => p.userId);
    if (eligibleWriters.length < 2) {
      throw new Error("Need at least 2 players (excluding admin) to start Group Ideas. Enable 'Admin writes comments' or add more players.");
    }
    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      await updateDoc(gameRef, {
        status: 'idea_writing',
        ideaData: {
          incognitoMode: currentGame.ideaIncognitoMode ?? true,
          ideas: [],
          schedule: [],
          currentRoundIndex: 0,
          currentRoundRatings: [],
        },
      });
    } catch (err) {
      console.error('Error starting idea game:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const submitIdea = async (text: string): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame?.ideaData) throw new Error("No active Group Ideas game");
    if (!text.trim()) throw new Error("Idea cannot be empty");
    if (text.trim().length > 500) throw new Error("Idea must be 500 characters or fewer");
    const idea: Idea = {
      id: `${Date.now()}-${auth.currentUser.uid}-${currentGame.ideaData.ideas.length}`,
      authorId: auth.currentUser.uid,
      text: text.trim(),
      submittedAt: Date.now(),
      score: 0,
    };
    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      await updateDoc(gameRef, {
        'ideaData.ideas': arrayUnion(idea),
      });
    } catch (err) {
      console.error('Error submitting idea:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const startIdeaRatingRounds = async (): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame || auth.currentUser.uid !== currentGame.adminId) {
      throw new Error("Only the admin can start the rating rounds");
    }
    if (!currentGame.ideaData) throw new Error("No active Group Ideas game");
    const authorIdsWithIdeas = Array.from(new Set(currentGame.ideaData.ideas.map((i: Idea) => i.authorId)));
    const eligibleWriters = (currentGame.adminWritesComments ?? false)
      ? currentGame.participants.map((p: Participant) => p.userId)
      : currentGame.participants.filter((p: Participant) => p.userId !== currentGame.adminId).map((p: Participant) => p.userId);
    const missingWriters = eligibleWriters.filter(id => !authorIdsWithIdeas.includes(id));
    if (eligibleWriters.length < 2 || missingWriters.length > 0) {
      throw new Error("Every eligible participant must submit at least one idea before rating rounds can start");
    }
    try {
      setLoading(true);
      const schedule = generateIdeaSchedule(authorIdsWithIdeas);
      const gameRef = doc(db, 'games', currentGame.id);
      await updateDoc(gameRef, {
        status: 'idea_rating',
        'ideaData.schedule': schedule,
        'ideaData.currentRoundIndex': 0,
        'ideaData.currentRoundRatings': [],
      });
    } catch (err) {
      console.error('Error starting idea rating rounds:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const submitIdeaRating = async (ideaId: string, points: number, comment?: string): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame?.ideaData) throw new Error("No active Group Ideas game");
    if (points < 0 || points > 5) throw new Error("Points must be between 0 and 5");

    const raterId = auth.currentUser.uid;
    const gameRef = doc(db, 'games', currentGame.id);

    try {
      setLoading(true);
      await runTransaction(db, async (transaction: Transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game not found");
        const gameData = gameDoc.data() as Game;
        const ideaData = gameData.ideaData;
        if (!ideaData) throw new Error("No active Group Ideas game");

        const eligibleRaters = (gameData.adminWritesComments ?? false)
          ? gameData.participants.map((p: Participant) => p.userId)
          : gameData.participants.filter((p: Participant) => p.userId !== gameData.adminId).map((p: Participant) => p.userId);
        if (!eligibleRaters.includes(raterId)) {
          throw new Error("You are not eligible to rate ideas in this game");
        }

        const idea = ideaData.ideas.find((i: Idea) => i.id === ideaId);
        if (!idea) throw new Error("Idea not found");

        const alreadyRated = ideaData.currentRoundRatings.some(
          (r: IdeaRating) => r.raterId === raterId && r.ideaId === ideaId,
        );
        if (alreadyRated) throw new Error("You have already rated this idea");

        const rating: IdeaRating = {
          raterId, ideaId, points,
          ...(ideaData.incognitoMode && comment?.trim() ? { comment: comment.trim() } : {}),
        };

        const updatedIdeas = ideaData.ideas.map((i: Idea) =>
          i.id === ideaId ? { ...i, score: (i.score ?? 0) + points } : i,
        );

        transaction.update(gameRef, {
          'ideaData.currentRoundRatings': [...ideaData.currentRoundRatings, rating],
          'ideaData.ideas': updatedIdeas,
        });
      });
    } catch (err) {
      console.error('Error submitting idea rating:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const startNextIdeaRound = async (): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame || auth.currentUser.uid !== currentGame.adminId) {
      throw new Error("Only the admin can start the next round");
    }
    if (!currentGame.ideaData) throw new Error("No active Group Ideas game");
    const { schedule, currentRoundIndex } = currentGame.ideaData;
    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      if (currentRoundIndex + 1 >= schedule.length) {
        await updateDoc(gameRef, { status: 'finished' });
      } else {
        await updateDoc(gameRef, {
          'ideaData.currentRoundIndex': currentRoundIndex + 1,
          'ideaData.currentRoundRatings': [],
        });
      }
    } catch (err) {
      console.error('Error starting next idea round:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const restartIdeaRound = async (): Promise<void> => {
    if (!auth.currentUser) throw new Error("You must be signed in");
    if (!currentGame || auth.currentUser.uid !== currentGame.adminId) {
      throw new Error("Only the admin can restart the round");
    }
    try {
      setLoading(true);
      const gameRef = doc(db, 'games', currentGame.id);
      await runTransaction(db, async (transaction: Transaction) => {
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) throw new Error("Game not found");
        const gameData = gameDoc.data() as Game;
        const ideaData = gameData.ideaData;
        if (!ideaData) throw new Error("No active Group Ideas game");

        const scoreDeltas: Record<string, number> = {};
        ideaData.currentRoundRatings.forEach((r: IdeaRating) => {
          scoreDeltas[r.ideaId] = (scoreDeltas[r.ideaId] ?? 0) + r.points;
        });

        const updates: Record<string, unknown> = {
          'ideaData.currentRoundRatings': [],
        };
        if (Object.keys(scoreDeltas).length > 0) {
          updates['ideaData.ideas'] = ideaData.ideas.map((i: Idea) =>
            scoreDeltas[i.id] ? { ...i, score: (i.score ?? 0) - scoreDeltas[i.id] } : i,
          );
        }

        transaction.update(gameRef, updates);
      });
    } catch (err) {
      console.error('Error restarting idea round:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const skipIdeaRound = async (): Promise<void> => {
    await startNextIdeaRound();
  };

  const updateIdeaIncognitoMode = async (ideaIncognitoMode: boolean): Promise<void> => {
    if (!currentGame || !auth.currentUser || auth.currentUser.uid !== currentGame.adminId) {
      throw new Error("Only the admin can update this setting");
    }
    if (currentGame.status !== "waiting") {
      throw new Error("This setting can only be updated before the game starts");
    }
    try {
      setLoading(true);
      const gameRef = doc(db, "games", currentGame.id);
      await updateDoc(gameRef, { ideaIncognitoMode });
    } catch (err) {
      console.error("Error updating idea incognito mode setting:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const listAllGames = async (): Promise<Game[]> => {
    const snapshot = await getDocs(collection(db, "games"));
    return snapshot.docs.map((d) => ({ ...d.data(), id: d.id }) as Game);
  };

  const deleteGames = async (
    gameIds: string[],
  ): Promise<{ succeededIds: string[]; failedIds: string[] }> => {
    const results = await Promise.allSettled(
      gameIds.map((id) => deleteDoc(doc(db, "games", id))),
    );
    const succeededIds: string[] = [];
    const failedIds: string[] = [];
    results.forEach((result, i) => {
      if (result.status === "fulfilled") {
        succeededIds.push(gameIds[i]);
      } else {
        failedIds.push(gameIds[i]);
      }
    });
    return { succeededIds, failedIds };
  };

  const checkAdminPassword = async (input: string): Promise<boolean> => {
    const passwordRef = doc(db, "password", "YR20RZ67FKy88HQVF6yW");
    const pwDoc = await getDoc(passwordRef);
    const realPassword = pwDoc.exists()
      ? (pwDoc.data() as { password?: string }).password
      : null;
    return !!realPassword && input === realPassword;
  };

  const value: GameContextType = useMemo(
    () => ({
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
      awardCommentPoints,
      finishAwardingPoints,
      startNextRound,
      startGuessingPhase,
      finalizeGuessingPhase,
      restartMirrorRound,
      skipMirrorRound,
      givePointsToTarget,
      submitGuess,
      markPlayerGuessesSubmitted,
      updateAdminWritesComments,
      updateShowSurnames,
      updateTargetSelectionMode,
      updateShowGuessResults,
      setGameType,
      startBasketGame,
      submitBasketComment,
      revealBasketComments,
      submitBasketCommentGuess,
      submitBasketAuthorGuess,
      startNextBasketRound,
      restartBasketRound,
      skipBasketRound,
      saveClashGroups,
      startClashGame,
      submitClashComment,
      revealClashComments,
      submitClashGuess,
      submitClashAuthorGuess,
      advanceClashGuessing,
      restartClashRound,
      skipClashRound,
      startIdeaGame,
      submitIdea,
      startIdeaRatingRounds,
      submitIdeaRating,
      startNextIdeaRound,
      restartIdeaRound,
      skipIdeaRound,
      updateIdeaIncognitoMode,
      startPostGuessingPointPhase,
      awardPointsToPlayers,
      skipPostCommentPhase,
      setNextRoundTarget,
      skipNextRoundTarget,
      resetTargetControls,
      listAllGames,
      deleteGames,
      checkAdminPassword,
    }),
    [currentGame, loading, user],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
