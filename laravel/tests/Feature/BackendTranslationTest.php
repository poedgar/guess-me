<?php

use App\Models\Comment;
use App\Models\Game;
use App\Models\GameParticipant;
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

test('an interpolated message translates its placeholder correctly', function () {
    app()->setLocale('uk');

    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $rater = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $rater->id]);
    $round = Round::factory()->create([
        'game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $target->id,
    ]);
    $comment = Comment::factory()->create(['round_id' => $round->id, 'points' => 1]);
    $round->update(['comments_visible' => true, 'active_comment_id' => $comment->id]);

    expect(fn () => app(\App\Services\CommentPhaseService::class)->activateNextComment($round->fresh()))
        ->toThrow(
            RuntimeException::class,
            "Неможливо активувати наступний коментар. Очікуємо, поки 1 учасник(ів) оцінять реакцію цільового гравця на поточний коментар.",
        );
});

test('a controller-level literal message is translated too', function () {
    app()->setLocale('uk');
    config(['game.admin_password' => 'secret-123']);
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post('/games', ['password' => 'wrong']);

    $response->assertSessionHasErrors(['password' => 'Невірний пароль адміністратора.']);
});
