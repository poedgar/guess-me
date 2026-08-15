<?php

namespace App\Http\Controllers;

use App\Services\GameLifecycleService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class GameController extends Controller
{
    public function __construct(private GameLifecycleService $lifecycle)
    {
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
}
