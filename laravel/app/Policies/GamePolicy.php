<?php

namespace App\Policies;

use App\Models\Game;
use App\Models\User;

class GamePolicy
{
    public function view(User $user, Game $game): bool
    {
        return $game->admin_id === $user->id || $game->participants()->where('user_id', $user->id)->exists();
    }
}
