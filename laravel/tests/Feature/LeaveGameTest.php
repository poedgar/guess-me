<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\User;
use App\Services\GameLifecycleService;

test('a non-admin participant leaving just removes their participant row', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $player = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $player->id]);

    app(GameLifecycleService::class)->leaveGame($game, $player);

    expect(GameParticipant::where('game_id', $game->id)->where('user_id', $player->id)->exists())->toBeFalse();
    expect($game->fresh()->status)->toBe('active');
    expect($game->fresh()->admin_left)->toBeFalse();
});

test('the admin leaving finishes the game and flags admin_left', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create([
        'admin_id' => $admin->id, 'status' => 'active',
        'admin_next_target_preference' => null,
        'players_who_completed_post_comment_phase' => ['1'],
    ]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);

    app(GameLifecycleService::class)->leaveGame($game, $admin);

    $fresh = $game->fresh();
    expect($fresh->status)->toBe('finished');
    expect($fresh->admin_left)->toBeTrue();
    expect($fresh->players_who_completed_post_comment_phase)->toBe([]);
    expect(GameParticipant::where('game_id', $game->id)->where('user_id', $admin->id)->exists())->toBeFalse();
});

test('POST leave removes the caller and redirects home', function () {
    $game = Game::factory()->create();
    $player = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $player->id]);

    $response = $this->actingAs($player)->post("/games/{$game->id}/leave");

    $response->assertRedirect('/dashboard');
    expect(GameParticipant::where('game_id', $game->id)->where('user_id', $player->id)->exists())->toBeFalse();
});
