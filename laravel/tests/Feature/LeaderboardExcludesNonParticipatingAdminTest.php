<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\GameScore;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('the admin is excluded from the leaderboard when they do not write comments', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'admin_writes_comments' => false]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $player = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $player->id]);
    GameScore::create(['game_id' => $game->id, 'user_id' => $player->id, 'points' => 3]);

    $response = $this->actingAs($admin)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page
        ->where('game.leaderboard', fn ($leaderboard) => collect($leaderboard)->pluck('userId')->all() === [$player->id])
    );
});

test('the admin stays on the leaderboard when they do write comments', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'admin_writes_comments' => true]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $player = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $player->id]);
    GameScore::create(['game_id' => $game->id, 'user_id' => $admin->id, 'points' => 2]);

    $response = $this->actingAs($admin)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page
        ->where('game.leaderboard', fn ($leaderboard) => collect($leaderboard)->pluck('userId')->contains($admin->id))
    );
});
