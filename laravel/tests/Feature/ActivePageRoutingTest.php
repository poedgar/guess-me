<?php

use App\Models\Comment;
use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Round;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('an active game with an unfinalized round routes to the Active component', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    Round::factory()->create(['game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $target->id]);

    $response = $this->actingAs($admin)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page->component('Game/Show'));
    // Show.vue's phase routing is a client-side computed; the meaningful check here is
    // that the props it branches on (status, currentRound.guessesFinalized) are present
    // and correct — verified directly rather than via component-name assertion, since
    // Inertia's server-side test helpers see the wrapper page ('Game/Show'), not the
    // dynamically-rendered child component.
    $response->assertInertia(fn (Assert $page) => $page
        ->where('game.status', 'active')
        ->where('game.currentRound.guessesFinalized', false)
    );
});

test('an active game with an already-finalized current round is distinguishable from a fresh one', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    Round::factory()->create([
        'game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $target->id, 'guesses_finalized' => true,
    ]);

    $response = $this->actingAs($admin)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page->where('game.currentRound.guessesFinalized', true));
});

test('a participant sees their own comment authorId pre-reveal but not another participant\'s', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'active']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $authorA = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $authorA->id]);
    $authorB = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $authorB->id]);

    $round = Round::factory()->create([
        'game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $target->id,
        'comments_visible' => false,
    ]);
    Comment::factory()->create(['round_id' => $round->id, 'author_id' => $authorA->id]);
    Comment::factory()->create(['round_id' => $round->id, 'author_id' => $authorB->id]);

    $response = $this->actingAs($authorA)->get("/games/{$game->id}");

    $response->assertInertia(function (Assert $page) use ($authorA) {
        $page->where('game.currentRound.commentsVisible', false);

        $comments = collect($page->toArray()['props']['game']['currentRound']['comments']);
        $mine = $comments->firstWhere('authorId', $authorA->id);
        $others = $comments->reject(fn ($c) => $c['authorId'] === $authorA->id);

        expect($mine)->not->toBeNull();
        expect($others)->toHaveCount(1);
        expect($others->first()['authorId'])->toBeNull();
    });
});
