<?php

use App\Models\Game;
use App\Models\GameScore;
use App\Models\Round;
use App\Models\User;
use App\Services\CommentPhaseService;

test('a participant can give the target bonus points once per round', function () {
    $game = Game::factory()->create();
    $target = User::factory()->create();
    $round = Round::factory()->create(['game_id' => $game->id, 'target_user_id' => $target->id, 'points_given' => true]);
    $giver = User::factory()->create();

    app(CommentPhaseService::class)->givePointsToTarget($round, $giver, 2);

    expect(GameScore::where('game_id', $game->id)->where('user_id', $target->id)->value('points'))->toBe(2);
    expect($round->fresh()->target_points)->toBe(2);
    expect($round->fresh()->target_points_given_by)->toBe([(string) $giver->id]);
    expect($game->fresh()->players_who_completed_post_comment_phase)->toBe([(string) $giver->id]);
});

test('giving points twice in the same round from the same giver throws', function () {
    $target = User::factory()->create();
    $round = Round::factory()->create(['target_user_id' => $target->id, 'points_given' => true]);
    $giver = User::factory()->create();
    app(CommentPhaseService::class)->givePointsToTarget($round, $giver, 1);

    expect(fn () => app(CommentPhaseService::class)->givePointsToTarget($round, $giver, 1))
        ->toThrow(RuntimeException::class, 'You already gave points to this target this round');
});

test('giving points to the target before they have finished awarding comment points throws', function () {
    $target = User::factory()->create();
    $round = Round::factory()->create(['target_user_id' => $target->id, 'points_given' => false]);
    $giver = User::factory()->create();

    expect(fn () => app(CommentPhaseService::class)->givePointsToTarget($round, $giver, 1))
        ->toThrow(RuntimeException::class, 'Target has not finished giving points yet');
});

test('skipPostCommentPhase requires points_given to already be true', function () {
    $round = Round::factory()->create(['points_given' => false]);
    $skipper = User::factory()->create();

    expect(fn () => app(CommentPhaseService::class)->skipPostCommentPhase($round, $skipper))
        ->toThrow(RuntimeException::class, 'Target has not finished giving points yet');
});

test('the target cannot skip their own post-comment phase', function () {
    $target = User::factory()->create();
    $round = Round::factory()->create(['target_user_id' => $target->id, 'points_given' => true]);

    expect(fn () => app(CommentPhaseService::class)->skipPostCommentPhase($round, $target))
        ->toThrow(RuntimeException::class, 'Target cannot skip this phase');
});

test('a participant can skip the post-comment phase once', function () {
    $game = Game::factory()->create();
    $round = Round::factory()->create(['game_id' => $game->id, 'points_given' => true]);
    $skipper = User::factory()->create();

    app(CommentPhaseService::class)->skipPostCommentPhase($round, $skipper);

    expect($game->fresh()->players_who_completed_post_comment_phase)->toBe([(string) $skipper->id]);
});
