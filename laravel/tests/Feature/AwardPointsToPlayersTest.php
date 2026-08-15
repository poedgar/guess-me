<?php

use App\Models\Game;
use App\Models\GameScore;
use App\Models\Round;
use App\Models\User;
use App\Services\GuessingPhaseService;

test('a player can award post-guessing bonus points to others', function () {
    $game = Game::factory()->create(['post_guessing_point_phase' => true]);
    $round = Round::factory()->create(['game_id' => $game->id, 'round_number' => 3]);
    $awarder = User::factory()->create();
    $recipient1 = User::factory()->create();
    $recipient2 = User::factory()->create();

    app(GuessingPhaseService::class)->awardPointsToPlayers($game, $round, $awarder, [
        ['recipientId' => $recipient1->id, 'points' => 2],
        ['recipientId' => $recipient2->id, 'points' => 1],
    ]);

    expect(GameScore::where('game_id', $game->id)->where('user_id', $recipient1->id)->value('points'))->toBe(2);
    expect(GameScore::where('game_id', $game->id)->where('user_id', $recipient2->id)->value('points'))->toBe(1);
    expect($game->fresh()->players_who_awarded_post_guess_points)->toBe([(string) $awarder->id]);
    $history = $game->fresh()->admin_awards[(string) $awarder->id];
    expect($history)->toHaveCount(2);
    expect($history[0]['roundNumber'])->toBe(3);
});

test('awarding requires the post-guessing point phase to be active', function () {
    $game = Game::factory()->create(['post_guessing_point_phase' => false]);
    $round = Round::factory()->create(['game_id' => $game->id]);
    $awarder = User::factory()->create();
    $recipient = User::factory()->create();

    expect(fn () => app(GuessingPhaseService::class)->awardPointsToPlayers($game, $round, $awarder, [['recipientId' => $recipient->id, 'points' => 1]]))
        ->toThrow(RuntimeException::class, 'Post-guessing point phase is not active');
});

test('a player cannot award points to themselves', function () {
    $game = Game::factory()->create(['post_guessing_point_phase' => true]);
    $round = Round::factory()->create(['game_id' => $game->id]);
    $awarder = User::factory()->create();

    expect(fn () => app(GuessingPhaseService::class)->awardPointsToPlayers($game, $round, $awarder, [['recipientId' => $awarder->id, 'points' => 1]]))
        ->toThrow(RuntimeException::class, 'You cannot award points to yourself');
});

test('a player cannot award points twice in the same phase', function () {
    $game = Game::factory()->create(['post_guessing_point_phase' => true]);
    $round = Round::factory()->create(['game_id' => $game->id]);
    $awarder = User::factory()->create();
    $recipient = User::factory()->create();
    app(GuessingPhaseService::class)->awardPointsToPlayers($game, $round, $awarder, [['recipientId' => $recipient->id, 'points' => 1]]);

    expect(fn () => app(GuessingPhaseService::class)->awardPointsToPlayers($game->fresh(), $round, $awarder, [['recipientId' => $recipient->id, 'points' => 1]]))
        ->toThrow(RuntimeException::class, 'You have already awarded points in this phase');
});
