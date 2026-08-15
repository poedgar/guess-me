<?php

namespace App\Models;

use App\Models\Game;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GameGuessResult extends Model
{
    protected $fillable = ['game_id', 'user_id', 'correct_guesses'];

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
        $row = static::firstOrCreate(['game_id' => $game->id, 'user_id' => $user->id], ['correct_guesses' => 0]);
        $row->increment('correct_guesses', $by);
    }
}
