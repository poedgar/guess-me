<?php

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
