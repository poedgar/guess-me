<?php

namespace App\Http\Controllers;

use App\Http\Resources\GameResource;
use App\Models\Game;
use App\Services\GameLifecycleService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Response;

class GameController extends Controller
{
    public function __construct(private GameLifecycleService $lifecycle)
    {
    }

    public function show(Game $game): Response
    {
        $this->authorize('view', $game);

        $game->load(['participants.user', 'scores', 'guessResults']);

        return inertia('Game/Show', [
            'game' => new GameResource($game),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'password' => ['required', 'string'],
            'admin_writes_comments' => ['sometimes', 'boolean'],
        ]);

        if ($validated['password'] !== config('game.admin_password')) {
            throw ValidationException::withMessages(['password' => 'Incorrect admin password.']);
        }

        $game = $this->lifecycle->createGame($request->user(), $validated['admin_writes_comments'] ?? false);

        return redirect("/games/{$game->id}");
    }

    public function join(Request $request): RedirectResponse
    {
        $validated = $request->validate(['code' => ['required', 'string']]);

        try {
            $game = $this->lifecycle->joinGame($request->user(), $validated['code']);
        } catch (\App\Exceptions\GameNotFoundException) {
            throw ValidationException::withMessages(['code' => 'No game found with that code.']);
        }

        return redirect("/games/{$game->id}");
    }
}
