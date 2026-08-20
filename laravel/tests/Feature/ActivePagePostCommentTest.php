<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Round;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('once points are given, the resource exposes who has already completed the post-comment phase', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create([
        'admin_id' => $admin->id, 'status' => 'active',
        'players_who_completed_post_comment_phase' => [],
    ]);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $author = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $author->id]);
    Round::factory()->create([
        'game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $target->id,
        'comments_visible' => true, 'points_given' => true, 'target_points_given_by' => [],
    ]);

    $response = $this->actingAs($author)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page
        ->where('game.currentRound.pointsGiven', true)
        ->where('game.currentRound.targetPointsGivenBy', [])
        ->where('game.playersWhoCompletedPostCommentPhase', [])
    );
});
