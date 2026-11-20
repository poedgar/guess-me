<?php

use App\Models\Game;
use App\Models\Round;
use App\Models\User;

test('a RuntimeException message is translated according to the current locale', function () {
    app()->setLocale('uk');

    $game = Game::factory()->create();
    $target = User::factory()->create();
    $round = Round::factory()->create(['game_id' => $game->id, 'target_user_id' => $target->id]);

    expect(fn () => app(\App\Services\CommentPhaseService::class)->submitComment($round, $target, 'hi'))
        ->toThrow(RuntimeException::class, 'Ви не можете коментувати самого себе');
});

test('the same RuntimeException is in English when the locale is en', function () {
    app()->setLocale('en');

    $game = Game::factory()->create();
    $target = User::factory()->create();
    $round = Round::factory()->create(['game_id' => $game->id, 'target_user_id' => $target->id]);

    expect(fn () => app(\App\Services\CommentPhaseService::class)->submitComment($round, $target, 'hi'))
        ->toThrow(RuntimeException::class, 'You cannot comment about yourself');
});

test('a controller-level literal message is translated too', function () {
    app()->setLocale('uk');
    config(['game.admin_password' => 'secret-123']);
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post('/games', ['password' => 'wrong']);

    $response->assertSessionHasErrors(['password' => 'Невірний пароль адміністратора.']);
});
