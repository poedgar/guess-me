<?php

use App\Events\GameUpdated;
use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\User;
use Illuminate\Support\Facades\Event;

test('starting a game broadcasts GameUpdated', function () {
    Event::fake([GameUpdated::class]);
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $other = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $other->id]);

    $this->actingAs($admin)->post("/games/{$game->id}/start");

    Event::assertDispatched(GameUpdated::class, fn ($e) => $e->gameId === $game->id);
});

test('joining a game broadcasts GameUpdated', function () {
    Event::fake([GameUpdated::class]);
    $game = Game::factory()->create();
    $user = User::factory()->create();

    $this->actingAs($user)->post('/games/join', ['code' => $game->code]);

    Event::assertDispatched(GameUpdated::class, fn ($e) => $e->gameId === $game->id);
});
