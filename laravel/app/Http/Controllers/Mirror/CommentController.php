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

    public function awardPoints(Request $request, Game $game, \App\Models\Comment $comment): RedirectResponse
    {
        $this->authorize('view', $game);
        $validated = $request->validate(['points' => ['required', 'integer', 'min:0']]);

        try {
            $this->comments->awardCommentPoints($comment, $request->user(), $validated['points']);
        } catch (\RuntimeException $e) {
            abort(403, $e->getMessage());
        }

        broadcast(new \App\Events\GameUpdated($game->id));

        return redirect("/games/{$game->id}");
    }

    public function finishAwarding(Request $request, Game $game): RedirectResponse
    {
        $this->authorize('view', $game);
        $round = $game->rounds()->latest('round_number')->firstOrFail();

        try {
            $this->comments->finishAwardingPoints($round, $request->user());
        } catch (\RuntimeException $e) {
            abort(403, $e->getMessage());
        }

        broadcast(new \App\Events\GameUpdated($game->id));

        return redirect("/games/{$game->id}");
    }
}
