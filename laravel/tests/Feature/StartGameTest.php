<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Round;
use App\Models\User;
use App\Services\GameLifecycleService;

test('starting a game creates round 1 with a non-admin target and assigns player numbers by join order', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id, 'joined_at' => now()->subMinutes(3)]);
    $second = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $second->id, 'joined_at' => now()->subMinutes(2)]);
    $third = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $third->id, 'joined_at' => now()->subMinute()]);

    app(GameLifecycleService::class)->startGame($game->fresh());

    $game->refresh();
    expect($game->status)->toBe('active');

    $round = Round::where('game_id', $game->id)->sole();
    expect($round->round_number)->toBe(1);
    expect($round->target_user_id)->not->toBe($admin->id);
    expect(in_array($round->target_user_id, [$second->id, $third->id]))->toBeTrue();

    expect($game->participants()->where('user_id', $admin->id)->value('player_number'))->toBe(1);
    expect($game->participants()->where('user_id', $second->id)->value('player_number'))->toBe(2);
    expect($game->participants()->where('user_id', $third->id)->value('player_number'))->toBe(3);
});

test('starting a game with fewer than 2 participants throws', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);

    expect(fn () => app(GameLifecycleService::class)->startGame($game->fresh()))
        ->toThrow(RuntimeException::class, 'Need at least 2 participants to start the game');
});

test('POST /games/{game}/start is admin-only', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $other = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $other->id]);

    $response = $this->actingAs($other)->post("/games/{$game->id}/start");

    $response->assertForbidden();
    expect($game->fresh()->status)->toBe('waiting');
});
