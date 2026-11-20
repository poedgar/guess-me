<?php

namespace App\Http\Controllers\Mirror;

use App\Http\Controllers\Controller;
use App\Models\Game;
use App\Services\CommentPhaseService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Validation\ValidationException;

class RoundController extends Controller
{
    public function __construct(private CommentPhaseService $comments)
    {
    }

    public function showComments(Game $game): RedirectResponse
    {
        $this->authorize('manage', $game);

        $round = $game->rounds()->latest('round_number')->firstOrFail();

        try {
            $this->comments->showComments($round);
        } catch (\RuntimeException $e) {
            throw ValidationException::withMessages(['game' => $e->getMessage()]);
        }

        broadcast(new \App\Events\GameUpdated($game->id));

        return redirect("/games/{$game->id}");
    }

    public function next(Game $game): RedirectResponse
    {
        $this->authorize('manage', $game);

        app(\App\Services\GameLifecycleService::class)->startNextRound($game);
        broadcast(new \App\Events\GameUpdated($game->id));

        return redirect("/games/{$game->id}");
    }
}
