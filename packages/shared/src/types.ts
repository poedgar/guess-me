import { Timestamp } from 'firebase/firestore';
import { BasketAssignment, BasketRound } from './utils/basketSchedule';
import { ClashAssignment, ClashRound } from './utils/clashSchedule';

export interface Game {
  id: string;
  adminId: string;
  adminName: string;
  adminEmail: string;
  participants: Participant[];
  createdAt: Date | Timestamp;
  status: "waiting" | "active" | "guessing_phase" | "finished" | "basket_writing" | "basket_guessing" | "clash_writing" | "clash_guessing";
  postGuessingPointPhase?: boolean;
  playersWhoAwardedPostGuessPoints?: string[];
  adminAwards?: {
    [userId: string]: {
      recipientId: string;
      points: number;
      awardedBy: string;
      awardedAt: any;
    }[];
  };
  playersWhoCompletedPostCommentPhase?: string[];
  adminLeft?: boolean;
  currentRound?: Round | null;
  rounds?: Round[];
  scores?: { [userId: string]: number };
  guessingData?: GuessingData;
  guessResults?: { [userId: string]: { correctGuesses: number } };
  adminWritesComments?: boolean;
  showSurnames?: boolean;
  showGuessResults?: boolean;
  targetSelectionMode?: "random" | "chronological";
  gameType?: 'mirror' | 'basket' | 'clash';
  basketData?: BasketData;
  clashData?: ClashData;
  adminNextTargetPreference?: string;
  adminSkippedTargets?: string[];
  // Stable per-participant display numbers, assigned once when the game starts.
  // Frozen for the lifetime of the game — does not shift if participants later leave.
  playerNumbers?: { [userId: string]: number };
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
  guesses?: Guess[];
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
  commentsByTarget: { [userId: string]: Comment[] };
  possibleAuthors: { userId: string; userName: string }[];
  playersWhoSubmittedGuesses?: string[];
  allPlayersSubmitted?: boolean;
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
  memberIds: string[];
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

export interface GameContextType {
  currentGame: Game | null;
  loading: boolean;
  createGame: (adminWritesComments?: boolean) => Promise<string>;
  joinGame: (gameId: string) => Promise<void>;
  enterGame: (input: string, adminWritesComments?: boolean) => Promise<string | void>;
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
  submitGuess: (roundNumber: number, commentId: string, guessedAuthorId: string) => Promise<void>;
  markPlayerGuessesSubmitted: (userId?: string, correctGuesses?: number) => Promise<void>;
  updateAdminWritesComments: (adminWritesComments: boolean) => Promise<void>;
  updateShowSurnames: (showSurnames: boolean) => Promise<void>;
  updateTargetSelectionMode: (targetSelectionMode: "random" | "chronological") => Promise<void>;
  updateShowGuessResults: (showGuessResults: boolean) => Promise<void>;
  setGameType: (type: 'mirror' | 'basket' | 'clash') => Promise<void>;
  startBasketGame: () => Promise<void>;
  submitBasketComment: (text: string) => Promise<void>;
  revealBasketComments: () => Promise<void>;
  submitBasketCommentGuess: (commentWriterId: string) => Promise<void>;
  submitBasketAuthorGuess: (authorGuessId: string) => Promise<void>;
  startNextBasketRound: () => Promise<void>;
  saveClashGroups: (groupA: ClashGroup, groupB: ClashGroup) => Promise<void>;
  startClashGame: () => Promise<void>;
  submitClashComment: (text: string) => Promise<void>;
  revealClashComments: () => Promise<void>;
  submitClashGuess: (commentWriterId: string, guessedSubjectId: string) => Promise<void>;
  submitClashAuthorGuess: (commentWriterId: string, guessedAuthorId: string) => Promise<void>;
  advanceClashGuessing: () => Promise<void>;
  setNextRoundTarget: (targetUserId: string) => Promise<void>;
  skipNextRoundTarget: (targetUserId: string) => Promise<void>;
  resetTargetControls: () => Promise<void>;
  startPostGuessingPointPhase: () => Promise<void>;
  awardPointsToPlayers: (awards: { recipientId: string; points: number }[]) => Promise<void>;
  skipPostCommentPhase: () => Promise<void>;
}

export interface GameProviderProps {
  children: React.ReactNode;
}
