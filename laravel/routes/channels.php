<?php

use App\Models\Game;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

Broadcast::channel('game.{gameId}', function ($user, $gameId) {
    $game = Game::find($gameId);
    if (! $game) {
        return false;
    }

    return $game->admin_id === $user->id || $game->participants()->where('user_id', $user->id)->exists();
});
