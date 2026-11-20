<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\User;
use App\Services\GameLifecycleService;

test('a participant can change their name while the game is waiting', function () {
    $game = Game::factory()->create(['status' => 'waiting']);
    $player = User::factory()->create(['name' => 'Old Name']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $player->id]);

    app(GameLifecycleService::class)->updateMyName($game, $player, 'New Name');

    expect($player->fresh()->name)->toBe('New Name');
});

test('the name is trimmed before saving', function () {
    $game = Game::factory()->create(['status' => 'waiting']);
    $player = User::factory()->create(['name' => 'Old Name']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $player->id]);

    app(GameLifecycleService::class)->updateMyName($game, $player, '  Spacey Name  ');

    expect($player->fresh()->name)->toBe('Spacey Name');
});

test('an empty name is rejected', function () {
    $game = Game::factory()->create(['status' => 'waiting']);
    $player = User::factory()->create(['name' => 'Old Name']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $player->id]);

    expect(fn () => app(GameLifecycleService::class)->updateMyName($game, $player, '   '))
        ->toThrow(RuntimeException::class, 'Name cannot be empty');
    expect($player->fresh()->name)->toBe('Old Name');
});

test('the name cannot be changed once the game has started', function () {
    $game = Game::factory()->create(['status' => 'active']);
    $player = User::factory()->create(['name' => 'Old Name']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $player->id]);

    expect(fn () => app(GameLifecycleService::class)->updateMyName($game, $player, 'New Name'))
        ->toThrow(RuntimeException::class, 'This setting can only be updated before the game starts');
    expect($player->fresh()->name)->toBe('Old Name');
});

test('POST update-name changes the caller\'s name and redirects back to the game', function () {
    $game = Game::factory()->create(['status' => 'waiting']);
    $player = User::factory()->create(['name' => 'Old Name']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $player->id]);

    $response = $this->actingAs($player)->post("/games/{$game->id}/update-name", ['name' => 'New Name']);

    $response->assertRedirect("/games/{$game->id}");
    expect($player->fresh()->name)->toBe('New Name');
});

test('POST update-name returns a validation error, not a 500, once the game has started', function () {
    $game = Game::factory()->create(['status' => 'active']);
    $player = User::factory()->create(['name' => 'Old Name']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $player->id]);

    $response = $this->actingAs($player)->post("/games/{$game->id}/update-name", ['name' => 'New Name']);

    $response->assertInvalid(['name']);
    expect($player->fresh()->name)->toBe('Old Name');
});

test('a non-participant cannot change their name in someone else\'s game', function () {
    $game = Game::factory()->create(['status' => 'waiting']);
    $outsider = User::factory()->create(['name' => 'Old Name']);

    $response = $this->actingAs($outsider)->post("/games/{$game->id}/update-name", ['name' => 'New Name']);

    $response->assertForbidden();
});
