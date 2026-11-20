<?php

namespace App\Services;

use App\Models\Comment;
use App\Models\CommentReactionRating;
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
            throw new RuntimeException(__('You cannot comment about yourself'));
        }

        if ($round->comments_visible) {
            throw new RuntimeException(__('Comments are already visible for this round'));
        }

        $trimmed = trim($text);
        if ($trimmed === '') {
            throw new RuntimeException(__('Comment cannot be empty'));
        }
        if (mb_strlen($trimmed) > 500) {
            throw new RuntimeException(__('Comment must be 500 characters or fewer'));
        }

        return DB::transaction(function () use ($round, $author, $trimmed) {
            $existing = $round->comments()->where('author_id', $author->id)->first();
            if ($existing) {
                if (! $existing->needs_revision) {
                    throw new RuntimeException(__('You have already submitted a comment for this round'));
                }
                $existing->update(['text' => $trimmed, 'needs_revision' => false]);

                return $existing;
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
        if ($round->comments_visible) {
            throw new RuntimeException(__('Comments are already visible for this round'));
        }

        DB::transaction(function () use ($round) {
            $ids = $round->comments()->pluck('id')->shuffle()->values();
            foreach ($ids as $index => $commentId) {
                Comment::whereKey($commentId)->update(['display_order' => $index]);
            }

            $round->update(['comments_visible' => true]);
        });
    }

    /**
     * Admin-only: sends a comment back to its own author for editing,
     * before comments are revealed. Nothing is deleted — the comment stays
     * attached to its author, flagged until they resubmit via
     * submitComment(), which updates it in place.
     */
    public function sendCommentBackForEdit(Comment $comment, User $admin): void
    {
        $round = $comment->round;
        if ($admin->id !== $round->game->admin_id) {
            throw new RuntimeException(__('Only the admin can send a comment back for editing'));
        }
        if ($round->comments_visible) {
            throw new RuntimeException(__('Cannot send a comment back once comments are visible'));
        }

        $comment->update(['needs_revision' => true]);
    }

    /**
     * Whether every required rater has rated the target's reaction to this
     * comment — "required" meaning every participant except the target,
     * and except the admin unless admin_writes_comments.
     */
    private function isCommentFullyRated(Round $round, Comment $comment): bool
    {
        $game = $round->game;
        $requiredRaterIds = $game->participants()
            ->where('user_id', '!=', $round->target_user_id)
            ->when(! $game->admin_writes_comments, fn ($q) => $q->where('user_id', '!=', $game->admin_id))
            ->pluck('user_id');

        return $requiredRaterIds->diff($comment->reactionRatings()->pluck('rater_id'))->isEmpty();
    }

    private function allCommentsFullyRated(Round $round): bool
    {
        return $round->comments->every(fn (Comment $c) => $this->isCommentFullyRated($round, $c));
    }

    /**
     * The target's 0/1 decision on a comment's author — only available once
     * every comment has full reaction ratings (see activateComment).
     */
    public function awardCommentPoints(Comment $comment, User $target, int $points): void
    {
        $round = $comment->round;
        if ($target->id !== $round->target_user_id) {
            throw new RuntimeException(__('Only the target person can give points'));
        }

        if ($comment->points !== null) {
            throw new RuntimeException(__('Points have already been awarded to this comment'));
        }

        if (! $this->allCommentsFullyRated($round)) {
            throw new RuntimeException(__('You can only give points once everyone has rated your reactions to every comment'));
        }

        DB::transaction(function () use ($comment, $round, $points) {
            $comment->update(['points' => $points]);
            GameScore::incrementFor($round->game, $comment->author, $points);

            if ($round->comments()->whereNull('points')->doesntExist()) {
                $round->update(['points_given' => true]);
            }
        });
    }

    /**
     * Target-only: activates a specific not-yet-fully-rated comment for
     * reaction rating. Any comment, any order — the only ordering
     * constraint is that the previously active comment, if any, must
     * already be fully rated before a different one can be activated.
     */
    public function activateComment(Round $round, Comment $comment, User $caller): void
    {
        if ($caller->id !== $round->target_user_id) {
            throw new RuntimeException(__('Only the target can activate a comment'));
        }

        if (! $round->comments_visible) {
            throw new RuntimeException(__('Review has not started'));
        }

        if ($round->points_given) {
            throw new RuntimeException(__("This round's review is already finished"));
        }

        if ($this->isCommentFullyRated($round, $comment)) {
            throw new RuntimeException(__("This comment's reactions are already complete"));
        }

        DB::transaction(function () use ($round, $comment) {
            $current = $round->activeComment;
            if ($current !== null) {
                if ($current->id === $comment->id) {
                    throw new RuntimeException(__('This comment is already active'));
                }
                if (! $this->isCommentFullyRated($round, $current)) {
                    throw new RuntimeException(__('You must finish rating the active comment before activating another'));
                }
            }

            $round->update(['active_comment_id' => $comment->id]);
        });
    }

    /**
     * Any required non-target participant's 0/1 rating of the target's
     * reaction to the currently active comment.
     */
    public function rateTargetReaction(Comment $comment, User $rater, int $rating): void
    {
        $round = $comment->round;
        $game = $round->game;

        if ($rater->id === $round->target_user_id) {
            throw new RuntimeException(__('The target cannot rate their own reaction'));
        }

        if (! $game->admin_writes_comments && $rater->id === $game->admin_id) {
            throw new RuntimeException(__('The admin does not participate in rating reactions'));
        }

        if ($comment->id !== $round->active_comment_id) {
            throw new RuntimeException(__('This is not the currently active comment'));
        }

        DB::transaction(function () use ($comment, $round, $rater, $rating) {
            if ($comment->reactionRatings()->where('rater_id', $rater->id)->exists()) {
                throw new RuntimeException(__("You have already rated the target's reaction to this comment"));
            }

            CommentReactionRating::create([
                'comment_id' => $comment->id,
                'rater_id' => $rater->id,
                'rating' => (bool) $rating,
            ]);

            GameScore::incrementFor($round->game, $round->target, $rating);
        });
    }
}
