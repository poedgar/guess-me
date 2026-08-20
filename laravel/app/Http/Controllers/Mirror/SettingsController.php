<?php

namespace App\Http\Controllers\Mirror;

use App\Http\Controllers\Controller;
use App\Models\Game;
use App\Services\GameSettingsService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function __construct(private GameSettingsService $settings)
    {
    }

    public function adminWritesComments(Request $request, Game $game): RedirectResponse
    {
        return $this->apply($request, $game, 'value', fn ($v) => $this->settings->updateAdminWritesComments($game, $request->user(), (bool) $v));
    }

    public function showSurnames(Request $request, Game $game): RedirectResponse
    {
        return $this->apply($request, $game, 'value', fn ($v) => $this->settings->updateShowSurnames($game, $request->user(), (bool) $v));
    }

    public function targetSelectionMode(Request $request, Game $game): RedirectResponse
    {
        $validated = $request->validate(['value' => ['required', \Illuminate\Validation\Rule::in(['random', 'chronological'])]]);

        try {
            $this->settings->updateTargetSelectionMode($game, $request->user(), $validated['value']);
        } catch (\RuntimeException $e) {
            throw \Illuminate\Validation\ValidationException::withMessages(['value' => $e->getMessage()]);
        }

        broadcast(new \App\Events\GameUpdated($game->id));

        return redirect("/games/{$game->id}");
    }

    public function showGuessResults(Request $request, Game $game): RedirectResponse
    {
        return $this->apply($request, $game, 'value', fn ($v) => $this->settings->updateShowGuessResults($game, $request->user(), (bool) $v));
    }

    private function apply(Request $request, Game $game, string $field, callable $fn): RedirectResponse
    {
        $validated = $request->validate([$field => ['required']]);

        try {
            $fn($validated[$field]);
        } catch (\RuntimeException $e) {
            throw \Illuminate\Validation\ValidationException::withMessages([$field => $e->getMessage()]);
        }

        broadcast(new \App\Events\GameUpdated($game->id));

        return redirect("/games/{$game->id}");
    }
}
