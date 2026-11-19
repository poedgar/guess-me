<?php

use App\Models\Comment;
use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\GameScore;
use App\Models\Round;
use App\Models\User;
use App\Services\CommentPhaseService;

test('re-awarding points to a comment that has already been awarded is rejected', function () {
    $game = Game::factory()->create();
    $target = User::factory()->create();
    $round = Round::factory()->create(['game_id' => $game->id, 'target_user_id' => $target->id]);
    $author = User::factory()->create();
    $comment = Comment::factory()->create(['round_id' => $round->id, 'author_id' => $author->id]);
    $round->update(['active_comment_id' => $comment->id]);

    app(CommentPhaseService::class)->awardCommentPoints($comment, $target, 1);

    expect(fn () => app(CommentPhaseService::class)->awardCommentPoints($comment->fresh(), $target, 1))
        ->toThrow(RuntimeException::class, 'Points have already been awarded to this comment');

    // Score wasn't double-credited by the rejected re-award.
    expect(GameScore::where('game_id', $game->id)->where('user_id', $author->id)->value('points'))->toBe(1);
});

test('awarding points to a comment that is not the currently active one is rejected', function () {
    $game = Game::factory()->create();
    $target = User::factory()->create();
    $round = Round::factory()->create(['game_id' => $game->id, 'target_user_id' => $target->id]);
    $author = User::factory()->create();
    $comment1 = Comment::factory()->create(['round_id' => $round->id, 'author_id' => $author->id]);
    $author2 = User::factory()->create();
    $comment2 = Comment::factory()->create(['round_id' => $round->id, 'author_id' => $author2->id]);
    $round->update(['active_comment_id' => $comment1->id]);

    expect(fn () => app(CommentPhaseService::class)->awardCommentPoints($comment2, $target, 1))
        ->toThrow(RuntimeException::class, 'This is not the currently active comment');

    expect($comment2->fresh()->points)->toBeNull();
});

test('POST comment-points route rejects a comment that belongs to a different game', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);

    $otherGame = Game::factory()->create();
    $otherTarget = User::factory()->create();
    $otherRound = Round::factory()->create(['game_id' => $otherGame->id, 'target_user_id' => $otherTarget->id]);
    $foreignComment = Comment::factory()->create(['round_id' => $otherRound->id]);

    $response = $this->actingAs($admin)->post("/games/{$game->id}/comment-points/{$foreignComment->id}", ['points' => 1]);

    $response->assertNotFound();
    expect($foreignComment->fresh()->points)->toBeNull();
});

test('the target can award points to the currently active comment author', function () {
    $game = Game::factory()->create();
    $target = User::factory()->create();
    $round = Round::factory()->create(['game_id' => $game->id, 'target_user_id' => $target->id]);
    $author = User::factory()->create();
    $comment = Comment::factory()->create(['round_id' => $round->id, 'author_id' => $author->id]);
    $round->update(['active_comment_id' => $comment->id]);

    app(CommentPhaseService::class)->awardCommentPoints($comment, $target, 1);

    expect($comment->fresh()->points)->toBe(1);
    expect(GameScore::where('game_id', $game->id)->where('user_id', $author->id)->value('points'))->toBe(1);
});

test('only the target can award comment points', function () {
    $round = Round::factory()->create();
    $comment = Comment::factory()->create(['round_id' => $round->id]);
    $someoneElse = User::factory()->create();

    expect(fn () => app(CommentPhaseService::class)->awardCommentPoints($comment, $someoneElse, 1))
        ->toThrow(RuntimeException::class, 'Only the target person can give points');
});

test('POST comment-points route surfaces a RuntimeException as a validation error, not a 403', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id]);
    $target = User::factory()->create();
    $round = Round::factory()->create(['game_id' => $game->id, 'target_user_id' => $target->id]);
    $author = User::factory()->create();
    $comment = Comment::factory()->create(['round_id' => $round->id, 'author_id' => $author->id]);
    $round->update(['active_comment_id' => $comment->id]);
    $notTarget = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $notTarget->id]);

    $response = $this->actingAs($notTarget)->post("/games/{$game->id}/comment-points/{$comment->id}", ['points' => 1]);

    $response->assertInvalid(['points']);
    expect($response->status())->not->toBe(403);
    expect($comment->fresh()->points)->toBeNull();
});

test('POST comment-points route rejects an out-of-range points value', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $round = Round::factory()->create(['game_id' => $game->id, 'target_user_id' => $target->id]);
    $comment = Comment::factory()->create(['round_id' => $round->id]);
    $round->update(['active_comment_id' => $comment->id]);

    $response = $this->actingAs($target)->post("/games/{$game->id}/comment-points/{$comment->id}", ['points' => 2]);

    $response->assertInvalid(['points']);
    expect($comment->fresh()->points)->toBeNull();
});
