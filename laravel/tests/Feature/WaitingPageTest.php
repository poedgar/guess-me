<?php

use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('the waiting page shows every participant and the admin-only controls only for the admin', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'waiting']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $other = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $other->id]);

    $adminResponse = $this->actingAs($admin)->get("/games/{$game->id}");
    $adminResponse->assertInertia(fn (Assert $page) => $page
        ->component('Game/Show')
        ->where('game.isAdmin', true)
        ->has('game.participants', 2)
    );

    $otherResponse = $this->actingAs($other)->get("/games/{$game->id}");
    $otherResponse->assertInertia(fn (Assert $page) => $page->where('game.isAdmin', false));
});
