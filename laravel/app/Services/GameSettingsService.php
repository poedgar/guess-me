<?php

namespace App\Services;

use App\Models\Game;
use App\Models\User;
use RuntimeException;

class GameSettingsService
{
    public function updateAdminWritesComments(Game $game, User $caller, bool $value): void
    {
        $this->update($game, $caller, ['admin_writes_comments' => $value]);
    }

    public function updateShowSurnames(Game $game, User $caller, bool $value): void
    {
        $this->update($game, $caller, ['show_surnames' => $value]);
    }

    public function updateTargetSelectionMode(Game $game, User $caller, string $value): void
    {
        $this->update($game, $caller, ['target_selection_mode' => $value]);
    }

    public function updateShowGuessResults(Game $game, User $caller, bool $value): void
    {
        $this->update($game, $caller, ['show_guess_results' => $value]);
    }

    private function update(Game $game, User $caller, array $attributes): void
    {
        if ($caller->id !== $game->admin_id) {
            throw new RuntimeException(__('Only the admin can update this setting'));
        }

        if ($game->status !== 'waiting') {
            throw new RuntimeException(__('This setting can only be updated before the game starts'));
        }

        $game->update($attributes);
    }
}
