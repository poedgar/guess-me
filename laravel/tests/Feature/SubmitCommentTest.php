<?php

use App\Models\Comment;
use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Round;
use App\Models\User;
use App\Services\CommentPhaseService;

function makeActiveGame(): array {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $author = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $author->id]);
    $round = Round::factory()->create(['game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $target->id]);

    return compact('game', 'admin', 'target', 'author', 'round');
}

test('a participant can submit one comment about the target', function () {
    ['author' => $author, 'round' => $round] = makeActiveGame();

    $comment = app(CommentPhaseService::class)->submitComment($round, $author, 'You are very observant.');

    expect($comment->text)->toBe('You are very observant.');
    expect($comment->author_id)->toBe($author->id);
    expect($comment->round_id)->toBe($round->id);
});

test('the target cannot comment about themselves', function () {
    ['target' => $target, 'round' => $round] = makeActiveGame();

    expect(fn () => app(CommentPhaseService::class)->submitComment($round, $target, 'Hi'))
        ->toThrow(RuntimeException::class, 'You cannot comment about yourself');
});

test('a comment over 500 characters is rejected', function () {
    ['author' => $author, 'round' => $round] = makeActiveGame();

    expect(fn () => app(CommentPhaseService::class)->submitComment($round, $author, str_repeat('a', 501)))
        ->toThrow(RuntimeException::class, 'Comment must be 500 characters or fewer');
});

test('an empty comment is rejected', function () {
    ['author' => $author, 'round' => $round] = makeActiveGame();

    expect(fn () => app(CommentPhaseService::class)->submitComment($round, $author, '   '))
        ->toThrow(RuntimeException::class, 'Comment cannot be empty');
});

test('a second comment from the same author in the same round is rejected', function () {
    ['author' => $author, 'round' => $round] = makeActiveGame();
    app(CommentPhaseService::class)->submitComment($round, $author, 'First comment');

    expect(fn () => app(CommentPhaseService::class)->submitComment($round, $author, 'Second comment'))
        ->toThrow(RuntimeException::class, 'You have already submitted a comment for this round');
});

test('POST comments route stores a comment for the current round', function () {
    ['game' => $game, 'author' => $author, 'round' => $round] = makeActiveGame();

    $response = $this->actingAs($author)->post("/games/{$game->id}/comments", ['text' => 'Great teammate.']);

    $response->assertRedirect("/games/{$game->id}");
    expect(Comment::where('round_id', $round->id)->where('author_id', $author->id)->exists())->toBeTrue();
});
