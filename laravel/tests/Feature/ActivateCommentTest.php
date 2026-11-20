<?php

use App\Models\Comment;
use App\Models\CommentReactionRating;
use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Round;
use App\Models\User;
use App\Services\CommentPhaseService;

function makeRoundWithComments(int $commentCount = 2): array {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $rater = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $rater->id]);
    $round = Round::factory()->create([
        'game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $target->id,
        'comments_visible' => true,
    ]);
    $comments = Comment::factory()->count($commentCount)->create(['round_id' => $round->id]);

    return compact('game', 'admin', 'target', 'rater', 'round', 'comments');
}

test('the target can activate any not-yet-fully-rated comment', function () {
    ['target' => $target, 'round' => $round, 'comments' => $comments] = makeRoundWithComments();

    app(CommentPhaseService::class)->activateComment($round, $comments[1], $target);

    expect($round->fresh()->active_comment_id)->toBe($comments[1]->id);
});

test('a non-target caller is rejected', function () {
    ['admin' => $admin, 'round' => $round, 'comments' => $comments] = makeRoundWithComments();

    expect(fn () => app(CommentPhaseService::class)->activateComment($round, $comments[0], $admin))
        ->toThrow(RuntimeException::class, 'Only the target can activate a comment');
});

test('activation is rejected before comments are visible', function () {
    ['target' => $target, 'round' => $round, 'comments' => $comments] = makeRoundWithComments();
    $round->update(['comments_visible' => false]);

    expect(fn () => app(CommentPhaseService::class)->activateComment($round->fresh(), $comments[0], $target))
        ->toThrow(RuntimeException::class, 'Review has not started');
});

test('activation is rejected once the round review has already finished', function () {
    ['target' => $target, 'round' => $round, 'comments' => $comments] = makeRoundWithComments();
    $round->update(['points_given' => true]);

    expect(fn () => app(CommentPhaseService::class)->activateComment($round->fresh(), $comments[0], $target))
        ->toThrow(RuntimeException::class, "This round's review is already finished");
});

test('activating an already-fully-rated comment is rejected', function () {
    ['target' => $target, 'rater' => $rater, 'round' => $round, 'comments' => $comments] = makeRoundWithComments();
    CommentReactionRating::create(['comment_id' => $comments[0]->id, 'rater_id' => $rater->id, 'rating' => true]);

    expect(fn () => app(CommentPhaseService::class)->activateComment($round->fresh(), $comments[0], $target))
        ->toThrow(RuntimeException::class, "This comment's reactions are already complete");
});

test('re-activating the same already-active comment is rejected', function () {
    ['target' => $target, 'round' => $round, 'comments' => $comments] = makeRoundWithComments();
    $round->update(['active_comment_id' => $comments[0]->id]);

    expect(fn () => app(CommentPhaseService::class)->activateComment($round->fresh(), $comments[0], $target))
        ->toThrow(RuntimeException::class, 'This comment is already active');
});

test('activating a different comment is rejected while the current one is not fully rated', function () {
    ['target' => $target, 'round' => $round, 'comments' => $comments] = makeRoundWithComments();
    $round->update(['active_comment_id' => $comments[0]->id]);

    expect(fn () => app(CommentPhaseService::class)->activateComment($round->fresh(), $comments[1], $target))
        ->toThrow(RuntimeException::class, 'You must finish rating the active comment before activating another');
});

test('activating a different comment succeeds once the current one is fully rated', function () {
    ['target' => $target, 'rater' => $rater, 'round' => $round, 'comments' => $comments] = makeRoundWithComments();
    $round->update(['active_comment_id' => $comments[0]->id]);
    CommentReactionRating::create(['comment_id' => $comments[0]->id, 'rater_id' => $rater->id, 'rating' => true]);

    app(CommentPhaseService::class)->activateComment($round->fresh(), $comments[1], $target);

    expect($round->fresh()->active_comment_id)->toBe($comments[1]->id);
});

test('POST activate is target-only via the service, not a route-level policy, and surfaces a RuntimeException as a validation error', function () {
    ['admin' => $admin, 'game' => $game, 'comments' => $comments] = makeRoundWithComments();

    $response = $this->actingAs($admin)->post("/games/{$game->id}/comments/{$comments[0]->id}/activate");

    $response->assertInvalid(['comment']);
});

test('POST activate succeeds for the target', function () {
    ['target' => $target, 'game' => $game, 'comments' => $comments] = makeRoundWithComments();

    $response = $this->actingAs($target)->post("/games/{$game->id}/comments/{$comments[0]->id}/activate");

    $response->assertRedirect("/games/{$game->id}");
    expect($game->fresh()->rounds()->first()->active_comment_id)->toBe($comments[0]->id);
});

test('POST activate 404s for a comment belonging to a different game', function () {
    ['target' => $target, 'game' => $game] = makeRoundWithComments();

    $otherTarget = User::factory()->create();
    $otherRound = Round::factory()->create(['target_user_id' => $otherTarget->id]);
    $foreignComment = Comment::factory()->create(['round_id' => $otherRound->id]);

    $response = $this->actingAs($target)->post("/games/{$game->id}/comments/{$foreignComment->id}/activate");

    $response->assertNotFound();
});
