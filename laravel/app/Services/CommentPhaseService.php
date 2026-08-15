<?php

namespace App\Services;

use App\Models\Comment;
use App\Models\GameScore;
use App\Models\Round;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class CommentPhaseService
{
    public function submitComment(Round $round, User $author, string $text): Comment
    {
        if ($author->id === $round->target_user_id) {
            throw new RuntimeException('You cannot comment about yourself');
        }

        $trimmed = trim($text);
        if ($trimmed === '') {
            throw new RuntimeException('Comment cannot be empty');
        }
        if (mb_strlen($trimmed) > 500) {
            throw new RuntimeException('Comment must be 500 characters or fewer');
        }

        return DB::transaction(function () use ($round, $author, $trimmed) {
            if ($round->comments()->where('author_id', $author->id)->exists()) {
                throw new RuntimeException('You have already submitted a comment for this round');
            }

            return Comment::create([
                'round_id' => $round->id,
                'author_id' => $author->id,
                'text' => $trimmed,
            ]);
        });
    }

    public function showComments(Round $round): void
    {
        $round->update(['comments_visible' => true]);
    }

    public function awardCommentPoints(Comment $comment, User $target, int $points): void
    {
        $round = $comment->round;
        if ($target->id !== $round->target_user_id) {
            throw new RuntimeException('Only the target person can give points');
        }

        DB::transaction(function () use ($comment, $round, $points) {
            $comment->update(['points' => $points]);
            GameScore::incrementFor($round->game, $comment->author, $points);
        });
    }

    public function finishAwardingPoints(Round $round, User $target): void
    {
        if ($target->id !== $round->target_user_id) {
            throw new RuntimeException('Only the target can finish giving points');
        }

        $round->update(['points_given' => true]);
    }
}
