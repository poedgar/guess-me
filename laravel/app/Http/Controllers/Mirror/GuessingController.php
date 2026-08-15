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

    public function submitGuess(\Illuminate\Http\Request $request, Game $game): RedirectResponse
    {
        $this->authorize('view', $game);
        $validated = $request->validate([
            'comment_id' => ['required', 'integer'],
            'guessed_author_id' => ['required', 'integer'],
        ]);

        $round = $game->rounds()->latest('round_number')->firstOrFail();
        $comment = \App\Models\Comment::where('round_id', $round->id)->findOrFail($validated['comment_id']);
        $guessedAuthor = \App\Models\User::findOrFail($validated['guessed_author_id']);

        try {
            $this->guessing->submitGuess($round, $request->user(), $comment, $guessedAuthor);
        } catch (\RuntimeException $e) {
            throw \Illuminate\Validation\ValidationException::withMessages(['guess' => $e->getMessage()]);
        }

        broadcast(new \App\Events\GameUpdated($game->id));

        return redirect("/games/{$game->id}");
    }

    public function markSubmitted(\Illuminate\Http\Request $request, Game $game): RedirectResponse
    {
        $this->authorize('view', $game);
        $validated = $request->validate(['player_id' => ['sometimes', 'integer']]);

        $round = $game->rounds()->latest('round_number')->firstOrFail();
        $player = isset($validated['player_id']) ? \App\Models\User::findOrFail($validated['player_id']) : null;

        try {
            $this->guessing->markPlayerGuessesSubmitted($game, $round, $request->user(), $player);
        } catch (\RuntimeException $e) {
            abort(403, $e->getMessage());
        }

        broadcast(new \App\Events\GameUpdated($game->id));

        return redirect("/games/{$game->id}");
    }

    public function awardPoints(\Illuminate\Http\Request $request, Game $game): RedirectResponse
    {
        $this->authorize('view', $game);
        $validated = $request->validate([
            'awards' => ['required', 'array', 'min:1'],
            'awards.*.recipientId' => ['required', 'integer'],
            'awards.*.points' => ['required', 'integer', 'min:0'],
        ]);

        $round = $game->rounds()->latest('round_number')->firstOrFail();

        try {
            $this->guessing->awardPointsToPlayers($game, $round, $request->user(), $validated['awards']);
        } catch (\RuntimeException $e) {
            throw \Illuminate\Validation\ValidationException::withMessages(['awards' => $e->getMessage()]);
        }

        broadcast(new \App\Events\GameUpdated($game->id));

        return redirect("/games/{$game->id}");
    }

    public function finalize(Game $game): RedirectResponse
    {
        $this->authorize('manage', $game);

        $round = $game->rounds()->latest('round_number')->firstOrFail();
        $this->guessing->finalizeGuessingPhase($game, $round);
        broadcast(new \App\Events\GameUpdated($game->id));

        return redirect("/games/{$game->id}");
    }
}
