<?php

namespace App\Http\Controllers\Mirror;

use App\Http\Controllers\Controller;
use App\Models\Game;
use App\Services\CommentPhaseService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class CommentController extends Controller
{
    public function __construct(private CommentPhaseService $comments)
    {
    }

    public function store(Request $request, Game $game): RedirectResponse
    {
        $this->authorize('view', $game);
        $validated = $request->validate(['text' => ['required', 'string']]);

        $round = $game->rounds()->latest('round_number')->firstOrFail();

        try {
            $this->comments->submitComment($round, $request->user(), $validated['text']);
        } catch (\RuntimeException $e) {
            throw ValidationException::withMessages(['text' => $e->getMessage()]);
        }

        broadcast(new \App\Events\GameUpdated($game->id));

        return redirect("/games/{$game->id}");
    }
}
