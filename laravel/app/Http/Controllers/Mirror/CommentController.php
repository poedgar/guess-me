<?php

namespace App\Http\Controllers\Mirror;

use App\Http\Controllers\Controller;
use App\Models\Comment;
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

    public function awardPoints(Request $request, Game $game, Comment $comment): RedirectResponse
    {
        $this->authorize('view', $game);

        if ($comment->round->game_id !== $game->id) {
            abort(404);
        }

        $validated = $request->validate(['points' => ['required', 'integer', 'in:0,1']]);

        try {
            $this->comments->awardCommentPoints($comment, $request->user(), $validated['points']);
        } catch (\RuntimeException $e) {
            throw ValidationException::withMessages(['points' => $e->getMessage()]);
        }

        broadcast(new \App\Events\GameUpdated($game->id));

        return redirect("/games/{$game->id}");
    }

    public function rateTargetReaction(Request $request, Game $game, Comment $comment): RedirectResponse
    {
        $this->authorize('view', $game);

        if ($comment->round->game_id !== $game->id) {
            abort(404);
        }

        $validated = $request->validate(['rating' => ['required', 'integer', 'in:0,1']]);

        try {
            $this->comments->rateTargetReaction($comment, $request->user(), $validated['rating']);
        } catch (\RuntimeException $e) {
            throw ValidationException::withMessages(['rating' => $e->getMessage()]);
        }

        broadcast(new \App\Events\GameUpdated($game->id));

        return redirect("/games/{$game->id}");
    }
}
