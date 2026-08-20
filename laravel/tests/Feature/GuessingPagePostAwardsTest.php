<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('once the post-guessing point phase is active, the resource exposes who has already awarded', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create([
        'admin_id' => $admin->id, 'status' => 'guessing_phase',
        'post_guessing_point_phase' => true,
        'players_who_awarded_post_guess_points' => [],
    ]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);

    $response = $this->actingAs($admin)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page
        ->where('game.postGuessingPointPhase', true)
        ->where('game.playersWhoAwardedPostGuessPoints', [])
    );
});
