<?php

use App\Models\Comment;
use App\Models\CommentReactionRating;
use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Round;
use App\Models\User;
use App\Services\CommentPhaseService;

function makeRoundWithTwoActivatableComments(array $gameOverrides = []): array {
    $admin = User::factory()->create();
    $game = Game::factory()->create(array_merge(['admin_id' => $admin->id], $gameOverrides));
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $rater = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $rater->id]);
    $round = Round::factory()->create(['game_id' => $game->id, 'target_user_id' => $target->id]);
    $comment1 = Comment::factory()->create(['round_id' => $round->id, 'display_order' => 0]);
    $comment2 = Comment::factory()->create(['round_id' => $round->id, 'display_order' => 1]);
    $round->update(['comments_visible' => true, 'active_comment_id' => $comment1->id]);

    return compact('admin', 'game', 'target', 'rater', 'round', 'comment1', 'comment2');
}

test('admin-only via the manage policy', function () {
    ['game' => $game, 'rater' => $rater] = makeRoundWithTwoActivatableComments();

    $response = $this->actingAs($rater)->post("/games/{$game->id}/activate-next-comment");

    $response->assertForbidden();
});

test('rejects when no comment is currently active', function () {
    $round = Round::factory()->create(['active_comment_id' => null]);

    expect(fn () => app(CommentPhaseService::class)->activateNextComment($round))
        ->toThrow(RuntimeException::class, 'No comment is currently active');
});

test('rejects when the target has not yet decided points for the active comment', function () {
    ['round' => $round] = makeRoundWithTwoActivatableComments();

    expect(fn () => app(CommentPhaseService::class)->activateNextComment($round))
        ->toThrow(RuntimeException::class, 'The target has not yet decided points for the active comment');
});

test('rejects with the correct count when required raters are missing', function () {
    ['round' => $round, 'comment1' => $comment1] = makeRoundWithTwoActivatableComments();
    $comment1->update(['points' => 1]);

    expect(fn () => app(CommentPhaseService::class)->activateNextComment($round))
        ->toThrow(RuntimeException::class, "Cannot activate the next comment yet. Waiting for 1 participant(s) to rate the target's reaction to the current comment.");
});

test('advances to the next comment once the target decided and all raters rated', function () {
    ['round' => $round, 'rater' => $rater, 'comment1' => $comment1, 'comment2' => $comment2] = makeRoundWithTwoActivatableComments();
    $comment1->update(['points' => 1]);
    CommentReactionRating::create(['comment_id' => $comment1->id, 'rater_id' => $rater->id, 'rating' => true]);

    app(CommentPhaseService::class)->activateNextComment($round);

    expect($round->fresh()->active_comment_id)->toBe($comment2->id);
    expect($round->fresh()->points_given)->toBeFalse();
});

test('finishes the round review when activating past the last comment', function () {
    ['round' => $round, 'rater' => $rater, 'comment1' => $comment1, 'comment2' => $comment2] = makeRoundWithTwoActivatableComments();
    $comment1->update(['points' => 1]);
    CommentReactionRating::create(['comment_id' => $comment1->id, 'rater_id' => $rater->id, 'rating' => true]);
    app(CommentPhaseService::class)->activateNextComment($round->fresh());

    $comment2->update(['points' => 0]);
    CommentReactionRating::create(['comment_id' => $comment2->id, 'rater_id' => $rater->id, 'rating' => false]);
    app(CommentPhaseService::class)->activateNextComment($round->fresh());

    expect($round->fresh()->active_comment_id)->toBeNull();
    expect($round->fresh()->points_given)->toBeTrue();
});

test('rejects a second activation once the round review has already finished', function () {
    $round = Round::factory()->create(['points_given' => true, 'active_comment_id' => null]);

    expect(fn () => app(CommentPhaseService::class)->activateNextComment($round))
        ->toThrow(RuntimeException::class, 'Comment review has already finished for this round');
});

test('POST activate-next-comment route surfaces a RuntimeException as a validation error, not a 500', function () {
    ['game' => $game, 'admin' => $admin] = makeRoundWithTwoActivatableComments();

    $response = $this->actingAs($admin)->post("/games/{$game->id}/activate-next-comment");

    $response->assertInvalid(['game']);
    expect($response->status())->not->toBe(500);
});
