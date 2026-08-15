<?php

use App\Models\Comment;
use App\Models\Game;
use App\Models\GameGuessResult;
use App\Models\GameParticipant;
use App\Models\Guess;
use App\Models\Round;
use App\Models\User;
use App\Services\GuessingPhaseService;

test('marking yourself submitted records the recomputed correct-guess total and starts the post-guessing point phase', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'guessing_phase']);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $author = User::factory()->create();
    $round = Round::factory()->create([
        'game_id' => $game->id,
        'target_user_id' => $target->id,
        'single_round_guessing_active' => true,
    ]);
    $comment = Comment::factory()->create(['round_id' => $round->id, 'author_id' => $author->id]);
    Guess::factory()->create([
        'round_id' => $round->id, 'comment_id' => $comment->id,
        'guesser_id' => $target->id, 'guessed_author_id' => $author->id, 'correct' => true,
    ]);

    app(GuessingPhaseService::class)->markPlayerGuessesSubmitted($game, $round, $target);

    expect(GameGuessResult::where('game_id', $game->id)->where('user_id', $target->id)->value('correct_guesses'))->toBe(1);
    expect($game->fresh()->post_guessing_point_phase)->toBeTrue();
    expect($game->fresh()->players_who_awarded_post_guess_points)->toBe([]);
});

test('a non-admin cannot mark a different player as submitted', function () {
    $game = Game::factory()->create();
    $round = Round::factory()->create(['game_id' => $game->id]);
    $caller = User::factory()->create();
    $otherPlayer = User::factory()->create();

    expect(fn () => app(GuessingPhaseService::class)->markPlayerGuessesSubmitted($game, $round, $caller, $otherPlayer))
        ->toThrow(RuntimeException::class, 'Only the admin can mark another player as submitted');
});

test('the admin can mark a different player as submitted', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id]);
    $round = Round::factory()->create(['game_id' => $game->id]);
    $target = User::factory()->create();

    app(GuessingPhaseService::class)->markPlayerGuessesSubmitted($game, $round, $admin, $target);

    expect(GameGuessResult::where('game_id', $game->id)->where('user_id', $target->id)->exists())->toBeTrue();
});
