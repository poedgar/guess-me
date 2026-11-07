<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\GameScore;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('the leaderboard and admin-left flag are available for the Results page', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'finished', 'admin_left' => false]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $player = User::factory()->create(['name' => 'Player One']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $player->id]);
    GameScore::create(['game_id' => $game->id, 'user_id' => $player->id, 'points' => 5]);

    $response = $this->actingAs($admin)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page
        ->where('game.status', 'finished')
        ->where('game.leaderboard.0.name', 'Player One')
        ->where('game.leaderboard.0.totalPoints', 5)
        ->where('game.isAdmin', true)
    );
});
