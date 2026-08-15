<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Round;
use App\Models\User;
use App\Services\GuessingPhaseService;

function makeRoundReadyForGuessing(): array {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $author = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $author->id]);
    $round = Round::factory()->create([
        'game_id' => $game->id,
        'round_number' => 1,
        'target_user_id' => $target->id,
        'comments_visible' => true,
        'points_given' => true,
    ]);

    return compact('game', 'admin', 'target', 'author', 'round');
}

test('starting the guessing phase requires all non-target participants to have completed the post-comment phase', function () {
    ['game' => $game] = makeRoundReadyForGuessing();

    expect(fn () => app(GuessingPhaseService::class)->startGuessingPhase($game))
        ->toThrow(RuntimeException::class, 'Cannot start guessing phase. Waiting for 1 player(s) to complete the post-comment phase.');
});

test('starting the guessing phase succeeds once all non-target participants have completed the post-comment phase', function () {
    ['game' => $game, 'author' => $author, 'round' => $round] = makeRoundReadyForGuessing();
    $game->update(['players_who_completed_post_comment_phase' => [(string) $author->id]]);

    app(GuessingPhaseService::class)->startGuessingPhase($game->fresh());

    expect($game->fresh()->status)->toBe('guessing_phase');
    $round->refresh();
    expect($round->single_round_guessing_active)->toBeTrue();
    expect($round->guessing_players_submitted)->toBe([]);
    expect($round->guessing_all_submitted)->toBeFalse();
    expect(collect($round->guessing_possible_authors)->pluck('userId'))->toContain((string) $author->id);
});
