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

        if ($comment->points !== null) {
            throw new RuntimeException('Points have already been awarded to this comment');
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

    public function givePointsToTarget(Round $round, User $giver, int $points = 1): void
    {
        $alreadyGiven = in_array((string) $giver->id, $round->target_points_given_by ?? [], true);
        if ($alreadyGiven) {
            throw new RuntimeException('You already gave points to this target this round');
        }

        DB::transaction(function () use ($round, $giver, $points) {
            $round->update([
                'target_points' => $round->target_points + $points,
                'target_points_given_by' => [...($round->target_points_given_by ?? []), (string) $giver->id],
                'target_points_by_player' => [
                    ...($round->target_points_by_player ?? []),
                    (string) $giver->id => $points,
                ],
            ]);

            GameScore::incrementFor($round->game, $round->target, $points);

            $game = $round->game;
            $completed = $game->players_who_completed_post_comment_phase ?? [];
            if (! in_array((string) $giver->id, $completed, true)) {
                $game->update(['players_who_completed_post_comment_phase' => [...$completed, (string) $giver->id]]);
            }
        });
    }

    public function skipPostCommentPhase(Round $round, User $skipper): void
    {
        if (! $round->points_given) {
            throw new RuntimeException('Target has not finished giving points yet');
        }

        $game = $round->game;
        $completed = $game->players_who_completed_post_comment_phase ?? [];

        if (in_array((string) $skipper->id, $completed, true)) {
            throw new RuntimeException('You have already completed this phase');
        }

        if ($skipper->id === $round->target_user_id) {
            throw new RuntimeException('Target cannot skip this phase');
        }

        $game->update(['players_who_completed_post_comment_phase' => [...$completed, (string) $skipper->id]]);
    }
}
