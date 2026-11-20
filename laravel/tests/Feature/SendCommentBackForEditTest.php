<?php

use App\Models\Comment;
use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Round;
use App\Models\User;
use App\Services\CommentPhaseService;

test('the admin can send a comment back for editing', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id]);
    $round = Round::factory()->create(['game_id' => $game->id]);
    $comment = Comment::factory()->create(['round_id' => $round->id]);

    app(CommentPhaseService::class)->sendCommentBackForEdit($comment, $admin);

    expect($comment->fresh()->needs_revision)->toBeTrue();
});

test('a non-admin caller is rejected', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id]);
    $round = Round::factory()->create(['game_id' => $game->id]);
    $comment = Comment::factory()->create(['round_id' => $round->id]);
    $someoneElse = User::factory()->create();

    expect(fn () => app(CommentPhaseService::class)->sendCommentBackForEdit($comment, $someoneElse))
        ->toThrow(RuntimeException::class, 'Only the admin can send a comment back for editing');
    expect($comment->fresh()->needs_revision)->toBeFalse();
});

test('sending a comment back is rejected once comments are visible', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id]);
    $round = Round::factory()->create(['game_id' => $game->id, 'comments_visible' => true]);
    $comment = Comment::factory()->create(['round_id' => $round->id]);

    expect(fn () => app(CommentPhaseService::class)->sendCommentBackForEdit($comment, $admin))
        ->toThrow(RuntimeException::class, 'Cannot send a comment back once comments are visible');
    expect($comment->fresh()->needs_revision)->toBeFalse();
});

test('POST send-back succeeds for the admin and surfaces a RuntimeException as a validation error, not a 403', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $round = Round::factory()->create(['game_id' => $game->id]);
    $comment = Comment::factory()->create(['round_id' => $round->id]);

    $response = $this->actingAs($admin)->post("/games/{$game->id}/comments/{$comment->id}/send-back");

    $response->assertRedirect("/games/{$game->id}");
    expect($comment->fresh()->needs_revision)->toBeTrue();
});

test('POST send-back once comments are visible surfaces a validation error, not a 500', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $round = Round::factory()->create(['game_id' => $game->id, 'comments_visible' => true]);
    $comment = Comment::factory()->create(['round_id' => $round->id]);

    $response = $this->actingAs($admin)->post("/games/{$game->id}/comments/{$comment->id}/send-back");

    $response->assertInvalid(['comment']);
    expect($comment->fresh()->needs_revision)->toBeFalse();
});

test('POST send-back is forbidden for a non-admin participant', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $other = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $other->id]);
    $round = Round::factory()->create(['game_id' => $game->id]);
    $comment = Comment::factory()->create(['round_id' => $round->id]);

    $response = $this->actingAs($other)->post("/games/{$game->id}/comments/{$comment->id}/send-back");

    $response->assertForbidden();
    expect($comment->fresh()->needs_revision)->toBeFalse();
});

test('POST send-back 404s for a comment belonging to a different game', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);

    $otherRound = Round::factory()->create();
    $foreignComment = Comment::factory()->create(['round_id' => $otherRound->id]);

    $response = $this->actingAs($admin)->post("/games/{$game->id}/comments/{$foreignComment->id}/send-back");

    $response->assertNotFound();
});
