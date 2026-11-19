<?php

use App\Models\Comment;
use App\Models\CommentReactionRating;
use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\GameScore;
use App\Models\Round;
use App\Models\User;
use App\Services\CommentPhaseService;

function makeActiveCommentForRating(array $gameOverrides = []): array {
    $admin = User::factory()->create();
    $game = Game::factory()->create(array_merge(['admin_id' => $admin->id], $gameOverrides));
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $rater = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $rater->id]);
    $round = Round::factory()->create(['game_id' => $game->id, 'target_user_id' => $target->id]);
    $comment = Comment::factory()->create(['round_id' => $round->id, 'points' => 1]);
    $round->update(['active_comment_id' => $comment->id]);

    return compact('admin', 'game', 'target', 'rater', 'round', 'comment');
}

test('a participant can rate the target reaction to the active comment', function () {
    ['game' => $game, 'target' => $target, 'rater' => $rater, 'comment' => $comment] = makeActiveCommentForRating();

    app(CommentPhaseService::class)->rateTargetReaction($comment, $rater, 1);

    expect(CommentReactionRating::where('comment_id', $comment->id)->where('rater_id', $rater->id)->value('rating'))->toBeTrue();
    expect(GameScore::where('game_id', $game->id)->where('user_id', $target->id)->value('points'))->toBe(1);
});

test('a rating of 0 is recorded but does not add score', function () {
    ['game' => $game, 'target' => $target, 'rater' => $rater, 'comment' => $comment] = makeActiveCommentForRating();

    app(CommentPhaseService::class)->rateTargetReaction($comment, $rater, 0);

    expect(CommentReactionRating::where('comment_id', $comment->id)->where('rater_id', $rater->id)->value('rating'))->toBeFalse();
    expect(GameScore::where('game_id', $game->id)->where('user_id', $target->id)->value('points'))->toBe(0);
});

test('the target cannot rate their own reaction', function () {
    ['target' => $target, 'comment' => $comment] = makeActiveCommentForRating();

    expect(fn () => app(CommentPhaseService::class)->rateTargetReaction($comment, $target, 1))
        ->toThrow(RuntimeException::class, 'The target cannot rate their own reaction');
});

test('the admin cannot rate when adminWritesComments is off', function () {
    ['admin' => $admin, 'comment' => $comment] = makeActiveCommentForRating(['admin_writes_comments' => false]);

    expect(fn () => app(CommentPhaseService::class)->rateTargetReaction($comment, $admin, 1))
        ->toThrow(RuntimeException::class, 'The admin does not participate in rating reactions');
});

test('the admin can rate when adminWritesComments is on', function () {
    ['admin' => $admin, 'game' => $game, 'target' => $target, 'comment' => $comment] = makeActiveCommentForRating(['admin_writes_comments' => true]);

    app(CommentPhaseService::class)->rateTargetReaction($comment, $admin, 1);

    expect(CommentReactionRating::where('comment_id', $comment->id)->where('rater_id', $admin->id)->exists())->toBeTrue();
});

test('rating a comment that is not currently active is rejected', function () {
    ['round' => $round, 'rater' => $rater, 'comment' => $activeComment] = makeActiveCommentForRating();
    $otherComment = Comment::factory()->create(['round_id' => $round->id]);

    expect(fn () => app(CommentPhaseService::class)->rateTargetReaction($otherComment, $rater, 1))
        ->toThrow(RuntimeException::class, 'This is not the currently active comment');
});

test('rating the same comment twice by the same rater is rejected', function () {
    ['rater' => $rater, 'comment' => $comment] = makeActiveCommentForRating();
    app(CommentPhaseService::class)->rateTargetReaction($comment, $rater, 1);

    expect(fn () => app(CommentPhaseService::class)->rateTargetReaction($comment, $rater, 1))
        ->toThrow(RuntimeException::class, "You have already rated the target's reaction to this comment");
});

test('POST rate-reaction route rejects a comment that belongs to a different game', function () {
    ['game' => $game, 'rater' => $rater] = makeActiveCommentForRating();

    $otherGame = Game::factory()->create();
    $otherTarget = User::factory()->create();
    $otherRound = Round::factory()->create(['game_id' => $otherGame->id, 'target_user_id' => $otherTarget->id]);
    $foreignComment = Comment::factory()->create(['round_id' => $otherRound->id]);

    $response = $this->actingAs($rater)->post("/games/{$game->id}/comments/{$foreignComment->id}/rate-reaction", ['rating' => 1]);

    $response->assertNotFound();
});

test('POST rate-reaction route surfaces a RuntimeException as a validation error, not a 403', function () {
    ['game' => $game, 'target' => $target, 'comment' => $comment] = makeActiveCommentForRating();

    $response = $this->actingAs($target)->post("/games/{$game->id}/comments/{$comment->id}/rate-reaction", ['rating' => 1]);

    $response->assertInvalid(['rating']);
    expect($response->status())->not->toBe(403);
});
