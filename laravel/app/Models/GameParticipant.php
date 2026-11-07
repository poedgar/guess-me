<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class GameParticipant extends Model
{
    use HasFactory;

    protected $fillable = ['game_id', 'user_id', 'joined_at', 'has_been_target', 'player_number'];

    protected $casts = [
        'joined_at' => 'datetime',
        'has_been_target' => 'boolean',
    ];

    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
