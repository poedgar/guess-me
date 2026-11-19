<?php

use App\Models\Comment;
use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Round;
use App\Models\User;
use App\Services\CommentPhaseService;

test('showComments marks the round comments visible', function () {
    $round = Round::factory()->create();

    app(CommentPhaseService::class)->showComments($round);

    expect($round->fresh()->comments_visible)->toBeTrue();
});

test('showComments assigns a display order to every comment and activates the first one', function () {
    $round = Round::factory()->create();
    $comments = Comment::factory()->count(3)->create(['round_id' => $round->id]);

    app(CommentPhaseService::class)->showComments($round);

    $fresh = $round->fresh();
    $orders = $fresh->comments()->orderBy('display_order')->pluck('id');
    expect($orders)->toHaveCount(3);
    expect($orders->unique())->toHaveCount(3);
    expect($fresh->active_comment_id)->toBe($orders->first());
});

test('showComments is rejected once comments are already visible', function () {
    $round = Round::factory()->create(['comments_visible' => true]);

    expect(fn () => app(CommentPhaseService::class)->showComments($round))
        ->toThrow(RuntimeException::class, 'Comments are already visible for this round');
});

test('POST show-comments is admin-only', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $other = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $other->id]);
    Round::factory()->create(['game_id' => $game->id, 'round_number' => 1]);

    $response = $this->actingAs($other)->post("/games/{$game->id}/show-comments");

    $response->assertForbidden();
});

test('admin can reveal comments', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $round = Round::factory()->create(['game_id' => $game->id, 'round_number' => 1]);

    $response = $this->actingAs($admin)->post("/games/{$game->id}/show-comments");

    $response->assertRedirect("/games/{$game->id}");
    expect($round->fresh()->comments_visible)->toBeTrue();
});
