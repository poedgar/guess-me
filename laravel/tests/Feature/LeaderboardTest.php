<?php

use App\Models\Game;
use App\Models\GameGuessResult;
use App\Models\GameParticipant;
use App\Models\GameScore;
use App\Models\Round;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('leaderboard freezes on the current round\'s start snapshot while a round is in progress', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $player = User::factory()->create(['name' => 'Player One']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $player->id]);

    // Round begins with a frozen snapshot of 5 points for the player...
    Round::factory()->create([
        'game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $player->id,
        'start_scores_snapshot' => [(string) $player->id => 5],
        'start_guess_results_snapshot' => [],
    ]);
    // ...but live scores have since moved to 9 (mid-round awards not yet reflected in the leaderboard).
    GameScore::create(['game_id' => $game->id, 'user_id' => $player->id, 'points' => 9]);

    $response = $this->actingAs($admin)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page
        ->where('game.leaderboard.0.userId', $player->id)
        ->where('game.leaderboard.0.gamePoints', 5)
    );
});

test('leaderboard shows live scores between rounds once the current round is guesses_finalized', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $player = User::factory()->create(['name' => 'Player One']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $player->id]);

    // Round 1 began with an empty snapshot (as GameLifecycleService::startGame creates it)...
    Round::factory()->create([
        'game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $player->id,
        'guesses_finalized' => true,
        'start_scores_snapshot' => [],
        'start_guess_results_snapshot' => [],
    ]);
    // ...but the round has fully played out: live scores/guess results now reflect the points awarded.
    GameScore::create(['game_id' => $game->id, 'user_id' => $player->id, 'points' => 9]);
    GameGuessResult::create(['game_id' => $game->id, 'user_id' => $player->id, 'correct_guesses' => 2]);

    $response = $this->actingAs($admin)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page
        ->where('game.leaderboard.0.userId', $player->id)
        ->where('game.leaderboard.0.gamePoints', 9)
        ->where('game.leaderboard.0.guessPoints', 2)
        ->where('game.leaderboard.0.totalPoints', 11)
    );
});

test('leaderboard shows live scores once the game is finished', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'finished']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $player = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $player->id]);
    GameScore::create(['game_id' => $game->id, 'user_id' => $player->id, 'points' => 9]);
    GameGuessResult::create(['game_id' => $game->id, 'user_id' => $player->id, 'correct_guesses' => 2]);

    $response = $this->actingAs($admin)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page
        ->where('game.leaderboard.0.userId', $player->id)
        ->where('game.leaderboard.0.gamePoints', 9)
        ->where('game.leaderboard.0.guessPoints', 2)
        ->where('game.leaderboard.0.totalPoints', 11)
    );
});
