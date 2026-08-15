<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\GameScore;
use App\Models\Round;
use App\Models\User;
use App\Services\GameLifecycleService;

function makeGameWithCompletedRound(bool $adminWritesComments = false, string $targetSelectionMode = 'random'): array {
    $admin = User::factory()->create();
    $game = Game::factory()->create([
        'admin_id' => $admin->id,
        'status' => 'active',
        'admin_writes_comments' => $adminWritesComments,
        'target_selection_mode' => $targetSelectionMode,
    ]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id, 'joined_at' => now()->subMinutes(5)]);
    $round1Target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $round1Target->id, 'joined_at' => now()->subMinutes(4)]);
    $eligible = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $eligible->id, 'joined_at' => now()->subMinutes(3)]);
    Round::factory()->create([
        'game_id' => $game->id, 'round_number' => 1,
        'target_user_id' => $round1Target->id, 'comments_visible' => true, 'points_given' => true, 'guesses_finalized' => true,
    ]);
    GameScore::create(['game_id' => $game->id, 'user_id' => $round1Target->id, 'points' => 4]);

    return compact('game', 'admin', 'round1Target', 'eligible');
}

test('starting the next round excludes past targets and the admin (when admin_writes_comments is false)', function () {
    ['game' => $game, 'admin' => $admin, 'round1Target' => $round1Target, 'eligible' => $eligible] = makeGameWithCompletedRound();

    app(GameLifecycleService::class)->startNextRound($game->fresh());

    $round2 = Round::where('game_id', $game->id)->where('round_number', 2)->sole();
    expect($round2->target_user_id)->toBe($eligible->id);
    expect($game->fresh()->status)->toBe('active');
});

test('startNextRound snapshots current scores onto the new round', function () {
    ['game' => $game, 'round1Target' => $round1Target] = makeGameWithCompletedRound();

    app(GameLifecycleService::class)->startNextRound($game->fresh());

    $round2 = Round::where('game_id', $game->id)->where('round_number', 2)->sole();
    expect($round2->start_scores_snapshot)->toBe([(string) $round1Target->id => 4]);
});

test('startNextRound resets post-guessing and post-comment tracking', function () {
    ['game' => $game] = makeGameWithCompletedRound();
    $game->update([
        'post_guessing_point_phase' => true,
        'players_who_awarded_post_guess_points' => ['1'],
        'players_who_completed_post_comment_phase' => ['1'],
    ]);

    app(GameLifecycleService::class)->startNextRound($game->fresh());

    $fresh = $game->fresh();
    expect($fresh->post_guessing_point_phase)->toBeFalse();
    expect($fresh->players_who_awarded_post_guess_points)->toBe([]);
    expect($fresh->players_who_completed_post_comment_phase)->toBe([]);
});

test('chronological mode picks the earliest-joined eligible participant', function () {
    ['game' => $game] = makeGameWithCompletedRound(targetSelectionMode: 'chronological');
    $earlier = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $earlier->id, 'joined_at' => now()->subMinutes(10)]);

    app(GameLifecycleService::class)->startNextRound($game->fresh());

    $round2 = Round::where('game_id', $game->id)->where('round_number', 2)->sole();
    expect($round2->target_user_id)->toBe($earlier->id);
});

test('when every participant has been a target, the game finishes instead of starting a new round', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $onlyTarget = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $onlyTarget->id]);
    Round::factory()->create(['game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $onlyTarget->id]);

    app(GameLifecycleService::class)->startNextRound($game->fresh());

    expect($game->fresh()->status)->toBe('finished');
    expect(Round::where('game_id', $game->id)->count())->toBe(1);
});
