<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\User;

beforeEach(function () {
    config(['game.admin_password' => 'secret-123']);
});

test('creating a game with the correct password creates the game and adds the creator as a participant', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post('/games', [
        'password' => 'secret-123',
        'admin_writes_comments' => true,
    ]);

    $game = Game::first();
    expect($game)->not->toBeNull();
    expect($game->admin_id)->toBe($user->id);
    expect($game->status)->toBe('waiting');
    expect($game->admin_writes_comments)->toBeTrue();
    expect(GameParticipant::where('game_id', $game->id)->where('user_id', $user->id)->exists())->toBeTrue();
    $response->assertRedirect("/games/{$game->id}");
});

test('creating a game with the wrong password fails validation and creates nothing', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post('/games', [
        'password' => 'wrong',
        'admin_writes_comments' => false,
    ]);

    $response->assertSessionHasErrors('password');
    expect(Game::count())->toBe(0);
});

test('guests cannot create a game', function () {
    $response = $this->post('/games', ['password' => 'secret-123']);

    $response->assertRedirect('/login');
});
