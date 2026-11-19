<?php

use App\Models\Comment;
use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Round;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('once comments are visible but before points are given, a commenter still sees their own comment authorId and text', function () {
    // Pins the data contract the "waiting for target to award points" branch of Active.vue
    // depends on: once comments are visible, a participant's own comment must expose a
    // non-null authorId and text even though points_given is still false — distinguishing
    // this state (myComment && commentsVisible && !pointsGiven) from every other branch.
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
    $round = Round::factory()->create([
        'game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $target->id,
        'comments_visible' => true, 'points_given' => false,
    ]);
    $comment = Comment::factory()->create([
        'round_id' => $round->id, 'author_id' => $author->id, 'text' => 'My honest observation',
    ]);

    $response = $this->actingAs($author)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page
        ->where('game.currentRound.commentsVisible', true)
        ->where('game.currentRound.pointsGiven', false)
        ->where('game.currentRound.comments.0.authorId', $author->id)
        ->where('game.currentRound.comments.0.text', 'My honest observation')
    );
});

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

test('exposes the active comment id and the viewer\'s own reaction rating', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $rater = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $rater->id]);
    $round = Round::factory()->create([
        'game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $target->id,
        'comments_visible' => true, 'points_given' => false,
    ]);
    $comment = Comment::factory()->create(['round_id' => $round->id, 'points' => 1]);
    $round->update(['active_comment_id' => $comment->id]);
    \App\Models\CommentReactionRating::create(['comment_id' => $comment->id, 'rater_id' => $rater->id, 'rating' => true]);

    $response = $this->actingAs($rater)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page
        ->where('game.currentRound.activeCommentId', $comment->id)
        ->where('game.currentRound.comments.0.myReactionRating', 1)
    );
});
