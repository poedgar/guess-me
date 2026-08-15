<?php

namespace App\Services;

use App\Models\Game;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class GuessingPhaseService
{
    public function startGuessingPhase(Game $game): void
    {
        $round = $game->rounds()->latest('round_number')->firstOrFail();

        $nonTargetParticipants = $game->participants()
            ->where('user_id', '!=', $round->target_user_id)
            ->when(! $game->admin_writes_comments, fn ($q) => $q->where('user_id', '!=', $game->admin_id))
            ->get();

        $completed = $game->players_who_completed_post_comment_phase ?? [];
        $incomplete = $nonTargetParticipants->reject(fn ($p) => in_array((string) $p->user_id, $completed, true));

        if ($incomplete->isNotEmpty()) {
            throw new RuntimeException(
                "Cannot start guessing phase. Waiting for {$incomplete->count()} player(s) to complete the post-comment phase."
            );
        }

        DB::transaction(function () use ($game, $round) {
            $possibleAuthors = $game->participants()->with('user')->get()->map(fn ($p) => [
                'userId' => (string) $p->user_id,
                'userName' => $p->user->name,
            ])->values()->all();

            $round->update([
                'single_round_guessing_active' => true,
                'guessing_possible_authors' => $possibleAuthors,
                'guessing_players_submitted' => [],
                'guessing_all_submitted' => false,
            ]);

            $game->update(['status' => 'guessing_phase']);
        });
    }
}
