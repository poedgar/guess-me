<?php

namespace App\Http\Controllers\Mirror;

use App\Http\Controllers\Controller;
use App\Models\Game;
use App\Services\GuessingPhaseService;
use Illuminate\Http\RedirectResponse;

class GuessingController extends Controller
{
    public function __construct(private GuessingPhaseService $guessing)
    {
    }

    public function start(Game $game): RedirectResponse
    {
        $this->authorize('manage', $game);

        $this->guessing->startGuessingPhase($game);
        broadcast(new \App\Events\GameUpdated($game->id));

        return redirect("/games/{$game->id}");
    }
}
