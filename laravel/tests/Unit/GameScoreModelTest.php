<?php

use App\Models\Game;
use App\Models\GameGuessResult;
use App\Models\GameScore;
use App\Models\User;

test('GameScore::incrementFor creates the row on first award and accumulates on repeat awards', function () {
    $game = Game::factory()->create();
    $user = User::factory()->create();

    GameScore::incrementFor($game, $user, 3);
    expect(GameScore::where('game_id', $game->id)->where('user_id', $user->id)->value('points'))->toBe(3);

    GameScore::incrementFor($game, $user, 2);
    expect(GameScore::where('game_id', $game->id)->where('user_id', $user->id)->value('points'))->toBe(5);
});

test('GameGuessResult::incrementFor creates the row on first award and accumulates on repeat awards', function () {
    $game = Game::factory()->create();
    $user = User::factory()->create();

    GameGuessResult::incrementFor($game, $user, 1);
    GameGuessResult::incrementFor($game, $user, 1);

    expect(GameGuessResult::where('game_id', $game->id)->where('user_id', $user->id)->value('correct_guesses'))->toBe(2);
});
