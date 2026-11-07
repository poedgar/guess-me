<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Round;
use App\Models\User;
use App\Services\GuessingPhaseService;

test('finalizing the guessing phase closes the round and returns the game to active', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'guessing_phase']);
    $round = Round::factory()->create(['game_id' => $game->id, 'single_round_guessing_active' => true]);

    app(GuessingPhaseService::class)->finalizeGuessingPhase($game, $round);

    expect($round->fresh()->guesses_finalized)->toBeTrue();
    expect($round->fresh()->single_round_guessing_active)->toBeFalse();
    expect($game->fresh()->status)->toBe('active');
});

test('only the admin can finalize the guessing phase', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'guessing_phase']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $round = Round::factory()->create(['game_id' => $game->id]);
    $other = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $other->id]);

    $response = $this->actingAs($other)->post("/games/{$game->id}/finalize-guessing");

    $response->assertForbidden();
});
