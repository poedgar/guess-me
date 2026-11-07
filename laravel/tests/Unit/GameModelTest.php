<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\User;

test('game belongs to an admin and has many participants', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id]);
    $participant = GameParticipant::factory()->create(['game_id' => $game->id]);

    expect($game->admin->is($admin))->toBeTrue();
    expect($game->participants->first()->is($participant))->toBeTrue();
    expect($participant->game->is($game))->toBeTrue();
});

test('game casts json array and boolean columns', function () {
    $game = Game::factory()->create([
        'players_who_awarded_post_guess_points' => ['u1', 'u2'],
        'admin_writes_comments' => true,
    ]);

    $fresh = $game->fresh();
    expect($fresh->players_who_awarded_post_guess_points)->toBe(['u1', 'u2']);
    expect($fresh->admin_writes_comments)->toBeTrue();
});

test('game defaults status to waiting and settings to their documented defaults', function () {
    $game = Game::factory()->create();

    expect($game->status)->toBe('waiting');
    expect($game->admin_writes_comments)->toBeFalse();
    expect($game->show_surnames)->toBeFalse();
    expect($game->show_guess_results)->toBeFalse();
    expect($game->target_selection_mode)->toBe('random');
});
