<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Guess extends Model
{
    use HasFactory;

    protected $fillable = ['round_id', 'comment_id', 'guesser_id', 'guessed_author_id', 'correct'];

    protected $casts = ['correct' => 'boolean'];

    public function round(): BelongsTo
    {
        return $this->belongsTo(Round::class);
    }

    public function comment(): BelongsTo
    {
        return $this->belongsTo(Comment::class);
    }

    public function guesser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'guesser_id');
    }

    public function guessedAuthor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'guessed_author_id');
    }
}
