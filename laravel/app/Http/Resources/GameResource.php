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
                'guessesFinalized' => $currentRound->guesses_finalized,
                'targetPoints' => $currentRound->target_points,
                'targetCorrectGuesses' => $currentRound->target_correct_guesses,
                'comments' => $currentRound->comments()->with('author')->get()->map(fn ($c) => [
                    'id' => $c->id,
                    'authorId' => $currentRound->comments_visible ? $c->author_id : null,
                    'text' => $c->text,
                    'points' => $c->points,
                ]),
            ] : null,
            'scores' => $this->scores->mapWithKeys(fn ($s) => [$s->user_id => $s->points]),
            'guessResults' => $this->guessResults->mapWithKeys(fn ($r) => [$r->user_id => $r->correct_guesses]),
        ];
    }
}
