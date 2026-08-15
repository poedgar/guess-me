<?php

use App\Models\Comment;
use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Guess;
use App\Models\Round;
use App\Models\User;
use App\Services\GuessingPhaseService;

function makeGuessableRound(int $commentCount = 1): array {
    $game = Game::factory()->create();
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $round = Round::factory()->create([
        'game_id' => $game->id,
        'target_user_id' => $target->id,
        'comments_visible' => true,
        'single_round_guessing_active' => true,
        'guessing_possible_authors' => [['userId' => (string) $target->id, 'userName' => $target->name]],
    ]);
    $comments = collect();
    for ($i = 0; $i < $commentCount; $i++) {
        $author = User::factory()->create();
        GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $author->id]);
        $comments->push(Comment::factory()->create(['round_id' => $round->id, 'author_id' => $author->id]));
    }

    return compact('game', 'target', 'round', 'comments');
}

test('the target can guess who wrote a comment, correctly', function () {
    ['target' => $target, 'round' => $round, 'comments' => $comments] = makeGuessableRound();
    $comment = $comments->first();

    $guess = app(GuessingPhaseService::class)->submitGuess($round, $target, $comment, $comment->author);

    expect($guess->correct)->toBeTrue();
    expect($round->fresh()->target_correct_guesses)->toBe(1);
});

test('an incorrect guess does not increment target_correct_guesses', function () {
    ['target' => $target, 'round' => $round, 'comments' => $comments] = makeGuessableRound();
    $comment = $comments->first();
    $wrongGuy = User::factory()->create();

    $guess = app(GuessingPhaseService::class)->submitGuess($round, $target, $comment, $wrongGuy);

    expect($guess->correct)->toBeFalse();
    expect($round->fresh()->target_correct_guesses)->toBe(0);
});

test('only the target can submit guesses', function () {
    ['round' => $round, 'comments' => $comments] = makeGuessableRound();
    $someoneElse = User::factory()->create();

    expect(fn () => app(GuessingPhaseService::class)->submitGuess($round, $someoneElse, $comments->first(), $someoneElse))
        ->toThrow(RuntimeException::class, 'Only the target can make guesses');
});

test('guessing twice for the same comment throws', function () {
    ['target' => $target, 'round' => $round, 'comments' => $comments] = makeGuessableRound();
    $comment = $comments->first();
    app(GuessingPhaseService::class)->submitGuess($round, $target, $comment, $comment->author);

    expect(fn () => app(GuessingPhaseService::class)->submitGuess($round, $target, $comment, $comment->author))
        ->toThrow(RuntimeException::class, 'You already guessed for this comment');
});

test('once the target has guessed on every comment, they are marked submitted and all-submitted flips true', function () {
    ['target' => $target, 'round' => $round, 'comments' => $comments] = makeGuessableRound(2);

    foreach ($comments as $comment) {
        app(GuessingPhaseService::class)->submitGuess($round, $target, $comment, $comment->author);
    }

    $round->refresh();
    expect($round->guessing_players_submitted)->toBe([(string) $target->id]);
    expect($round->guessing_all_submitted)->toBeTrue();
});
