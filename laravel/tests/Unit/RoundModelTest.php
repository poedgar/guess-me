<?php

use App\Models\Comment;
use App\Models\Game;
use App\Models\Guess;
use App\Models\Round;
use App\Models\User;

test('round belongs to a game and a target, and has many comments and guesses', function () {
    $game = Game::factory()->create();
    $target = User::factory()->create();
    $round = Round::factory()->create(['game_id' => $game->id, 'target_user_id' => $target->id]);

    $comment = Comment::factory()->for($round)->create();
    $guess = Guess::factory()->for($round)->for($comment)->create();

    expect($round->game->is($game))->toBeTrue();
    expect($round->target->is($target))->toBeTrue();
    expect($round->comments->first()->is($comment))->toBeTrue();
    expect($round->guesses->first()->is($guess))->toBeTrue();
    expect($comment->round->is($round))->toBeTrue();
    expect($comment->author)->toBeInstanceOf(User::class);
});

test('round casts json columns to arrays and booleans to bool', function () {
    $round = Round::factory()->create([
        'target_points_given_by' => ['u1'],
        'comments_visible' => 1,
    ]);

    $fresh = $round->fresh();
    expect($fresh->target_points_given_by)->toBe(['u1']);
    expect($fresh->comments_visible)->toBeTrue();
});
