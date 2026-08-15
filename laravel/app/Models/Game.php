<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Game extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'admin_id',
        'status',
        'admin_writes_comments',
        'show_surnames',
        'show_guess_results',
        'target_selection_mode',
        'post_guessing_point_phase',
        'players_who_awarded_post_guess_points',
        'admin_awards',
        'players_who_completed_post_comment_phase',
        'admin_left',
        'admin_next_target_preference',
        'admin_skipped_targets',
    ];

    protected $casts = [
        'admin_writes_comments' => 'boolean',
        'show_surnames' => 'boolean',
        'show_guess_results' => 'boolean',
        'post_guessing_point_phase' => 'boolean',
        'admin_left' => 'boolean',
        'players_who_awarded_post_guess_points' => 'array',
        'admin_awards' => 'array',
        'players_who_completed_post_comment_phase' => 'array',
        'admin_skipped_targets' => 'array',
    ];

    protected $attributes = [
        'status' => 'waiting',
        'admin_writes_comments' => false,
        'show_surnames' => false,
        'show_guess_results' => false,
        'target_selection_mode' => 'random',
        'post_guessing_point_phase' => false,
        'admin_left' => false,
    ];

    public function admin(): BelongsTo
    {
        return $this->belongsTo(User::class, 'admin_id');
    }

    public function participants(): HasMany
    {
        return $this->hasMany(GameParticipant::class);
    }

    public function rounds(): HasMany
    {
        return $this->hasMany(Round::class);
    }

    public function scores(): HasMany
    {
        return $this->hasMany(GameScore::class);
    }

    public function guessResults(): HasMany
    {
        return $this->hasMany(GameGuessResult::class);
    }

    public function currentRound(): HasMany
    {
        return $this->rounds()->latest('round_number');
    }
}
