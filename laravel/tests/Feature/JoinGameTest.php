<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\User;

test('joining an existing game by code adds the user as a participant', function () {
    $game = Game::factory()->create();
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post('/games/join', ['code' => $game->code]);

    expect(GameParticipant::where('game_id', $game->id)->where('user_id', $user->id)->exists())->toBeTrue();
    $response->assertRedirect("/games/{$game->id}");
});

test('joining a game the user already joined is a no-op, not an error', function () {
    $game = Game::factory()->create();
    $user = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $user->id]);

    $response = $this->actingAs($user)->post('/games/join', ['code' => $game->code]);

    $response->assertRedirect("/games/{$game->id}");
    expect(GameParticipant::where('game_id', $game->id)->where('user_id', $user->id)->count())->toBe(1);
});

test('joining with an unknown code fails validation', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post('/games/join', ['code' => 'no-such-code']);

    $response->assertSessionHasErrors('code');
});
