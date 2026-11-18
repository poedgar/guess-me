/**
 * Maps the English error messages thrown by GameContext to `errors.*`
 * translation keys, so alerts can show them in the current language.
 * When GameContext gains a new error, add it here and add `errors.<key>` to
 * both locales (apps/web/src/utils/translations.test.ts fails until you do).
 */

export const ERROR_MESSAGE_KEYS: Readonly<Record<string, string>> = {
  "Author already guessed": "errors.authorAlreadyGuessed",
  "Author guess already submitted for this round": "errors.authorGuessAlreadySubmitted",
  "Both groups must have the same number of players": "errors.groupsSameSize",
  "Cannot guess author without a correct comment guess": "errors.needCorrectCommentGuess",
  "Cannot guess author without a correct subject guess": "errors.needCorrectSubjectGuess",
  "Comment cannot be empty": "errors.commentEmpty",
  "Comment guess already submitted for this round": "errors.commentGuessAlreadySubmitted",
  "Comment must be 500 characters or fewer": "errors.commentTooLong",
  "Comment not found": "errors.commentNotFound",
  "Comments are not visible": "errors.commentsNotVisible",
  "Current round not found on server": "errors.roundNotFoundOnServer",
  "Each group must have at least 1 player": "errors.groupMinOnePlayer",
  "Every eligible participant must submit at least one idea before rating rounds can start": "errors.everyoneMustSubmitIdea",
  "Game not found": "errors.gameNotFound",
  "Groups cannot be empty": "errors.groupsEmpty",
  "Groups cannot share members": "errors.groupsShareMembers",
  "Groups not set up": "errors.groupsNotSetUp",
  "Guess already submitted for this comment": "errors.guessAlreadySubmittedForComment",
  "Idea cannot be empty": "errors.ideaEmpty",
  "Idea must be 500 characters or fewer": "errors.ideaTooLong",
  "Idea not found": "errors.ideaNotFound",
  "Need at least 2 participants to start the game": "errors.needTwoParticipants",
  "Need at least 2 players (excluding admin) to start Basket game. Enable 'Admin writes comments' or add more players.": "errors.needTwoPlayersBasket",
  "Need at least 2 players (excluding admin) to start Group Ideas. Enable 'Admin writes comments' or add more players.": "errors.needTwoPlayersIdeas",
  "No active Group Ideas game": "errors.noActiveIdeasGame",
  "No active basket game": "errors.noActiveBasketGame",
  "No active clash game": "errors.noActiveClashGame",
  "No active game or user": "errors.noActiveGameOrUser",
  "No active round on server": "errors.noActiveRoundOnServer",
  "No active round to restart": "errors.noActiveRoundToRestart",
  "No active round": "errors.noActiveRound",
  "No active comment": "errors.noActiveComment",
  "No assignment found for this player": "errors.noAssignment",
  "No awards specified": "errors.noAwards",
  "No comment found for this player": "errors.noCommentForPlayer",
  "No completed rounds to start guessing": "errors.noCompletedRounds",
  "No valid participants to select": "errors.noValidParticipants",
  "Not in guessing phase": "errors.notGuessingPhase",
  "Only admin can reset target controls": "errors.adminOnlyResetTarget",
  "Only admin can set next round target": "errors.adminOnlySetTarget",
  "Only admin can skip next round target": "errors.adminOnlySkipTarget",
  "Only admin can start post-guessing point phase": "errors.adminOnlyStartPointPhase",
  "Only the active leader can submit guesses": "errors.leaderOnlyGuess",
  "Only the admin can activate the next comment": "errors.adminOnlyActivateNextComment",
  "Only the admin can advance guessing": "errors.adminOnlyAdvanceGuessing",
  "Only the admin can advance the round": "errors.adminOnlyAdvanceRound",
  "Only the admin can finalize the guessing phase": "errors.adminOnlyFinalize",
  "Only the admin can mark another player as submitted": "errors.adminOnlyMarkSubmitted",
  "Only the admin can restart the round": "errors.adminOnlyRestartRound",
  "Only the admin can reveal comments": "errors.adminOnlyRevealComments",
  "Only the admin can set up groups": "errors.adminOnlySetUpGroups",
  "Only the admin can show comments": "errors.adminOnlyShowComments",
  "Only the admin can start the game": "errors.adminOnlyStartGame",
  "Only the admin can start the guessing phase": "errors.adminOnlyStartGuessing",
  "Only the admin can start the next round": "errors.adminOnlyStartNextRound",
  "Only the admin can start the rating rounds": "errors.adminOnlyStartRating",
  "Only the admin can update this setting": "errors.adminOnlyUpdateSetting",
  "Only the target can make guesses": "errors.targetOnlyGuess",
  "Only the target person can give points": "errors.targetOnlyGivePoints",
  "Player not in any group": "errors.playerNotInGroup",
  "Points must be between 0 and 5": "errors.pointsRange",
  "Post-guessing point phase is not active": "errors.pointPhaseNotActive",
  "Review has not started": "errors.reviewNotStarted",
  "Round not found": "errors.roundNotFound",
  "Target has not decided on this comment yet": "errors.targetNotDecidedYet",
  "The target cannot rate their own reaction": "errors.targetCannotRateOwnReaction",
  "This comment is no longer active": "errors.commentNoLongerActive",
  "This round's guessing has already been finalized": "errors.guessingAlreadyFinalized",
  "This round's review is already finished": "errors.reviewAlreadyFinished",
  "This setting can only be updated before the game starts": "errors.settingOnlyBeforeStart",
  "User is not a participant": "errors.notParticipant",
  "You already decided on this comment": "errors.alreadyDecidedComment",
  "You already guessed for this comment": "errors.alreadyGuessedComment",
  "You already rated this comment": "errors.alreadyRatedComment",
  "You are not eligible to rate ideas in this game": "errors.notEligibleToRate",
  "You can only decide on the currently active comment": "errors.onlyActiveCommentDecide",
  "You can only rate the currently active comment": "errors.onlyActiveCommentRate",
  "You cannot award points to yourself": "errors.cannotAwardSelf",
  "You cannot comment about yourself": "errors.cannotCommentSelf",
  "Admin is not participating this game": "errors.adminNotParticipatingGame",
  "You have already awarded points in this phase": "errors.alreadyAwardedInPhase",
  "You have already completed this phase": "errors.alreadyCompletedPhase",
  "You have already rated this idea": "errors.alreadyRatedIdea",
  "You have already submitted a comment for this round": "errors.alreadySubmittedComment",
  "You must be signed in to create a game": "errors.signInToCreate",
  "You must be signed in to enter a game": "errors.signInToEnter",
  "You must be signed in to join a game": "errors.signInToJoin",
  "You must be signed in to leave a game": "errors.signInToLeave",
  "Must be signed in to rate": "errors.signInToRate",
  "You must be signed in": "errors.signInRequired",
  "game_not_found": "errors.gameNotFoundCode",
};

const ERROR_PATTERNS: ReadonlyArray<{ re: RegExp; key: string; params: string[] }> = [
  { re: /^Not all players have submitted \((\d+)\/(\d+)\)$/, key: "errors.notAllSubmitted", params: ["submitted", "total"] },
  { re: /^Group A hasn't finished submitting \((\d+)\/(\d+)\)$/, key: "errors.groupANotFinished", params: ["done", "total"] },
  { re: /^Group B hasn't finished submitting \((\d+)\/(\d+)\)$/, key: "errors.groupBNotFinished", params: ["done", "total"] },
];

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * Translate a known error message; unknown messages are returned unchanged.
 */
export function localizeErrorMessage(message: string, translate: Translate): string {
  const key = ERROR_MESSAGE_KEYS[message];
  if (key) return translate(key);
  for (const { re, key: patternKey, params } of ERROR_PATTERNS) {
    const m = re.exec(message);
    if (m) {
      const values: Record<string, string> = {};
      params.forEach((name, i) => { values[name] = m[i + 1]; });
      return translate(patternKey, values);
    }
  }
  return message;
}
