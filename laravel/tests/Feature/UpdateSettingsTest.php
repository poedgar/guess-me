<?php

use App\Models\Game;
use App\Models\User;
use App\Services\GameSettingsService;

test('the admin can update settings while the game is waiting', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'waiting']);

    $service = app(GameSettingsService::class);
    $service->updateAdminWritesComments($game, $admin, true);
    $service->updateShowSurnames($game->fresh(), $admin, true);
    $service->updateTargetSelectionMode($game->fresh(), $admin, 'chronological');
    $service->updateShowGuessResults($game->fresh(), $admin, true);

    $fresh = $game->fresh();
    expect($fresh->admin_writes_comments)->toBeTrue();
    expect($fresh->show_surnames)->toBeTrue();
    expect($fresh->target_selection_mode)->toBe('chronological');
    expect($fresh->show_guess_results)->toBeTrue();
});

test('settings cannot be changed once the game has started', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);

    expect(fn () => app(GameSettingsService::class)->updateAdminWritesComments($game, $admin, true))
        ->toThrow(RuntimeException::class, 'This setting can only be updated before the game starts');
});

test('only the admin can update settings', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'waiting']);
    $other = User::factory()->create();

    expect(fn () => app(GameSettingsService::class)->updateAdminWritesComments($game, $other, true))
        ->toThrow(RuntimeException::class, 'Only the admin can update this setting');
});

test('POST settings route rejects an invalid target selection mode value', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'waiting']);
    \App\Models\GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);

    $response = $this->actingAs($admin)->post("/games/{$game->id}/settings/target-selection-mode", ['value' => 'nonsense']);

    $response->assertInvalid(['value']);
    expect($game->fresh()->target_selection_mode)->not->toBe('nonsense');
});

test('POST settings route updates target selection mode', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'waiting']);
    \App\Models\GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);

    $response = $this->actingAs($admin)->post("/games/{$game->id}/settings/target-selection-mode", ['value' => 'chronological']);

    $response->assertRedirect("/games/{$game->id}");
    expect($game->fresh()->target_selection_mode)->toBe('chronological');
});

test('POST settings/target-selection-mode route surfaces a RuntimeException as a validation error, not a 403', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'waiting']);
    $other = User::factory()->create();
    \App\Models\GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $other->id]);

    $response = $this->actingAs($other)->post("/games/{$game->id}/settings/target-selection-mode", ['value' => 'chronological']);

    $response->assertInvalid(['value']);
    expect($response->status())->not->toBe(403);
    expect($game->fresh()->target_selection_mode)->not->toBe('chronological');
});

test('POST settings/admin-writes-comments route surfaces a RuntimeException as a validation error, not a 403', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'waiting']);
    $other = User::factory()->create();
    \App\Models\GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $other->id]);

    $response = $this->actingAs($other)->post("/games/{$game->id}/settings/admin-writes-comments", ['value' => true]);

    $response->assertInvalid(['value']);
    expect($response->status())->not->toBe(403);
    expect($game->fresh()->admin_writes_comments)->toBeFalse();
});
