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
        try {
            $row = static::firstOrCreate(['game_id' => $game->id, 'user_id' => $user->id], ['points' => 0]);
        } catch (\Illuminate\Database\QueryException $e) {
            // Lost the create race to a concurrent request — the row exists now, fetch it.
            $row = static::where(['game_id' => $game->id, 'user_id' => $user->id])->firstOrFail();
        }
        $row->increment('points', $by);
    }
}
