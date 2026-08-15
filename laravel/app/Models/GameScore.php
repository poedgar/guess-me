<?php

namespace App\Models;

use App\Models\Game;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GameScore extends Model
{
    protected $fillable = ['game_id', 'user_id', 'points'];

    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function incrementFor(Game $game, User $user, int $by): void
    {
        $row = static::firstOrCreate(['game_id' => $game->id, 'user_id' => $user->id], ['points' => 0]);
        $row->increment('points', $by);
    }
}
