<?php

use App\Models\Comment;
use App\Models\Game;
use App\Models\GameParticipant;
use App\Models\Round;
use App\Models\User;
use Inertia\Testing\AssertableInertia as Assert;

test('during guessing_phase, the resource exposes possible authors and comments to guess about', function () {
    $admin = User::factory()->create();
    $game = Game::factory()->create(['admin_id' => $admin->id, 'status' => 'guessing_phase']);
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $admin->id]);
    $target = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $target->id]);
    $author = User::factory()->create();
    GameParticipant::factory()->create(['game_id' => $game->id, 'user_id' => $author->id]);
    $round = Round::factory()->create([
        'game_id' => $game->id, 'round_number' => 1, 'target_user_id' => $target->id,
        'comments_visible' => true,
        'guessing_possible_authors' => [['userId' => (string) $author->id, 'userName' => $author->name]],
    ]);
    Comment::factory()->create(['round_id' => $round->id, 'author_id' => $author->id, 'text' => 'Great teammate']);

    $response = $this->actingAs($target)->get("/games/{$game->id}");

    $response->assertInertia(fn (Assert $page) => $page
        ->where('game.status', 'guessing_phase')
        ->where('game.currentRound.guessingPossibleAuthors.0.userName', $author->name)
        ->where('game.currentRound.comments.0.text', 'Great teammate')
    );
});
