<?php

use App\Models\Comment;
use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\GameScore;
use App\Models\Round;
use App\Models\User;
use App\Services\CommentPhaseService;

test('the target can award points to a comment author, accumulating across multiple comments', function () {
    $game = Game::factory()->create();
    $target = User::factory()->create();
    $round = Round::factory()->create(['game_id' => $game->id, 'target_user_id' => $target->id]);
    $author = User::factory()->create();
    $comment1 = Comment::factory()->create(['round_id' => $round->id, 'author_id' => $author->id]);
    $author2 = User::factory()->create();
    $comment2 = Comment::factory()->create(['round_id' => $round->id, 'author_id' => $author2->id]);

    app(CommentPhaseService::class)->awardCommentPoints($comment1, $target, 3);
    app(CommentPhaseService::class)->awardCommentPoints($comment2, $target, 2);

    expect($comment1->fresh()->points)->toBe(3);
    expect(GameScore::where('game_id', $game->id)->where('user_id', $author->id)->value('points'))->toBe(3);
    expect(GameScore::where('game_id', $game->id)->where('user_id', $author2->id)->value('points'))->toBe(2);
});

test('only the target can award comment points', function () {
    $round = Round::factory()->create();
    $comment = Comment::factory()->create(['round_id' => $round->id]);
    $someoneElse = User::factory()->create();

    expect(fn () => app(CommentPhaseService::class)->awardCommentPoints($comment, $someoneElse, 1))
        ->toThrow(RuntimeException::class, 'Only the target person can give points');
});

test('only the target can finish awarding points', function () {
    $round = Round::factory()->create();
    $someoneElse = User::factory()->create();

    expect(fn () => app(CommentPhaseService::class)->finishAwardingPoints($round, $someoneElse))
        ->toThrow(RuntimeException::class, 'Only the target can finish giving points');
});

test('finishAwardingPoints marks the round pointsGiven', function () {
    $target = User::factory()->create();
    $round = Round::factory()->create(['target_user_id' => $target->id]);

    app(CommentPhaseService::class)->finishAwardingPoints($round, $target);

    expect($round->fresh()->points_given)->toBeTrue();
});
