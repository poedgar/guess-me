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
            if ($round->comments()->where('author_id', $author->id)->exists()) {
                throw new RuntimeException(__('You have already submitted a comment for this round'));
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

            $round->update([
                'comments_visible' => true,
                'active_comment_id' => $ids->first(),
            ]);
        });
    }

    /**
     * The target's 0/1 decision on the currently active comment's author.
     */
    public function awardCommentPoints(Comment $comment, User $target, int $points): void
    {
        $round = $comment->round;
        if ($target->id !== $round->target_user_id) {
            throw new RuntimeException(__('Only the target person can give points'));
        }

        if ($comment->id !== $round->active_comment_id) {
            throw new RuntimeException(__('This is not the currently active comment'));
        }

        if ($comment->points !== null) {
            throw new RuntimeException(__('Points have already been awarded to this comment'));
        }

        DB::transaction(function () use ($comment, $round, $points) {
            $comment->update(['points' => $points]);
            GameScore::incrementFor($round->game, $comment->author, $points);
        });
    }

    /**
     * Admin-only: advances the round past the active comment once the target
     * has decided its points and every required rater has rated the target's
     * reaction to it — or finishes the round's review if it was the last one.
     */
    public function activateNextComment(Round $round): void
    {
        if ($round->points_given) {
            throw new RuntimeException(__('Comment review has already finished for this round'));
        }

        $activeComment = $round->activeComment;
        if ($activeComment === null) {
            throw new RuntimeException(__('No comment is currently active'));
        }

        if ($activeComment->points === null) {
            throw new RuntimeException(__('The target has not yet decided points for the active comment'));
        }

        $game = $round->game;
        $requiredRaterIds = $game->participants()
            ->where('user_id', '!=', $round->target_user_id)
            ->when(! $game->admin_writes_comments, fn ($q) => $q->where('user_id', '!=', $game->admin_id))
            ->pluck('user_id');
        $ratedIds = $activeComment->reactionRatings()->pluck('rater_id');
        $missing = $requiredRaterIds->diff($ratedIds);

        if ($missing->isNotEmpty()) {
            throw new RuntimeException(__(
                "Cannot activate the next comment yet. Waiting for :count participant(s) to rate the target's reaction to the current comment.",
                ['count' => $missing->count()],
            ));
        }

        DB::transaction(function () use ($round, $activeComment) {
            $orderedIds = $round->comments()->orderBy('display_order')->pluck('id');
            $nextId = $orderedIds->get($orderedIds->search($activeComment->id) + 1);

            $round->update($nextId
                ? ['active_comment_id' => $nextId]
                : ['active_comment_id' => null, 'points_given' => true]);
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
