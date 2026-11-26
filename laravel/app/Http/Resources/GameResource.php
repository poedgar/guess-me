<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class GameResource extends JsonResource
{
    public static $wrap = null;

    public function toArray(Request $request): array
    {
        $userId = $request->user()->id;
        $currentRound = $this->rounds->sortByDesc('round_number')->first();

        $requiredRaterIds = $currentRound ? $this->participants()
            ->where('user_id', '!=', $currentRound->target_user_id)
            ->when(! $this->admin_writes_comments, fn ($q) => $q->where('user_id', '!=', $this->admin_id))
            ->pluck('user_id') : collect();

        $roundComments = $currentRound
            ? $currentRound->comments()->with(['author', 'reactionRatings'])->orderBy('display_order')->orderBy('id')->get()
            : collect();

        return [
            'id' => $this->id,
            'code' => $this->code,
            'status' => $this->status,
            'isAdmin' => $this->admin_id === $userId,
            'adminLeft' => $this->admin_left,
            'settings' => [
                'adminWritesComments' => $this->admin_writes_comments,
                'showSurnames' => $this->show_surnames,
                'showGuessResults' => $this->show_guess_results,
                'targetSelectionMode' => $this->target_selection_mode,
            ],
            'postGuessingPointPhase' => $this->post_guessing_point_phase,
            'playersWhoCompletedPostCommentPhase' => $this->players_who_completed_post_comment_phase ?? [],
            'playersWhoAwardedPostGuessPoints' => $this->players_who_awarded_post_guess_points ?? [],
            'participants' => $this->participants->map(fn ($p) => [
                'userId' => $p->user_id,
                'name' => $p->user->name,
                'photoUrl' => $p->user->photo_url,
                'playerNumber' => $p->player_number,
                'joinedAt' => $p->joined_at,
            ])->values(),
            'currentRound' => $currentRound ? [
                'roundNumber' => $currentRound->round_number,
                'targetUserId' => $currentRound->target_user_id,
                'targetUserName' => $currentRound->target->name,
                'commentsVisible' => $currentRound->comments_visible,
                'pointsGiven' => $currentRound->points_given,
                'activeCommentId' => $currentRound->active_comment_id,
                'guessesFinalized' => $currentRound->guesses_finalized,
                'targetCorrectGuesses' => $currentRound->target_correct_guesses,
                // Live count of reaction points the target has received so far this
                // round — computed from the reaction ratings already loaded below,
                // not the stale `target_points` column (never written by
                // rateTargetReaction; GameScore::incrementFor is the source of truth
                // for the cumulative game score instead).
                'targetPoints' => $roundComments->sum(fn ($c) => $c->reactionRatings->where('rating', true)->count()),
                'comments' => $roundComments
                    ->map(function ($c) use ($currentRound, $userId, $requiredRaterIds) {
                        $myRating = $c->reactionRatings->firstWhere('rater_id', $userId);

                        return [
                            'id' => $c->id,
                            // Gated on guesses_finalized, not comments_visible: comments_visible flips
                            // true as soon as the admin reveals comments (still in the comment-writing
                            // phase) and stays true throughout guessing_phase. Using it here would hand
                            // the target the answer key while they're actively guessing authorship.
                            'authorId' => ($currentRound->guesses_finalized || $c->author_id === $userId || $this->admin_id === $userId) ? $c->author_id : null,
                            'text' => ($currentRound->comments_visible || $c->author_id === $userId || $this->admin_id === $userId) ? $c->text : null,
                            'points' => $c->points,
                            // Viewer-scoped only — nobody else's individual reaction votes are
                            // exposed, same privacy posture as guessedAuthorId/correct below.
                            'myReactionRating' => $myRating ? (int) $myRating->rating : null,
                            'reactionsComplete' => $requiredRaterIds->diff($c->reactionRatings->pluck('rater_id'))->isEmpty(),
                            'needsRevision' => $c->needs_revision,
                        ];
                    }),
                'guessingPossibleAuthors' => $currentRound->guessing_possible_authors ?? [],
                'guesses' => $currentRound->guesses->map(fn ($g) => [
                    'commentId' => $g->comment_id,
                    'guesserId' => $g->guesser_id,
                    // The guesser sees their own submitted guesses (Guessing.vue's "already
                    // guessed this comment" check needs it); the admin sees everything. Nobody
                    // else sees anyone's guessedAuthorId before finalization, since only the
                    // target guesses in this mode and other participants have no legitimate
                    // reason to see the target's in-progress guesses.
                    'guessedAuthorId' => ($currentRound->guesses_finalized || $g->guesser_id === $userId || $this->admin_id === $userId) ? $g->guessed_author_id : null,
                    // `correct` is withheld from the guesser too (not just other participants)
                    // until finalization: telling the target whether an early guess was right
                    // is itself a spoiler for their remaining guesses via elimination. The admin
                    // is exempt, consistent with the admin exception on `text` above.
                    'correct' => ($currentRound->guesses_finalized || $this->admin_id === $userId) ? $g->correct : null,
                ]),
                'targetPointsGivenBy' => $currentRound->target_points_given_by ?? [],
                'guessingAllSubmitted' => $currentRound->guessing_all_submitted,
            ] : null,
            'scores' => $this->scores->mapWithKeys(fn ($s) => [$s->user_id => $s->points]),
            'guessResults' => $this->guessResults->mapWithKeys(fn ($r) => [$r->user_id => $r->correct_guesses]),
            'leaderboard' => $this->buildLeaderboard($currentRound),
        ];
    }

    private function buildLeaderboard($currentRound)
    {
        $liveScores = $this->scores->mapWithKeys(fn ($s) => [(string) $s->user_id => $s->points]);
        $liveGuessResults = $this->guessResults->mapWithKeys(fn ($r) => [(string) $r->user_id => $r->correct_guesses]);

        // Only a round that's still genuinely in progress should show the frozen start-of-round
        // snapshot. Once the game is finished, or the current round's guesses are finalized (the
        // "between rounds" state — see Show.vue's phaseComponent), the round it was captured for
        // has already fully played out, so live scores are shown instead.
        $roundIsOver = $this->status === 'finished' || ($currentRound?->guesses_finalized ?? false);

        $displayedScores = $roundIsOver
            ? $liveScores
            : collect($currentRound?->start_scores_snapshot ?? $liveScores->all());
        $displayedGuessResults = $roundIsOver
            ? $liveGuessResults
            : collect($currentRound?->start_guess_results_snapshot ?? $liveGuessResults->all());

        return $this->participants
            ->filter(fn ($p) => $this->admin_writes_comments || $p->user_id !== $this->admin_id)
            ->map(function ($p) use ($displayedScores, $displayedGuessResults) {
                $gamePoints = (int) ($displayedScores[(string) $p->user_id] ?? 0);
                $guessPoints = (int) ($displayedGuessResults[(string) $p->user_id] ?? 0);

                return [
                    'userId' => $p->user_id,
                    'name' => $p->user->name,
                    'gamePoints' => $gamePoints,
                    'guessPoints' => $guessPoints,
                    'totalPoints' => $gamePoints + $guessPoints,
                ];
            })
            ->sortByDesc('totalPoints')
            ->values();
    }
}
