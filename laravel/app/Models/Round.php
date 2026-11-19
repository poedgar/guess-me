<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Round extends Model
{
    use HasFactory;

    protected $fillable = [
        'game_id', 'round_number', 'target_user_id', 'comments_visible', 'points_given',
        'active_comment_id',
        'guesses_finalized', 'target_points', 'target_points_given_by', 'target_points_by_player',
        'target_correct_guesses', 'started_at', 'start_scores_snapshot', 'start_guess_results_snapshot',
        'guessing_possible_authors', 'guessing_players_submitted', 'guessing_all_submitted',
        'single_round_guessing_active',
    ];

    protected $casts = [
        'comments_visible' => 'boolean',
        'points_given' => 'boolean',
        'guesses_finalized' => 'boolean',
        'started_at' => 'datetime',
        'target_points_given_by' => 'array',
        'target_points_by_player' => 'array',
        'start_scores_snapshot' => 'array',
        'start_guess_results_snapshot' => 'array',
        'guessing_possible_authors' => 'array',
        'guessing_players_submitted' => 'array',
        'guessing_all_submitted' => 'boolean',
        'single_round_guessing_active' => 'boolean',
    ];

    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    public function target(): BelongsTo
    {
        return $this->belongsTo(User::class, 'target_user_id');
    }

    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class);
    }

    public function activeComment(): BelongsTo
    {
        return $this->belongsTo(Comment::class, 'active_comment_id');
    }

    public function guesses(): HasMany
    {
        return $this->hasMany(Guess::class);
    }
}
