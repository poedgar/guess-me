<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('a participant can view the game page and sees the shaped game data', function () {
    $admin = User::factory()->create(['name' => 'Admin Person']);
    $game = Game::factory()->create(['admin_id' => $admin->id]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $participant = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $participant->id]);

    $response = $this->actingAs($participant)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page
        ->component('Game/Show')
        ->where('game.id', $game->id)
        ->where('game.code', $game->code)
        ->where('game.status', 'waiting')
        ->where('game.isAdmin', false)
        ->has('game.participants', 2)
    );
});

test('a non-participant cannot view the game page', function () {
    $game = Game::factory()->create();
    $outsider = User::factory()->create();

    $response = $this->actingAs($outsider)->get("/games/{$game->id}");

    $response->assertForbidden();
});
