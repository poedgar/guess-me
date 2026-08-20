<?php

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
