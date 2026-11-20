<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Comment extends Model
{
    use HasFactory;

    protected $fillable = ['round_id', 'author_id', 'text', 'points', 'display_order', 'needs_revision'];

    protected $casts = ['needs_revision' => 'boolean'];

    public function round(): BelongsTo
    {
        return $this->belongsTo(Round::class);
    }

    public function author(): BelongsTo
    {
        return $this->belongsTo(User::class, 'author_id');
    }

    public function reactionRatings(): HasMany
    {
        return $this->hasMany(CommentReactionRating::class);
    }
}
